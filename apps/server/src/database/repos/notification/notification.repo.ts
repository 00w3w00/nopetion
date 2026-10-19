import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  InsertableNotification,
  Notification,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import {
  NotificationTab,
  NotificationType,
  PERSONAL_NOTIFICATION_TYPES,
} from '../../../core/notification/notification.constants';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class NotificationRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly environment: EnvironmentService,
  ) {}

  async findById(notificationId: string): Promise<Notification | undefined> {
    return this.db
      .selectFrom('notifications')
      .selectAll('notifications')
      .where('id', '=', notificationId)
      .executeTakeFirst();
  }

  private visibleForUser(userId: string) {
    let query = this.db
      .selectFrom('notifications')
      .where('userId', '=', userId)
      .where((eb) =>
        eb.or([
          eb('spaceId', 'is', null),
          eb(
            'spaceId',
            'in',
            this.spaceMemberRepo.getUserSpaceIdsQuery(userId),
          ),
        ]),
      );

    if (this.environment.isPersonalMode()) {
      query = query.where('type', 'in', PERSONAL_NOTIFICATION_TYPES)
        .where((eb) => eb.exists(eb.selectFrom('users').select('id')
          .whereRef('users.id', '=', 'notifications.userId')
          .whereRef('users.workspaceId', '=', 'notifications.workspaceId')
          .where('users.deletedAt', 'is', null).where('users.deactivatedAt', 'is', null)))
        .where((eb) => eb.exists(eb.selectFrom('workspaces').select('id')
          .whereRef('workspaces.id', '=', 'notifications.workspaceId').where('workspaces.deletedAt', 'is', null)))
        .where((eb) => eb.or([
          eb('spaceId', 'is', null),
          eb.exists(eb.selectFrom('spaces').select('id')
            .whereRef('spaces.id', '=', 'notifications.spaceId')
            .whereRef('spaces.workspaceId', '=', 'notifications.workspaceId')
            .where('spaces.deletedAt', 'is', null)),
        ]))
        .where((eb) => eb.or([
          eb('pageId', 'is', null),
          eb.exists(eb.selectFrom('pages').select('id')
            .whereRef('pages.id', '=', 'notifications.pageId')
            .whereRef('pages.workspaceId', '=', 'notifications.workspaceId')
            .where('pages.deletedAt', 'is', null)),
        ]));
    }
    return query;
  }

  async findByUserId(
    userId: string,
    pagination: PaginationOptions,
    type: NotificationTab = 'all',
  ) {
    let query = this.visibleForUser(userId)
      .selectAll('notifications')
      .select((eb) => this.withActor(eb))
      .select((eb) => this.withPage(eb))
      .select((eb) => this.withSpace(eb));

    if (type === 'direct') {
      query = query.where('type', '!=', NotificationType.PAGE_UPDATED);
    } else if (type === 'updates') {
      query = query.where('type', '=', NotificationType.PAGE_UPDATED);
    }

    if (this.environment.isPersonalMode()) {
      return executeWithCursorPagination(query, {
        perPage: pagination.limit,
        cursor: pagination.cursor,
        beforeCursor: pagination.beforeCursor,
        fields: [
          // PostgreSQL keeps microseconds while the serialized Date cursor keeps
          // milliseconds. Use the same precision for ordering and comparisons.
          { expression: sql<Date>`date_trunc('milliseconds', ${sql.ref('notifications.createdAt')})`, key: 'createdAt' as const, direction: 'desc' },
          { expression: 'id', key: 'id' as const, direction: 'desc' },
        ] as const,
        parseCursor: (cursor) => ({ createdAt: new Date(cursor.createdAt), id: cursor.id }),
      });
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async insert(notification: InsertableNotification): Promise<Notification> {
    return this.db
      .insertInto('notifications')
      .values(notification)
      .returningAll()
      .executeTakeFirst();
  }

  async insertOnce(notification: InsertableNotification & { id: string }, trx: KyselyTransaction): Promise<Notification> {
    const inserted = await trx.insertInto('notifications').values(notification)
      .onConflict((oc) => oc.column('id').doNothing()).returningAll().executeTakeFirst();
    if (inserted) return inserted;
    const previous = await trx.selectFrom('notifications').selectAll()
      .where('id', '=', notification.id).executeTakeFirst();
    if (!previous || previous.userId !== notification.userId || previous.workspaceId !== notification.workspaceId ||
        previous.pageId !== notification.pageId || previous.type !== notification.type ||
        (previous.data as { jobId?: string })?.jobId !== (notification.data as { jobId?: string })?.jobId)
      throw new Error('Notification identity conflict');
    return previous;
  }

  async findUnreadPersonalReferences(userId: string) {
    return this.visibleForUser(userId).select(['id', 'pageId'])
      .where('readAt', 'is', null).execute();
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.visibleForUser(userId)
      .select((eb) => eb.fn.count('id').as('count'))
      .where('readAt', 'is', null)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.unreadForUpdate(userId).where('id', '=', notificationId).execute();
  }

  async markMultipleAsRead(
    notificationIds: string[],
    userId: string,
  ): Promise<void> {
    if (notificationIds.length === 0) {
      return;
    }
    await this.unreadForUpdate(userId).where('id', 'in', notificationIds).execute();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.unreadForUpdate(userId).execute();
  }

  private unreadForUpdate(userId: string) {
    let query = this.db
      .updateTable('notifications')
      .set({ readAt: new Date() })
      .where('userId', '=', userId)
      .where('readAt', 'is', null);
    if (this.environment.isPersonalMode()) query = query.where('type', 'in', PERSONAL_NOTIFICATION_TYPES);
    return query;
  }

  async markAsEmailed(notificationId: string): Promise<void> {
    await this.db
      .updateTable('notifications')
      .set({ emailedAt: new Date() })
      .where('id', '=', notificationId)
      .where('emailedAt', 'is', null)
      .execute();
  }

  async getRecentlyNotifiedUserIds(
    userIds: string[],
    pageId: string,
    type: string,
    withinHours: number,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);

    const rows = await this.db
      .selectFrom('notifications')
      .select('userId')
      .where('userId', 'in', userIds)
      .where('pageId', '=', pageId)
      .where('type', '=', type)
      .where('createdAt', '>', cutoff)
      .groupBy('userId')
      .execute();

    return new Set(rows.map((r) => r.userId));
  }

  withActor(eb: ExpressionBuilder<DB, 'notifications'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'notifications.actorId'),
    ).as('actor');
  }

  withPage(eb: ExpressionBuilder<DB, 'notifications'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('pages')
        .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.icon'])
        .whereRef('pages.id', '=', 'notifications.pageId'),
    ).as('page');
  }

  withSpace(eb: ExpressionBuilder<DB, 'notifications'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'notifications.spaceId'),
    ).as('space');
  }
}
