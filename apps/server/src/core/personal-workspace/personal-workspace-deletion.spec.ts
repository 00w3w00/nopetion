import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PersonalWorkspaceService } from './personal-workspace.service';
import { PersonalWorkspaceAccess } from './personal-workspace-access.service';
import { DeletePersonalWorkspaceDto, ResetPersonalWorkspaceDto } from './personal-workspace.controller';
import { PersonalWorkspaceReset } from './personal-workspace-reset.service';
import { PersonalWorkspaceCleanup } from './personal-workspace-cleanup.service';
import { AuthenticationExtension } from '../../collaboration/extensions/authentication.extension';
import { hashPassword } from '../../common/helpers';

const root = '11111111-1111-4111-8111-111111111111', child = '22222222-2222-4222-8222-222222222222';
const owner: any = { id: root, workspaceId: root, role: 'owner', email: 'owner@test.local' };
const chain = () => {
  const q: any = {};
  for (const name of ['select', 'selectAll', 'where', 'forUpdate', 'set', 'orderBy', 'innerJoin', 'limit']) q[name] = jest.fn().mockReturnValue(q);
  return q;
};

describe('owner-only workspace deletion and restoration', () => {
  let service: PersonalWorkspaceService, db: any, target: any, write: any, events: any;
  beforeEach(() => {
    const account = chain(); account.executeTakeFirstOrThrow = jest.fn().mockResolvedValue(owner);
    target = chain(); target.executeTakeFirst = jest.fn().mockResolvedValue({ id: child, name: 'Work', deletedAt: null });
    write = chain(); write.execute = jest.fn().mockResolvedValue({});
    db = { selectFrom: jest.fn((table: string) => table === 'users' ? account : target), updateTable: jest.fn(() => write) };
    db.transaction = () => ({ execute: (fn: any) => fn(db) });
    const access = new PersonalWorkspaceAccess(db, {} as any, {} as any, { isPersonalMode: () => true, isSelfHosted: () => true } as any);
    events = { emitAsync: jest.fn().mockResolvedValue([]) };
    service = new PersonalWorkspaceService(db, access, {} as any, events);
  });
  it('protects the original account workspace before mutation', async () => {
    await expect(service.delete(owner, root, 'Work')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.updateTable).not.toHaveBeenCalled(); expect(events.emitAsync).not.toHaveBeenCalled();
  });
  it('cannot delete an unlinked workspace and filters by the canonical owner', async () => {
    target.executeTakeFirst.mockResolvedValue(undefined);
    await expect(service.delete(owner, child, 'Work')).rejects.toBeInstanceOf(NotFoundException);
    expect(target.where).toHaveBeenCalledWith('binding.ownerId', '=', root);
    expect(db.updateTable).not.toHaveBeenCalled();
  });
  it('rejects an outdated or incorrect confirmation name without revoking connections', async () => {
    await expect(service.delete(owner, child, 'Old name')).rejects.toBeInstanceOf(ConflictException);
    expect(db.updateTable).not.toHaveBeenCalled(); expect(events.emitAsync).not.toHaveBeenCalled();
  });
  it('records deletion and revokes only the selected workspace after the transaction', async () => {
    expect(await service.delete(owner, child, 'Work')).toEqual({ id: child, fallbackWorkspaceId: root });
    expect(write.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
    expect(write.where).toHaveBeenCalledWith('id', '=', child);
    expect(events.emitAsync).toHaveBeenCalledWith('personal-workspace.deleted', { workspaceId: child });
  });
  it('keeps repeated deletion idempotent', async () => {
    target.executeTakeFirst.mockResolvedValue({ id: child, name: 'Work', deletedAt: new Date() });
    await service.delete(owner, child, 'Work'); expect(db.updateTable).not.toHaveBeenCalled();
  });
  it('restores the workspace without deleting or recreating its documents', async () => {
    target.executeTakeFirst.mockResolvedValue({ id: child, name: 'Work', deletedAt: new Date() });
    await service.restore(owner, child); expect(write.set).toHaveBeenCalledWith({ deletedAt: null });
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});

describe('destructive action confirmation validation', () => {
  it.each([{}, { workspaceId: 'invalid', confirmationName: 'Work' }, { workspaceId: child, confirmationName: '' }])('rejects incomplete deletion: %p', async input => {
    expect((await validate(plainToInstance(DeletePersonalWorkspaceDto, input))).length).toBeGreaterThan(0);
  });
  it.each([{ confirmation: 'reset' }, { confirmationPassword: '' }, { confirmationPassword: undefined }, { confirmationPassword: 123 }, { requestId: undefined }])('requires exact reset text, current password and retry identity: %p', async extra => {
    const dto = plainToInstance(ResetPersonalWorkspaceDto, { confirmation: 'RESET', confirmationPassword: 'a', requestId: child, ...extra });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('reset safeguards', () => {
  let credential: string;
  beforeAll(async () => { credential = await hashPassword('a', true); });
  it('rejects the wrong password before reading or modifying documents', async () => {
    const account = chain(); account.executeTakeFirstOrThrow = jest.fn().mockResolvedValue({ ...owner, password: credential });
    const db: any = { selectFrom: jest.fn(() => account) }; db.transaction = () => ({ execute: (fn: any) => fn(db) });
    const reset = new PersonalWorkspaceReset(db, { assertOwner: jest.fn() } as any, {} as any, {} as any, {} as any);
    await expect(reset.reset(owner, 'wrong', child)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.selectFrom).toHaveBeenCalledTimes(1);
  });
  it('does not erase new documents when a completed reset request is retried', async () => {
    const account = chain(); account.executeTakeFirstOrThrow = jest.fn().mockResolvedValue({ ...owner, password: credential });
    const prior = chain(); prior.executeTakeFirst = jest.fn().mockResolvedValue({ requestId: child });
    const db: any = { selectFrom: jest.fn((table: string) => table === 'users' ? account : prior) }; db.transaction = () => ({ execute: (fn: any) => fn(db) });
    const events = { emitAsync: jest.fn() }, cleanup = { drain: jest.fn().mockResolvedValue(0) };
    const reset = new PersonalWorkspaceReset(db, { assertOwner: jest.fn() } as any, {} as any, cleanup as any, events as any);
    expect(await reset.reset(owner, 'a', child)).toEqual({ fallbackWorkspaceId: root, cleanupPending: 0 });
    expect(db.selectFrom).toHaveBeenCalledTimes(2); expect(events.emitAsync).not.toHaveBeenCalled();
  });
  it('keeps failed physical file deletions in the durable outbox for later retry', async () => {
    const read = chain(); read.execute = jest.fn().mockResolvedValue([{ id: child, filePath: root + '/files/test.png' }]); read.executeTakeFirst = jest.fn().mockResolvedValue({ count: 1 });
    const db: any = { selectFrom: () => read, deleteFrom: jest.fn() };
    const storage = { delete: jest.fn().mockRejectedValue(new Error('disk unavailable')) };
    expect(await new PersonalWorkspaceCleanup(db, storage as any).drain(root)).toBe(1);
    expect(db.deleteFrom).not.toHaveBeenCalled();
  });
  it('checks existing collaboration connections again before accepting edits', async () => {
    const access = { validateCollaborationUser: jest.fn().mockRejectedValue(new NotFoundException()) };
    const auth = new AuthenticationExtension({} as any, {} as any, {} as any, {} as any, {} as any, access as any, { assertActive: jest.fn() } as any);
    await expect(auth.beforeHandleMessage({ context: { user: owner } } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(access.validateCollaborationUser).toHaveBeenCalledWith(owner);
  });
});
