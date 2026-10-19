import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { validate as isUuid } from 'uuid';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { isUserDisabled } from '../../common/helpers';
import { UserRole } from '../../common/helpers/types/permission';

export const PERSONAL_WORKSPACE_COOKIE = 'nopetionWorkspace';
export const PERSONAL_WORKSPACE_HEADER = 'x-nopetion-workspace-id';

// Account credentials/sessions always belong to the original owner. Scoped
// users have no password and exist only to reuse ordinary CE authorization.
export function personalUser(account: User, scoped: User): User & { accountId: string } {
  return { ...scoped, name: account.name, email: account.email,
    avatarUrl: account.avatarUrl, locale: account.locale, timezone: account.timezone,
    settings: account.settings, accountId: account.id };
}

@Injectable()
export class PersonalWorkspaceAccess {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly users: UserRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly environment: EnvironmentService,
  ) {}

  enabled() { return this.environment.isPersonalMode() && this.environment.isSelfHosted(); }

  assertOwner(account: User) {
    if (!this.enabled() || account.role !== UserRole.OWNER || isUserDisabled(account))
      throw new ForbiddenException('Personal workspace owner required');
  }

  async resolve(account: User, accountWorkspace: Workspace, target?: unknown) {
    if (target == null || target === '' || target === account.workspaceId)
      return { user: personalUser(account, account), workspace: accountWorkspace };
    this.assertOwner(account);
    if (typeof target !== 'string' || !isUuid(target))
      throw new NotFoundException('Personal workspace unavailable');
    const binding = await this.db.selectFrom('personalWorkspaces').select('userId')
      .where('ownerId', '=', account.id).where('workspaceId', '=', target).executeTakeFirst();
    if (!binding) {
      const reset = await this.db.selectFrom('personalWorkspaceResets').select('requestId')
        .where('ownerId', '=', account.id)
        .where('removedWorkspaceIds', '@>', sql<string[]>`ARRAY[${target}]::uuid[]`).executeTakeFirst();
      if (reset) throw this.deletedWorkspace(account);
      throw new NotFoundException('Personal workspace unavailable');
    }
    const [workspace, user] = await Promise.all([
      this.workspaces.findById(target), this.users.findById(binding.userId, target),
    ]);
    if (workspace?.deletedAt) throw this.deletedWorkspace(account);
    if (!workspace || workspace.deletedAt || !user || isUserDisabled(user) || user.role !== UserRole.OWNER)
      throw new NotFoundException('Personal workspace unavailable');
    return { user: personalUser(account, user), workspace };
  }

  private deletedWorkspace(account: User) {
    return new NotFoundException({ statusCode: 404, message: 'Personal workspace deleted',
      code: 'PERSONAL_WORKSPACE_DELETED', fallbackWorkspaceId: account.workspaceId });
  }

  async requestTarget(req: any) {
    // Private file URLs predate this feature. Determine their workspace from
    // metadata, then still check the authenticated owner's explicit binding.
    if (req.method === 'GET' && req.params?.fileId && isUuid(req.params.fileId)) {
      const attachment = await this.db.selectFrom('attachments').select('workspaceId')
        .where('id', '=', req.params.fileId).executeTakeFirst();
      if (attachment) return attachment.workspaceId;
    }
    return req.headers?.[PERSONAL_WORKSPACE_HEADER] ?? req.query?.workspaceId
      ?? req.cookies?.[PERSONAL_WORKSPACE_COOKIE];
  }

  async validateCollaborationUser(user: User) {
    if (!this.enabled()) return;
    const workspace = await this.workspaces.findById(user.workspaceId);
    if (!workspace || workspace.deletedAt) throw new ForbiddenException('Workspace unavailable');
    const owner = await this.db.selectFrom('personalWorkspaces as binding')
      .innerJoin('users as owner', 'owner.id', 'binding.ownerId')
      .innerJoin('workspaces as root', 'root.id', 'owner.workspaceId')
      .select(['owner.role', 'owner.deletedAt', 'owner.deactivatedAt', 'root.deletedAt as workspaceDeletedAt'])
      .where('binding.userId', '=', user.id).executeTakeFirst();
    if (owner && (isUserDisabled(owner) || owner.role !== UserRole.OWNER || owner.workspaceDeletedAt))
      throw new ForbiddenException('Personal workspace owner unavailable');
  }
}
