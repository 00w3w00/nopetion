import { PageAccessService } from './page-access.service';
import { PagePermissionRepo } from '../../../database/repos/page/page-permission.repo';
import { SpaceMemberRepo } from '../../../database/repos/space/space-member.repo';
import { ForbiddenException } from '@nestjs/common';

describe('fresh authorization for export and offline reconnection', () => {
  const page: any = { id: 'page', spaceId: 'space', workspaceId: 'workspace' };
  const user: any = { id: 'owner', workspaceId: 'workspace' };
  function fixture() {
    const permissions: any = { canUserAccessPage: jest.fn(async () => true), canUserEditPage: jest.fn(async () => ({ hasAnyRestriction: false, canAccess: true, canEdit: true })) };
    const abilities: any = { createForUser: jest.fn(async () => ({ cannot: () => false, can: () => true })) };
    const spaces: any = { findById: jest.fn(async () => ({ id: 'space' })) };
    return { permissions, abilities, spaces, service: new PageAccessService(permissions, abilities, spaces) };
  }
  it('preserves the ordinary cached call contract', async () => {
    const f = fixture(); await f.service.validateCanView(page, user);
    expect(f.abilities.createForUser).toHaveBeenCalledWith(user, 'space');
    expect(f.permissions.canUserAccessPage).toHaveBeenCalledWith('owner', 'page');
    expect(f.spaces.findById).not.toHaveBeenCalled();
  });
  it('rechecks space membership and page ACL for a fresh read', async () => {
    const f = fixture(); await f.service.validateCanView(page, user, true);
    expect(f.spaces.findById).toHaveBeenCalledWith('space', 'workspace');
    expect(f.abilities.createForUser).toHaveBeenCalledWith(user, 'space', true);
    expect(f.permissions.canUserAccessPage).toHaveBeenCalledWith('owner', 'page', true);
  });
  it('does not trust role rows in a deleted Space', async () => {
    const f = fixture(); f.spaces.findById.mockResolvedValue({ deletedAt: new Date() });
    await expect(f.service.validateCanView(page, user, true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.permissions.canUserAccessPage).not.toHaveBeenCalled();
  });
  it('bypasses a cached page allow when source permissions were revoked', async () => {
    const cached = { hasAnyRestriction: false, canAccess: true, canEdit: true };
    const cache: any = { get: jest.fn(async () => ({ v: cached })), set: jest.fn() };
    const executeQuery = jest.fn(async () => ({ rows: [{ canAccess: false, canEdit: false }] }));
    const db: any = { getExecutor: () => ({ transformQuery: (n: any) => n, compileQuery: () => ({}), executeQuery }) };
    const repo = new PagePermissionRepo(db, {} as any, cache);
    expect(await repo.canUserEditPage('owner', 'page')).toBe(cached);
    expect(executeQuery).not.toHaveBeenCalled();
    expect(await repo.canUserEditPage('owner', 'page', true)).toEqual({ hasAnyRestriction: true, canAccess: false, canEdit: false });
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });
  it('bypasses a cached space role when the membership was removed', async () => {
    const cache: any = { get: jest.fn(async () => ({ v: [{ userId: 'owner', role: 'admin' }] })), set: jest.fn() };
    const query: any = { select: () => query, where: () => query, unionAll: () => query, innerJoin: () => query, execute: jest.fn(async () => []) };
    const repo = new SpaceMemberRepo({ selectFrom: () => query } as any, {} as any, {} as any, cache);
    expect(await repo.getUserSpaceRoles('owner', 'space')).toHaveLength(1);
    expect(await repo.getUserSpaceRoles('owner', 'space', true)).toBeUndefined();
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(query.execute).toHaveBeenCalledTimes(1);
  });
});
