import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RealtimeSessionAccess, RealtimeSessionIdentity } from './realtime-session-access';
import { TokenService } from '../auth/services/token.service';
import { AuthenticationExtension } from '../../collaboration/extensions/authentication.extension';

const account = { id: 'owner', workspaceId: 'root', role: 'owner', email: 'fixture@example.test' };
const scoped = { id: 'profile', workspaceId: 'secondary', role: 'owner' };
const workspace = { id: 'root' };
const identity = (): RealtimeSessionIdentity => ({ sessionId: 'session', accountId: 'owner', accountWorkspaceId: 'root', userId: 'profile', workspaceId: 'secondary', expiresAt: Date.now() + 60000 });

function fixture() {
  let active = true;
  const sessions = { findActiveById: jest.fn(async () => active ? { userId: 'owner', workspaceId: 'root' } : undefined) };
  const users = { findById: jest.fn(async (id: string) => id === 'owner' ? account : scoped) };
  const workspaces = { findById: jest.fn(async () => workspace) };
  const personal = {
    enabled: () => true,
    resolve: jest.fn(async () => ({ user: scoped, workspace: { id: 'secondary' } })),
    validateCollaborationUser: jest.fn(),
  };
  const service = new RealtimeSessionAccess(sessions as any, users as any, workspaces as any, personal as any);
  return { service, sessions, users, workspaces, personal, revoke: () => { active = false; } };
}

describe('canonical login sessions protect realtime connections', () => {
  it('allows only an explicitly bound workspace profile and active canonical session', async () => {
    const f = fixture(); await expect(f.service.assertActive(identity())).resolves.toBe(scoped);
    f.sessions.findActiveById.mockResolvedValue({ userId: 'another-owner', workspaceId: 'root' });
    await expect(f.service.assertActive(identity())).rejects.toThrow(UnauthorizedException);
  });
  it.each(['sessionId', 'accountId', 'accountWorkspaceId', 'userId', 'workspaceId'])('rejects missing %s before a database lookup', async key => {
    const f = fixture(); const claims = identity(); delete claims[key];
    await expect(f.service.assertActive(claims)).rejects.toThrow(UnauthorizedException);
    expect(f.sessions.findActiveById).not.toHaveBeenCalled();
  });
  it('rejects expired claims and a removed workspace binding', async () => {
    const f = fixture(); await expect(f.service.assertActive({ ...identity(), expiresAt: Date.now() - 1 })).rejects.toThrow();
    f.personal.resolve.mockRejectedValue(new UnauthorizedException());
    await expect(f.service.assertActive(identity())).rejects.toThrow();
  });
  it('disconnects every idle connection after revocation, including multiplexed document connections', async () => {
    const f = fixture(), first = jest.fn(), second = jest.fn();
    f.service.track({}, identity, first); f.service.track({}, identity, second);
    await f.service.checkConnections(); expect(first).not.toHaveBeenCalled();
    f.revoke(); await f.service.checkConnections(); expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
    await f.service.checkConnections(); expect(first).toHaveBeenCalledTimes(1);
  });
  it('removes disconnected clients and fails closed when session storage is unavailable', async () => {
    const f = fixture(), key = {}, removed = jest.fn(), failed = jest.fn();
    f.service.track(key, identity, removed); f.service.untrack(key); f.service.track({}, identity, failed);
    f.sessions.findActiveById.mockRejectedValue(new Error('database unavailable'));
    await f.service.checkConnections(); expect(removed).not.toHaveBeenCalled(); expect(failed).toHaveBeenCalledTimes(1);
  });
  it('rejects sessionless collab credentials, then rejects both reconnects and messages after revocation', async () => {
    const f = fixture();
    const jwt = new JwtService({ secret: 'isolated-realtime-fixture-secret-32-characters' });
    const tokens = new TokenService(jwt, { getAppSecret: () => 'isolated-realtime-fixture-secret-32-characters' } as any);
    const pages = { findById: async () => ({ id: 'page', spaceId: 'space' }) };
    const members = { getUserSpaceRoles: async () => [{ role: 'writer' }] };
    const permissions = { canUserEditPage: async () => ({ hasAnyRestriction: false }) };
    const auth = new AuthenticationExtension(tokens, f.users as any, pages as any, members as any, permissions as any, f.personal as any, f.service);
    const data: any = { documentName: 'page', connectionConfig: {} };
    data.token = jwt.sign({ sub: 'profile', workspaceId: 'secondary', type: 'collab' }, { expiresIn: '24h' });
    await expect(auth.onAuthenticate(data)).rejects.toThrow(UnauthorizedException);
    data.token = await tokens.generateCollabToken(scoped as any, 'secondary', account as any, 'session');
    const context = await auth.onAuthenticate(data); expect(context.realtimeSession.accountId).toBe('owner');
    await expect(auth.beforeHandleMessage({ context } as any)).resolves.toBeUndefined();
    f.revoke(); await expect(auth.beforeHandleMessage({ context } as any)).rejects.toThrow(UnauthorizedException);
    await expect(auth.onAuthenticate(data)).rejects.toThrow(UnauthorizedException);
  });
  it('does not allow a refreshed token to change the session or workspace identity', async () => {
    const f = fixture(); const claims = { ...identity(), sub: 'profile', type: 'collab', exp: Math.floor(Date.now() / 1000) + 60 };
    const auth = new AuthenticationExtension({ verifyJwt: async () => ({ ...claims, sessionId: 'different' }) } as any, {} as any, {} as any, {} as any, {} as any, f.personal as any, f.service);
    await expect(auth.onTokenSync({ token: 'fixture', context: { realtimeSession: identity() } } as any)).rejects.toThrow('identity cannot change');
  });
});
