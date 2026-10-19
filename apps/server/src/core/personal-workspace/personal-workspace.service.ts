import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User } from '@docmost/db/types/entity.types';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { PersonalWorkspaceAccess } from './personal-workspace-access.service';
import { UserRole } from '../../common/helpers/types/permission';

@Injectable()
export class PersonalWorkspaceService {
  constructor(@InjectKysely() private readonly db: KyselyDB,
    private readonly access: PersonalWorkspaceAccess,
    private readonly workspaces: WorkspaceService,
    private readonly events: EventEmitter2) {}

  async list(account: User) {
    this.access.assertOwner(account);
    const linked = this.db.selectFrom('personalWorkspaces').select('workspaceId')
      .where('ownerId', '=', account.id);
    const rows = await this.db.selectFrom('workspaces').select(['id', 'name', 'logo', 'createdAt'])
      .where(eb => eb.or([eb('id', '=', account.workspaceId), eb('id', 'in', linked)]))
      .where('deletedAt', 'is', null).orderBy('createdAt').orderBy('id').execute();
    return rows.map(row => ({ ...row, canDelete: row.id !== account.workspaceId }));
  }

  async trash(account: User) {
    this.access.assertOwner(account);
    return this.db.selectFrom('personalWorkspaces as binding')
      .innerJoin('workspaces as workspace', 'workspace.id', 'binding.workspaceId')
      .select(['workspace.id', 'workspace.name', 'workspace.deletedAt'])
      .where('binding.ownerId', '=', account.id).where('workspace.deletedAt', 'is not', null)
      .orderBy('workspace.deletedAt', 'desc').execute();
  }

  private async changeDeletion(account: User, workspaceId: string, confirmationName?: string) {
    this.access.assertOwner(account);
    if (workspaceId === account.workspaceId)
      throw new BadRequestException('The account workspace cannot be deleted');
    return this.db.transaction().execute(async trx => {
      const owner = await trx.selectFrom('users').selectAll().where('id', '=', account.id)
        .where('workspaceId', '=', account.workspaceId).forUpdate().executeTakeFirstOrThrow();
      this.access.assertOwner(owner);
      const workspace = await trx.selectFrom('personalWorkspaces as binding')
        .innerJoin('workspaces as workspace', 'workspace.id', 'binding.workspaceId')
        .select(['workspace.id', 'workspace.name', 'workspace.deletedAt'])
        .where('binding.ownerId', '=', owner.id).where('binding.workspaceId', '=', workspaceId)
        .forUpdate().executeTakeFirst();
      if (!workspace) throw new NotFoundException('Personal workspace unavailable');
      if (confirmationName !== undefined && confirmationName !== workspace.name)
        throw new ConflictException('Workspace name does not match');
      const deleting = confirmationName !== undefined;
      if (deleting && !workspace.deletedAt || !deleting && workspace.deletedAt)
        await trx.updateTable('workspaces').set({ deletedAt: deleting ? new Date() : null })
          .where('id', '=', workspaceId).execute();
      return { id: workspaceId, fallbackWorkspaceId: owner.workspaceId };
    });
  }

  async delete(account: User, workspaceId: string, confirmationName: string) {
    const result = await this.changeDeletion(account, workspaceId, confirmationName);
    await this.events.emitAsync('personal-workspace.deleted', { workspaceId });
    return result;
  }

  restore(account: User, workspaceId: string) {
    return this.changeDeletion(account, workspaceId);
  }

  async create(account: User, name: string, creationKey: string) {
    this.access.assertOwner(account);
    return this.db.transaction().execute(async trx => {
      // Serialize this owner's creations and make retries return the same row.
      const owner = await trx.selectFrom('users').selectAll().where('id', '=', account.id)
        .where('workspaceId', '=', account.workspaceId).forUpdate().executeTakeFirstOrThrow();
      this.access.assertOwner(owner);
      const previous = await trx.selectFrom('personalWorkspaces').select('workspaceId')
        .where('ownerId', '=', owner.id).where('creationKey', '=', creationKey).executeTakeFirst();
      if (previous) return { id: previous.workspaceId };
      const scoped = await trx.insertInto('users').values({
        name: owner.name, email: owner.email, password: null, role: UserRole.OWNER,
        locale: owner.locale, timezone: owner.timezone, emailVerifiedAt: owner.emailVerifiedAt,
      }).returningAll().executeTakeFirstOrThrow();
      const workspace = await this.workspaces.create(scoped, { name }, trx);
      await trx.insertInto('personalWorkspaces').values({
        ownerId: owner.id, userId: scoped.id, workspaceId: workspace.id, creationKey,
      }).execute();
      return { id: workspace.id };
    });
  }
}
