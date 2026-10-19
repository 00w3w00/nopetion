import { SessionService } from './session.service';
import { AuditContextMiddleware, AUDIT_CONTEXT_KEY } from '../../common/middlewares/audit-context.middleware';

describe('login session IP metadata', () => {
  it.each(['', 'not-an-ip', null])('stores null instead of an invalid inet value: %s', async ipAddress => {
    const sessions = { insertSession: jest.fn(async (_input: any) => ({ id: 'session' })) };
    const service = new SessionService({ generateAccessToken: () => 'token' } as any, sessions as any,
      { getCookieExpiresIn: () => new Date(Date.now() + 60000) } as any, { get: () => ({ ipAddress }) } as any);
    await expect(service.createSessionAndToken({ id: 'owner', workspaceId: 'root' } as any)).resolves.toBe('token');
    expect(sessions.insertSession.mock.calls[0][0].ipAddress).toBeNull();
  });
  it.each(['127.0.0.1', '::1', '::ffff:172.19.0.1'])('records the actual socket address and ignores supplied IP headers: %s', remoteAddress => {
    const cls = { set: jest.fn() }, middleware = new AuditContextMiddleware(cls as any), next = jest.fn();
    middleware.use({ socket: { remoteAddress }, ip: '', headers: { 'x-forwarded-for': '203.0.113.10', 'x-client-ip': '198.51.100.1' } } as any, {} as any, next);
    expect(cls.set).toHaveBeenCalledWith(AUDIT_CONTEXT_KEY, expect.objectContaining({ ipAddress: remoteAddress }));
    expect(next).toHaveBeenCalled();
  });
});
