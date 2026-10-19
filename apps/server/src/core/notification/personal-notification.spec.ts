import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { NotificationService } from './notification.service';
import { NotificationRepo } from '../../database/repos/notification/notification.repo';
import { NotificationProcessor } from './notification.processor';
import { NotificationType, PERSONAL_NOTIFICATION_TYPES } from './notification.constants';
import { MailService } from '../../integrations/mail/mail.service';

describe('personal inbox boundaries', () => {
  it.each(Object.values(NotificationType).filter((type) => !PERSONAL_NOTIFICATION_TYPES.includes(type)))(
    'does not create collaboration notification %s or queue its email in personal mode', async (type) => {
      const db: any = { selectFrom: jest.fn() };
      const repo: any = { insert: jest.fn() };
      const mail: any = { sendToQueue: jest.fn() };
      const service = new NotificationService(repo, {} as any, {} as any, mail, db,
        { isPersonalMode: () => true } as any);
      expect(await service.create({ userId: 'user', workspaceId: 'workspace', type })).toBeNull();
      await service.queueEmail('user', 'notification', 'collaboration', {}, type);
      expect(db.selectFrom).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
      expect(mail.sendToQueue).not.toHaveBeenCalled();
    },
  );

  it('keeps ordinary notification creation while removed email remains disabled', async () => {
    const row = { id: 'notification', userId: 'user', type: NotificationType.COMMENT_CREATED };
    const query: any = { select: () => query, where: () => query,
      executeTakeFirst: async () => ({ id: 'user', email: 'fixture@example.invalid', settings: {} }) };
    const repo: any = { insert: jest.fn(async () => row) };
    const mail: any = { sendToQueue: jest.fn() };
    const emit = jest.fn();
    const service = new NotificationService(repo, {} as any,
      { server: { to: () => ({ emit }) } } as any, mail, { selectFrom: () => query } as any,
      { isPersonalMode: () => false } as any);
    expect(await service.create({ userId: 'user', workspaceId: 'workspace', type: row.type })).toBe(row);
    await service.queueEmail('user', 'notification', 'collaboration', {}, row.type);
    expect(mail.sendToQueue).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not run previously queued collaboration workers in personal mode', async () => {
    const comment: any = { processComment: jest.fn() };
    const db: any = { selectFrom: jest.fn() };
    const processor = new NotificationProcessor(comment, {} as any, {} as any, {} as any, {} as any,
      db, { isPersonalMode: () => true } as any);
    await processor.process({ name: 'comment-notification', data: {} } as any);
    expect(db.selectFrom).not.toHaveBeenCalled();
    expect(comment.processComment).not.toHaveBeenCalled();
  });

  it('counts only still-accessible personal notifications', async () => {
    const repo: any = { findUnreadPersonalReferences: async () => [
      { id: 'visible', pageId: 'allowed' }, { id: 'hidden', pageId: 'forbidden' }, { id: 'system', pageId: null },
    ] };
    const permissions: any = { filterAccessiblePageIds: jest.fn(async () => ['allowed']) };
    const service = new NotificationService(repo, permissions, {} as any, {} as any, {} as any,
      { isPersonalMode: () => true } as any);
    expect(await service.getUnreadCount('scoped-user')).toBe(2);
    expect(permissions.filterAccessiblePageIds).toHaveBeenCalledWith({ pageIds: ['allowed', 'forbidden'], userId: 'scoped-user' });
  });

  it.each([true, false])('applies personal-only filters before pagination/count when personal mode is %s', async (personal) => {
    const queries: { sql: string; parameters: readonly unknown[] }[] = [];
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => new DummyDriver(),
        createIntrospector: (connection) => new PostgresIntrospector(connection),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
      log: (event) => { if (event.level === 'query') queries.push(event.query); },
    });
    const repo = new NotificationRepo(db as any,
      { getUserSpaceIdsQuery: () => db.selectFrom('spaceMembers').select('spaceId').where('userId', '=', 'scoped-user') } as any,
      { isPersonalMode: () => personal } as any);
    try {
      await repo.findByUserId('scoped-user', { limit: 20 } as any);
      await repo.getUnreadCount('scoped-user');
      expect(queries).toHaveLength(2);
      for (const query of queries) {
        expect(query.parameters).toContain('scoped-user');
        for (const type of PERSONAL_NOTIFICATION_TYPES)
          expect(query.parameters.includes(type)).toBe(personal);
        expect(query.sql.includes('"workspaces"."deletedAt" is null')).toBe(personal);
        expect(query.sql.includes('"pages"."deletedAt" is null')).toBe(personal);
      }
      expect(queries[0].sql.includes('order by date_trunc(\'milliseconds\', "notifications"."createdAt") desc')).toBe(personal);
    } finally { await db.destroy(); }
  });

  it('uses millisecond precision for both personal inbox cursor comparisons and ordering in either direction', async () => {
    const queries: { sql: string; parameters: readonly unknown[] }[] = [];
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => new DummyDriver(),
        createIntrospector: (connection) => new PostgresIntrospector(connection),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
      log: (event) => { if (event.level === 'query') queries.push(event.query); },
    });
    const repo = new NotificationRepo(db as any,
      { getUserSpaceIdsQuery: () => db.selectFrom('spaceMembers').select('spaceId') } as any,
      { isPersonalMode: () => true } as any);
    const cursor = Buffer.from(new URLSearchParams({
      createdAt: '2026-10-18T00:00:00.123Z',
      id: '11111111-1111-4111-8111-111111111111',
    }).toString()).toString('base64url');
    try {
      await repo.findByUserId('scoped-user', { limit: 1, cursor } as any);
      await repo.findByUserId('scoped-user', { limit: 1, beforeCursor: cursor } as any);
      expect(queries).toHaveLength(2);
      for (const [index, query] of queries.entries()) {
        // Equality and range predicates must use the same expression as ORDER BY;
        // comparing the original microseconds to an ISO Date loses boundary rows.
        expect(query.sql.match(/date_trunc\('milliseconds', "notifications"\."createdAt"\)/g)).toHaveLength(3);
        expect(query.sql).toContain(`order by date_trunc('milliseconds', "notifications"."createdAt") ${index === 0 ? 'desc' : 'asc'}`);
        const timestampParameters = query.parameters.filter((value) => value instanceof Date) as Date[];
        expect(timestampParameters.map((value) => value.toISOString())).toEqual([
          '2026-10-18T00:00:00.123Z', '2026-10-18T00:00:00.123Z',
        ]);
      }
    } finally { await db.destroy(); }
  });

  it('never sends or queues notification or recovery email in this fork', async () => {
    const mail = new MailService();
    for (const message of [
      { to: 'fixture@example.invalid', subject: 'notification', notificationId: 'legacy' },
      { to: 'fixture@example.invalid', subject: 'password recovery' },
    ]) {
      expect(await mail.sendEmail(message)).toBe(false);
      await expect(mail.sendToQueue(message)).resolves.toBeUndefined();
    }
  });
});
