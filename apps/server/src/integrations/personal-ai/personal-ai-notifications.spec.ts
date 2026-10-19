import { ForbiddenException } from '@nestjs/common';
import { PersonalAiNotificationsService } from './personal-ai-notifications.service';
import { PersonalAiJobsService } from './personal-ai-jobs.service';
import { NotificationService } from '../../core/notification/notification.service';
import { NotificationRepo } from '../../database/repos/notification/notification.repo';

const ownerId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const workspaceId = '33333333-3333-4333-8333-333333333333';
const jobId = '44444444-4444-4444-8444-444444444444';
const pageId = '55555555-5555-4555-8555-555555555555';
const spaceId = '66666666-6666-4666-8666-666666666666';
type State = Record<string, Record<string, any>[]>;

// Transactional fixture: commits are isolated, failures roll back, and callers
// serialize just as the outbox row lock does. No real document/database is used.
function fixture(status = 'completed') {
  let state: State = {
    personalAiJobs: [{ id: jobId, ownerId, userId, workspaceId, pageId, status,
      notificationHandledAt: null, updatedAt: new Date(), createdAt: new Date(),
      payload: { action: 'ask', instruction: 'private prompt', text: 'private document' },
      resultText: 'private result', errorCode: status === 'failed' ? 'interrupted' : null }],
    users: [{ id: ownerId, workspaceId: 'root', deletedAt: null, deactivatedAt: null },
      { id: userId, workspaceId, deletedAt: null, deactivatedAt: null }],
    spaces: [{ id: spaceId, workspaceId, deletedAt: null }],
    notifications: [],
  };
  let failInsert = false;
  let tail = Promise.resolve();
  const query = (table: string, operation: string, rows: State) => {
    const conditions: ((row: any) => boolean)[] = [];
    let values: any, patch: any, maximum = Infinity;
    const builder: any = {
      select: () => builder, selectAll: () => builder,
      forUpdate: () => builder, skipLocked: () => builder,
      orderBy: () => builder, returningAll: () => builder,
      limit: (value: number) => { maximum = value; return builder; },
      where: (key: string, operator: string, value: any) => {
        conditions.push((row) => operator === 'in' ? value.includes(row[key])
          : operator === '<' ? row[key] < value : operator === 'is' ? row[key] == value : row[key] === value);
        return builder;
      },
      values: (value: any) => { values = value; return builder; },
      set: (value: any) => { patch = value; return builder; },
      onConflict: () => builder,
      execute: async () => {
        if (operation === 'insert') {
          if (failInsert) throw new Error('Fixture notification store unavailable');
          if (rows[table].some((row) => row.id === values.id)) return [];
          rows[table].push({ ...values });
          return [{ ...values }];
        }
        const selected = rows[table].filter((row) => conditions.every((accept) => accept(row))).slice(0, maximum);
        if (operation === 'update') selected.forEach((row) => Object.assign(row, patch));
        return selected.map((row) => ({ ...row }));
      },
      executeTakeFirst: async () => (await builder.execute())[0],
    };
    return builder;
  };
  const connection = (rows: State) => ({
    selectFrom: (table: string) => query(table, 'select', rows),
    insertInto: (table: string) => query(table, 'insert', rows),
    updateTable: (table: string) => query(table, 'update', rows),
  });
  const db: any = {
    selectFrom: (table: string) => connection(state).selectFrom(table),
    updateTable: (table: string) => connection(state).updateTable(table),
    transaction: () => ({ execute: async (run: (tx: any) => Promise<any>) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const next = structuredClone(state);
      try { const result = await run(connection(next)); state = next; return result; }
      finally { release(); }
    } }),
  };
  const env: any = { isPersonalMode: () => true };
  const page: any = { id: pageId, workspaceId, spaceId, deletedAt: null };
  const user: any = { id: userId, workspaceId, accountId: ownerId };
  const permissions: any = { validateCanView: jest.fn(async () => undefined) };
  const personal: any = { assertOwner: jest.fn(), resolve: jest.fn(async () => ({ user, workspace: { id: workspaceId } })) };
  const users: any = { findById: jest.fn(async () => ({ id: ownerId, workspaceId: 'root' })) };
  const workspaces: any = { findById: jest.fn(async () => ({ id: 'root', deletedAt: null })) };
  const pages: any = { findById: jest.fn(async () => page) };
  const emit = jest.fn();
  const service = new NotificationService(new NotificationRepo(db, {} as any, env), {} as any,
    { server: { to: () => ({ emit }) } } as any, {} as any, db, env);
  const create = () => new PersonalAiNotificationsService(db, users, workspaces, pages, personal, permissions, service, env);
  const jobs = (notifier = create()) => new PersonalAiJobsService(db, {} as any, {} as any,
    pages, permissions, workspaces, users, personal, env, {} as any, notifier);
  return { db, create, jobs, env, page, user, permissions, personal, emit,
    state: () => state, failInsert: (value: boolean) => { failInsert = value; } };
}

describe('durable personal AI notifications', () => {
  it('does not notify before terminal persistence, then saves one scoped notification for concurrent/repeated delivery', async () => {
    const f = fixture('applying');
    await f.create().deliver(jobId);
    expect(f.state().notifications).toHaveLength(0);
    expect(f.state().personalAiJobs[0].notificationHandledAt).toBeNull();
    f.state().personalAiJobs[0].status = 'completed';
    await Promise.all([f.create().deliver(jobId), f.create().deliver(jobId)]);
    await f.create().deliver(jobId);
    expect(f.state().notifications).toHaveLength(1);
    expect(f.state().notifications[0]).toMatchObject({ id: jobId, userId, workspaceId, pageId, type: 'ai.completed' });
    expect(f.state().notifications[0].data).toEqual({ jobId, status: 'completed', action: 'ask', errorCode: null });
    expect(Number.isFinite(new Date(f.state().personalAiJobs[0].notificationHandledAt).getTime())).toBe(true);
    expect(f.permissions.validateCanView).toHaveBeenCalledWith(f.page, f.user);
  });

  it.each(['failed', 'conflict'])('persists a single %s outcome without prompts or generated text', async (status) => {
    const f = fixture(status);
    await f.create().recover();
    await f.create().recover();
    expect(f.state().notifications).toHaveLength(1);
    expect(f.state().notifications[0].type).toBe('ai.' + status);
    expect(JSON.stringify(f.state().notifications)).not.toContain('private');
  });

  it('leaves a failed notification pending without altering the AI result and recovers after a fresh service starts', async () => {
    const f = fixture();
    f.failInsert(true);
    await expect(f.create().notifySafely(jobId)).resolves.toBeUndefined();
    expect(f.state().personalAiJobs[0]).toMatchObject({ status: 'completed', notificationHandledAt: null });
    expect(f.state().notifications).toHaveLength(0);
    f.failInsert(false);
    f.emit.mockImplementation(() => { throw new Error('Browser disconnected'); });
    await f.create().recover();
    expect(f.state().notifications).toHaveLength(1);
    expect(f.state().personalAiJobs[0].status).toBe('completed');
    expect(f.state().personalAiJobs[0].notificationHandledAt).not.toBeNull();
  });

  it.each(['permission', 'workspace', 'page', 'space'])('suppresses delivery when %s access was removed', async (scope) => {
    const f = fixture();
    if (scope === 'permission') f.permissions.validateCanView.mockRejectedValue(new ForbiddenException());
    if (scope === 'workspace') f.personal.resolve.mockRejectedValue(new ForbiddenException());
    if (scope === 'page') f.page.deletedAt = new Date();
    if (scope === 'space') f.state().spaces[0].deletedAt = new Date();
    await f.create().deliver(jobId);
    expect(f.state().notifications).toHaveLength(0);
    expect(f.state().personalAiJobs[0].notificationHandledAt).not.toBeNull();
  });

  it('does not accept a different scoped user or recreate a reset/deleted job', async () => {
    const f = fixture();
    f.personal.resolve.mockResolvedValue({ user: { id: 'another-user' } });
    await f.create().deliver(jobId);
    expect(f.state().notifications).toHaveLength(0);
    f.state().personalAiJobs = [];
    await f.create().deliver(jobId);
    expect(f.state().notifications).toHaveLength(0);
  });

  it('refuses an existing unrelated notification identity without consuming the outbox', async () => {
    const f = fixture();
    f.state().notifications.push({ id: jobId, userId: 'different-user', type: 'page.reminder' });
    await expect(f.create().deliver(jobId)).rejects.toThrow('Notification identity conflict');
    expect(f.state().personalAiJobs[0].notificationHandledAt).toBeNull();
    expect(f.state().notifications[0].userId).toBe('different-user');
  });

  it('recovers terminal notification delivery when a duplicate queue task only sees a completed job', async () => {
    const f = fixture();
    await f.jobs().process(jobId);
    await f.jobs().process(jobId);
    expect(f.state().notifications).toHaveLength(1);
  });

  it('does not mark a fresh in-flight generation failed when a duplicate queue delivery arrives', async () => {
    const f = fixture('generating');
    await f.jobs().process(jobId);
    expect(f.state().personalAiJobs[0].status).toBe('generating');
    expect(f.state().notifications).toHaveLength(0);
  });

  it('marks abandoned inference failed and delivers its durable outcome during recovery', async () => {
    const f = fixture('generating');
    f.state().personalAiJobs[0].updatedAt = new Date(Date.now() - 11 * 60_000);
    await f.jobs().recover();
    expect(f.state().personalAiJobs[0].status).toBe('failed');
    expect(f.state().notifications[0]).toMatchObject({ type: 'ai.failed', data: { errorCode: 'interrupted' } });
  });

  it('retrieves an older selected job only within the authenticated owner/workspace/page identity', async () => {
    const f = fixture();
    const selected = await f.jobs().list(f.user, pageId, jobId);
    expect(selected.items).toHaveLength(1);
    expect((await f.jobs().list(f.user, pageId, 'unavailable-id')).items).toHaveLength(0);
    f.state().personalAiJobs[0].ownerId = 'another-owner';
    expect((await f.jobs().list(f.user, pageId, jobId)).items).toHaveLength(0);
  });
});
