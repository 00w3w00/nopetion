import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User } from '@docmost/db/types/entity.types';
import { posix } from 'node:path';
import { PersonalWorkspaceAccess } from './personal-workspace-access.service';
import { PersonalWorkspaceCleanup } from './personal-workspace-cleanup.service';
import { SpaceService } from '../space/services/space.service';
import { AttachmentType } from '../attachment/attachment.constants';
import { getAttachmentFolderPath } from '../attachment/attachment.utils';
import { comparePasswordHash } from '../../common/helpers';

@Injectable()
export class PersonalWorkspaceReset {
  constructor(@InjectKysely() private readonly db: KyselyDB,
    private readonly access: PersonalWorkspaceAccess, private readonly spaces: SpaceService,
    private readonly cleanup: PersonalWorkspaceCleanup, private readonly events: EventEmitter2) {}

  async reset(account: User, confirmationPassword: string, requestId: string) {
    this.access.assertOwner(account);
    const affected = await this.db.transaction().execute(async trx => {
      const owner = await trx.selectFrom('users').selectAll().where('id', '=', account.id)
        .where('workspaceId', '=', account.workspaceId).forUpdate().executeTakeFirstOrThrow();
      this.access.assertOwner(owner);
      if (!await comparePasswordHash(confirmationPassword, owner.password))
        throw new BadRequestException('Current password is incorrect');
      const previous = await trx.selectFrom('personalWorkspaceResets').select('requestId')
        .where('requestId', '=', requestId).where('ownerId', '=', owner.id).executeTakeFirst();
      if (previous) return [];
      const linked = await trx.selectFrom('personalWorkspaces').select('workspaceId')
        .where('ownerId', '=', owner.id).execute();
      const workspaceIds = [owner.workspaceId, ...linked.map(row => row.workspaceId)];
      await trx.selectFrom('workspaces').select('id').where('id', 'in', workspaceIds).orderBy('id').forUpdate().execute();
      const pages = await trx.selectFrom('pages').select(['id', 'workspaceId']).where('workspaceId', 'in', workspaceIds).execute();
      const attachments = (await trx.selectFrom('attachments').selectAll().where('workspaceId', 'in', workspaceIds).execute())
        .filter(file => file.workspaceId !== owner.workspaceId || ![AttachmentType.Avatar, AttachmentType.WorkspaceIcon].includes(file.type as AttachmentType));
      for (const file of attachments) {
        const prefix = getAttachmentFolderPath(file.type as AttachmentType, file.workspaceId) + '/';
        if (!file.filePath.startsWith(prefix) || posix.normalize(file.filePath) !== file.filePath
          || posix.basename(file.filePath) !== file.fileName || ['.', '..'].includes(file.fileName))
          throw new ConflictException('Unexpected attachment path; reset cancelled');
      }
      if (attachments.length) {
        await trx.insertInto('personalWorkspaceResetFiles').values(attachments.map(file => ({ ownerId: owner.id, filePath: file.filePath })))
          .onConflict(oc => oc.column('filePath').doNothing()).execute();
        await trx.deleteFrom('attachments').where('id', 'in', attachments.map(file => file.id)).execute();
      }
      // Space/page foreign keys cascade history, comments, permissions, trash,
      // favourites and document data. Account/session/AI storage stay untouched.
      await trx.deleteFrom('spaces').where('workspaceId', '=', owner.workspaceId).execute();
      if (linked.length) await trx.deleteFrom('workspaces').where('id', 'in', linked.map(row => row.workspaceId)).execute();
      const general = await this.spaces.createSpace(owner, owner.workspaceId, { name: 'General', slug: 'general' }, trx);
      await trx.updateTable('workspaces').set({ defaultSpaceId: general.id }).where('id', '=', owner.workspaceId).execute();
      await trx.insertInto('personalWorkspaceResets').values({ requestId, ownerId: owner.id,
        removedWorkspaceIds: linked.map(row => row.workspaceId) }).execute();
      return workspaceIds.map(workspaceId => ({ workspaceId, pageIds: pages.filter(page => page.workspaceId === workspaceId).map(page => page.id) }));
    });
    for (const workspace of affected) await this.events.emitAsync('personal-workspace.deleted', workspace);
    const cleanupPending = await this.cleanup.drain(account.id);
    return { fallbackWorkspaceId: account.workspaceId, cleanupPending };
  }
}
