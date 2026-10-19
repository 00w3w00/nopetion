import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { InsertableNotification, Notification } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { WsGateway } from '../../ws/ws.gateway';
import { MailService } from '../../integrations/mail/mail.service';
import { isPersonalNotification, NotificationTab, NotificationType, NotificationTypeToSettingKey } from './notification.constants';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepo: NotificationRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly wsGateway: WsGateway,
    private readonly mailService: MailService,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly environment: EnvironmentService,
  ) {}

  async create(data: InsertableNotification) {
    if (this.environment.isPersonalMode() && !isPersonalNotification(data.type)) return null;
    const user = await this.db
      .selectFrom('users')
      .select(['id'])
      .where('id', '=', data.userId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .executeTakeFirst();

    if (!user) return null;

    const notification = await this.notificationRepo.insert(data);

    this.publish(notification);

    return notification;
  }

  async createOnceInTransaction(data: InsertableNotification & { id: string }, trx: KyselyTransaction) {
    if (this.environment.isPersonalMode() && !isPersonalNotification(data.type)) return null;
    const user = await trx.selectFrom('users').select('id').where('id', '=', data.userId)
      .where('workspaceId', '=', data.workspaceId).where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null).executeTakeFirst();
    if (!user) return null;
    return this.notificationRepo.insertOnce(data, trx);
  }

  publish(notification: Notification) {
    try {
      this.wsGateway.server?.to(`user-${notification.userId}`)
        .emit('notification', { id: notification.id, type: notification.type });
    } catch {
      // Persistence is authoritative; an offline socket never invalidates a notification.
      this.logger.warn('Notification saved; live delivery is unavailable');
    }
  }

  async findByUserId(
    userId: string,
    pagination: PaginationOptions,
    type: NotificationTab = 'all',
  ) {
    const result = await this.notificationRepo.findByUserId(
      userId,
      pagination,
      type,
    );

    const pageIds = result.items
      .map((n: any) => n.pageId)
      .filter(Boolean);

    if (pageIds.length > 0) {
      const accessiblePageIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
      const accessibleSet = new Set(accessiblePageIds);

      result.items = result.items.filter(
        (n: any) => !n.pageId || accessibleSet.has(n.pageId),
      );
    }

    return result;
  }

  async getUnreadCount(userId: string) {
    if (this.environment.isPersonalMode()) {
      const rows = await this.notificationRepo.findUnreadPersonalReferences(userId);
      const pageIds = [...new Set(rows.map((row) => row.pageId).filter(Boolean))];
      const accessible = new Set(pageIds.length ? await this.pagePermissionRepo.filterAccessiblePageIds({ pageIds, userId }) : []);
      return rows.filter((row) => !row.pageId || accessible.has(row.pageId)).length;
    }
    return this.notificationRepo.getUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  async markMultipleAsRead(notificationIds: string[], userId: string) {
    return this.notificationRepo.markMultipleAsRead(notificationIds, userId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async queueEmail(
    userId: string,
    notificationId: string,
    subject: string,
    template: any,
    type?: NotificationType,
  ) {
    // Legacy compatibility entry: no email body is rendered or queued.
  }
}
