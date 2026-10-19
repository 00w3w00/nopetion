import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PersonalWorkspaceAccess, personalUser } from './personal-workspace-access.service';
import { CreatePersonalWorkspaceDto } from './personal-workspace.controller';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtType } from '../auth/dto/jwt-payload';

const rootId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const owner: any = { id: rootId, workspaceId: rootId, role: 'owner', name: 'Owner', email: 'owner@test.local', locale: 'ko-KR', settings: { preferences: { fullPageWidth: true } } };
const original: any = { id: rootId };
const scoped: any = { id: targetId, workspaceId: targetId, role: 'owner', name: 'Old name', email: 'old@test.local' };
const target: any = { id: targetId };

describe('personal workspace owner binding', () => {
  let access: PersonalWorkspaceAccess;
  let query: any, users: any, workspaces: any, env: any;
  beforeEach(() => {
    query = { select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), executeTakeFirst: jest.fn().mockResolvedValue({ userId: targetId }) };
    users = { findById: jest.fn().mockResolvedValue(scoped) };
    workspaces = { findById: jest.fn().mockResolvedValue(target) };
    env = { isPersonalMode: () => true, isSelfHosted: () => true };
    access = new PersonalWorkspaceAccess({ selectFrom: () => query } as any, users, workspaces, env);
  });
  it('keeps the original owner and workspace when no selection is given', async () => {
    expect(await access.resolve(owner, original)).toEqual({ user: personalUser(owner, owner), workspace: original });
    expect(users.findById).not.toHaveBeenCalled();
  });
  it('uses explicit owner binding and a distinct permission identity', async () => {
    const result = await access.resolve(owner, original, targetId);
    expect(query.where).toHaveBeenCalledWith('ownerId', '=', rootId);
    expect(result.user).toMatchObject({ id: targetId, workspaceId: targetId, accountId: rootId, name: owner.name, email: owner.email, locale: owner.locale });
    expect(result.user.settings).toEqual(owner.settings);
    expect(result.workspace.id).toBe(targetId);
  });
  it('refuses an unlinked workspace even if the email is identical', async () => {
    query.executeTakeFirst.mockResolvedValue(undefined);
    await expect(access.resolve(owner, original, targetId)).rejects.toBeInstanceOf(NotFoundException);
    expect(users.findById).not.toHaveBeenCalled();
  });
  it.each([{ deletedAt: new Date() }, { deactivatedAt: new Date() }, { role: 'member' }])('refuses an unavailable scoped owner: %p', async extra => {
    users.findById.mockResolvedValue({ ...scoped, ...extra });
    await expect(access.resolve(owner, original, targetId)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('refuses deleted workspaces', async () => {
    workspaces.findById.mockResolvedValue({ ...target, deletedAt: new Date() });
    await expect(access.resolve(owner, original, targetId)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each(['member', 'admin'])('does not allow %s to create or switch', role => {
    expect(() => access.assertOwner({ ...owner, role })).toThrow(ForbiddenException);
  });
  it('does not enable this CE feature for cloud or nonpersonal instances', () => {
    env.isSelfHosted = () => false;
    expect(() => access.assertOwner(owner)).toThrow(ForbiddenException);
    env.isSelfHosted = () => true; env.isPersonalMode = () => false;
    expect(() => access.assertOwner(owner)).toThrow(ForbiddenException);
  });
  it('rejects malformed selection before database access', async () => {
    await expect(access.resolve(owner, original, 'not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    expect(query.where).not.toHaveBeenCalled();
  });
});

describe('workspace selection after session authentication', () => {
  let strategy: JwtStrategy, access: any, sessions: any, req: any;
  const payload: any = { sub: rootId, workspaceId: rootId, type: JwtType.ACCESS, sessionId: 'session' };
  beforeEach(() => {
    access = { enabled: () => true, requestTarget: jest.fn().mockResolvedValue(targetId), resolve: jest.fn().mockResolvedValue({ user: personalUser(owner, scoped), workspace: target }) };
    sessions = { findActiveById: jest.fn().mockResolvedValue({ userId: rootId, workspaceId: rootId }) };
    strategy = new JwtStrategy({ findById: async () => owner } as any,
      { findById: async () => original } as any, sessions,
      { trackActivity: jest.fn() } as any, { getAppSecret: () => 'test-secret' } as any, {} as any, access);
    req = { raw: { workspaceId: rootId, workspace: original }, cookies: {} };
  });
  it('keeps account/session identity while changing document permission identity', async () => {
    const result = await strategy.validate(req, payload);
    expect(result.accountUser.id).toBe(rootId);
    expect(result.accountWorkspace.id).toBe(rootId);
    expect(result.user.id).toBe(targetId);
    expect(req.raw.workspaceId).toBe(targetId);
    expect(req.raw.workspace.id).toBe(targetId);
    expect(req.raw.sessionId).toBe('session');
  });
  it('never resolves a selected workspace for a revoked session', async () => {
    sessions.findActiveById.mockResolvedValue(undefined);
    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(access.resolve).not.toHaveBeenCalled();
  });
  it('never authenticates a session owned by another account', async () => {
    sessions.findActiveById.mockResolvedValue({ userId: targetId, workspaceId: rootId });
    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(access.resolve).not.toHaveBeenCalled();
  });
  it('does not accept collaboration tokens as account sessions', async () => {
    await expect(strategy.validate(req, { ...payload, type: JwtType.COLLAB })).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('preserves the self-hosted login workspace check', async () => {
    await expect(strategy.validate(req, { ...payload, workspaceId: targetId })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(access.resolve).not.toHaveBeenCalled();
  });
  it('does not fall back to the first workspace after an unauthorized selection', async () => {
    access.resolve.mockRejectedValue(new NotFoundException());
    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('personal workspace creation validation', () => {
  it.each(['', '   ', 'x'.repeat(65), 42])('rejects invalid names: %p', async name => {
    const dto = plainToInstance(CreatePersonalWorkspaceDto, { name, creationKey: rootId });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('requires a retry identity and trims a valid Korean name', async () => {
    const dto = plainToInstance(CreatePersonalWorkspaceDto, { name: '  개인 문서  ', creationKey: rootId });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('개인 문서');
    dto.creationKey = 'invalid';
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
