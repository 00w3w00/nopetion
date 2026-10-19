import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { NotificationService } from '../../core/notification/notification.service';
import { NotificationType } from '../../core/notification/notification.constants';
import { EnvironmentService } from '../environment/environment.service';

export const AI_TERMINAL_STATUSES = ['completed', 'failed', 'conflict'] as const;
const types = {
  completed: NotificationType.AI_COMPLETED,
  failed: NotificationType.AI_FAILED,
  conflict: NotificationType.AI_CONFLICT,
} as const;

/** Terminal job rows are the durable outbox. Live sockets are only a hint. */
@Injectable()
export class PersonalAiNotificationsService {
  private readonly logger = new Logger(PersonalAiNotificationsService.name);
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly users: UserRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly pages: PageRepo,
    private readonly personal: PersonalWorkspaceAccess,
    private readonly permissions: PageAccessService,
    private readonly notifications: NotificationService,
    private readonly environment: EnvironmentService,
  ) {}

  async recover() {
    if (!this.environment.isPersonalMode()) return;
    const pending = await this.db.selectFrom('personalAiJobs').select('id')
      .where('status', 'in', [...AI_TERMINAL_STATUSES])
      .where('notificationHandledAt', 'is', null).orderBy('updatedAt').orderBy('id').limit(100).execute();
    for (const row of pending) await this.notifySafely(row.id);
  }

  async notifySafely(id: string) {
    try {
      await this.deliver(id);
    } catch {
      // Keep the outbox pending. Never change a completed result into a failed job.
      this.logger.warn('AI notification is pending and will be retried');
    }
  }

  async deliver(id: string) {
    if (!this.environment.isPersonalMode()) return;
    const notification = await this.db.transaction().execute(async (trx) => {
      const job = await trx.selectFrom('personalAiJobs').selectAll()
        .where('id', '=', id).where('status', 'in', [...AI_TERMINAL_STATUSES])
        .where('notificationHandledAt', 'is', null).forUpdate().skipLocked().executeTakeFirst();
      if (!job) return;
      const handled = () => trx.updateTable('personalAiJobs').set({ notificationHandledAt: new Date() })
        .where('id', '=', job.id).execute();

      const ownerInfo = await trx.selectFrom('users').select('workspaceId')
        .where('id', '=', job.ownerId).executeTakeFirst();
      if (!ownerInfo) { await handled(); return; }
      const [account, root] = await Promise.all([
        this.users.findById(job.ownerId, ownerInfo.workspaceId),
        this.workspaces.findById(ownerInfo.workspaceId),
      ]);
      if (!account || !root || root.deletedAt) { await handled(); return; }

      let page: Awaited<ReturnType<PageRepo['findById']>>;
      try {
        this.personal.assertOwner(account);
        const selected = await this.personal.resolve(account, root, job.workspaceId);
        if (selected.user.id !== job.userId) { await handled(); return; }
        page = await this.pages.findById(job.pageId);
        if (!page || page.deletedAt || page.workspaceId !== job.workspaceId) { await handled(); return; }
        const space = await trx.selectFrom('spaces').select('id').where('id', '=', page.spaceId)
          .where('workspaceId', '=', job.workspaceId).where('deletedAt', 'is', null).executeTakeFirst();
        if (!space) { await handled(); return; }
        await this.permissions.validateCanView(page, selected.user);
      } catch (error) {
        if (!(error instanceof HttpException) || ![401, 403, 404].includes(error.getStatus())) throw error;
        await handled();
        return;
      }

      const action = ['ask', 'summary', 'polish', 'translate'].includes(job.payload?.action)
        ? String(job.payload.action) : 'ask';
      const saved = await this.notifications.createOnceInTransaction({
        id: job.id,
        userId: job.userId,
        workspaceId: job.workspaceId,
        pageId: job.pageId,
        spaceId: page.spaceId,
        type: types[job.status as keyof typeof types],
        data: {
          jobId: job.id,
          status: job.status,
          action,
          errorCode: job.errorCode && /^[a-zA-Z]{1,40}$/.test(job.errorCode) ? job.errorCode : null,
        },
      }, trx);
      await handled();
      return saved;
    });
    if (notification) this.notifications.publish(notification);
  }
}
