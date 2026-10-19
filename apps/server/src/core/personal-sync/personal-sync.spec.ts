import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PersonalSyncService } from './personal-sync.service';
import { UserController } from '../user/user.controller';

describe('offline title synchronization', () => {
  function fixture() {
    const page: any = { id: 'page', workspaceId: 'workspace', title: 'remote', isLocked: false, updatedAt: new Date('2026-10-18T00:00:00Z') };
    const committed = { id: 'page', title: 'local', updatedAt: new Date() };
    function builder(result: unknown) {
      const q: any = { select: () => q, where: () => q, set: () => q, returning: () => q,
        executeTakeFirst: jest.fn(async () => result) };
      return q;
    }
    const query = builder(page), update = builder(committed);
    const trx: any = { selectFrom: () => query, updateTable: () => update, executeQuery: async () => ({ rows: [] }),
      getExecutor: () => ({ transformQuery: (n: any) => n, compileQuery: () => ({}), executeQuery: async () => ({ rows: [] }) }) };
    const db: any = { transaction: () => ({ execute: (fn: any) => fn(trx) }) };
    const personal: any = { assertOwner: jest.fn(), validateCollaborationUser: jest.fn() };
    const permissions: any = { validateCanEdit: jest.fn() };
    const events: any = { emit: jest.fn() };
    const pages: any = { findById: jest.fn(async () => page) };
    const service = new PersonalSyncService(db, pages, permissions, personal, events);
    const user: any = { id: 'user', workspaceId: 'workspace' };
    const dto: any = { pageId: 'page', title: 'local', expectedTitle: 'remote', expectedUpdatedAt: page.updatedAt.toISOString() };
    return { service, dto, user, page, pages, permissions, personal, events, update };
  }
  it('requires a personal owner before reading or changing a document', async () => {
    const f = fixture(); f.personal.assertOwner.mockImplementation(() => { throw new ForbiddenException(); });
    await expect(f.service.title(f.dto, f.user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.pages.findById).not.toHaveBeenCalled();
  });
  it.each(['missing', 'workspace', 'deleted'])('does not accept an unavailable %s document', async mode => {
    const f = fixture();
    if (mode === 'missing') f.pages.findById.mockResolvedValue(null);
    if (mode === 'workspace') f.page.workspaceId = 'another-workspace';
    if (mode === 'deleted') f.page.deletedAt = new Date();
    await expect(f.service.title(f.dto, f.user)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.update.executeTakeFirst).not.toHaveBeenCalled();
  });
  it('preserves a locked document', async () => {
    const f = fixture(); f.page.isLocked = true;
    await expect(f.service.title(f.dto, f.user)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('preserves remote changes if the atomic comparison fails', async () => {
    const f = fixture(); f.update.executeTakeFirst.mockResolvedValue(undefined);
    await expect(f.service.title(f.dto, f.user)).rejects.toBeInstanceOf(ConflictException);
    expect(f.events.emit).not.toHaveBeenCalled();
    expect(f.page.title).toBe('remote');
  });
  it('reports saved only after the DB update completed', async () => {
    const f = fixture();
    expect(await f.service.title(f.dto, f.user)).toMatchObject({ title: 'local', saved: true, replay: false });
    expect(f.permissions.validateCanEdit).toHaveBeenCalledWith(f.page, f.user, true);
    expect(f.events.emit).toHaveBeenCalledTimes(1);
  });
  it('acknowledges an identical retry without writing or emitting again', async () => {
    const f = fixture(); f.page.title = 'local';
    expect(await f.service.title(f.dto, f.user)).toMatchObject({ title: 'local', saved: true, replay: true });
    expect(f.update.executeTakeFirst).not.toHaveBeenCalled();
    expect(f.events.emit).not.toHaveBeenCalled();
  });
  it('rechecks fresh permissions after waiting for the title lock', async () => {
    const f = fixture();
    f.permissions.validateCanEdit.mockResolvedValueOnce({ hasRestriction: false }).mockRejectedValueOnce(new ForbiddenException());
    await expect(f.service.title(f.dto, f.user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.permissions.validateCanEdit).toHaveBeenCalledTimes(2);
    expect(f.update.executeTakeFirst).not.toHaveBeenCalled();
    expect(f.events.emit).not.toHaveBeenCalled();
  });
  it('refuses an offline connection gate without fresh edit permission', async () => {
    const f = fixture();
    (f.permissions as any).validateCanViewWithPermissions = jest.fn(async () => ({ canEdit: false, hasRestriction: true }));
    await expect(f.service.access('page', f.user)).rejects.toBeInstanceOf(ForbiddenException);
    expect((f.permissions as any).validateCanViewWithPermissions).toHaveBeenCalledWith(f.page, f.user, true);
  });
  it('returns the canonical account separately from a scoped workspace profile', async () => {
    const controller = new UserController({} as any, { getActiveUserCount: async () => 1 } as any);
    const result = await controller.getUserInfo({ id: 'scoped' } as any, { id: 'workspace', licenseKey: 'never-return' } as any, { id: 'owner' } as any);
    expect(result.accountId).toBe('owner');
    expect(result.user.id).toBe('scoped');
    expect(result.workspace).not.toHaveProperty('licenseKey');
  });
});
