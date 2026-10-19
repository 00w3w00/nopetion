import { WsGateway } from './ws.gateway';

describe('realtime messages await socket authentication', () => {
  it('waits for asynchronous authentication before accepting the first tree event', async () => {
    let authenticate: (value: any) => void;
    const token = new Promise(resolve => { authenticate = resolve; });
    const client: any = { connected: true, handshake: { headers: { cookie: 'authToken=fixture' } }, data: {}, join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
    const events = { isTreeEvent: () => true, handleTreeEvent: jest.fn() };
    const access = { assertActive: jest.fn(async identity => { if (!identity?.sessionId) throw new Error('unauthenticated'); }), track: jest.fn() };
    const gateway = new WsGateway({ verifyJwt: () => token } as any, { getUserSpaceIds: async () => [] } as any,
      events as any, {} as any, { enabled: () => false } as any, {} as any, {} as any, {} as any, access as any);
    const connection = gateway.handleConnection(client);
    const message = gateway.handleMessage(client, { event: 'tree' });
    expect(events.handleTreeEvent).not.toHaveBeenCalled();
    authenticate({ sub: 'owner', workspaceId: 'root', sessionId: 'session', exp: Math.floor(Date.now() / 1000) + 60 });
    await Promise.all([connection, message]);
    expect(events.handleTreeEvent).toHaveBeenCalledWith(client, { event: 'tree' });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('rejects a message immediately if its established login session was revoked', async () => {
    const client: any = { data: { realtimeSession: { sessionId: 'revoked' } }, emit: jest.fn(), disconnect: jest.fn() };
    const events = { isTreeEvent: () => true, handleTreeEvent: jest.fn() };
    const gateway = new WsGateway({} as any, {} as any, events as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, { assertActive: async () => { throw new Error('revoked'); } } as any);
    await gateway.handleMessage(client, { event: 'tree' });
    expect(events.handleTreeEvent).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
