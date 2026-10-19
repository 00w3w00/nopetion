import { FastifyAdapter } from '@nestjs/platform-fastify';
import { redactSensitiveUrl } from './utils';
import { createPinoConfig } from '../logger/pino.config';

describe('proxy identity and OAuth log privacy', () => {
  it('ignores attacker-controlled forwarding headers from direct callers', async () => {
    const adapter = new FastifyAdapter({ trustProxy: false }); const app = adapter.getInstance();
    app.get('/fixture', async req => ({ ip: req.ip }));
    try {
      for (const forwarded of ['198.51.100.1', '192.0.2.2, 198.51.100.3']) {
        const response = await app.inject({ method: 'GET', url: '/fixture', remoteAddress: '203.0.113.10', headers: { 'x-forwarded-for': forwarded } });
        expect(response.json()).toEqual({ ip: '203.0.113.10' });
      }
    } finally { await app.close(); }
  });
  it.each(['github', 'google-drive', 'notion'])('removes %s callback query material from the actual logger serializer', provider => {
    const url = `/nopetion/api/personal-connectors/callback/${provider}?code=fixture-secret&state=fixture-state`;
    const config: any = createPinoConfig(); const req = config.pinoHttp.serializers.req({ method: 'GET', url, headers: {} });
    expect(req.url).toBe(url.split('?')[0]); expect(JSON.stringify(req)).not.toContain('fixture-secret');
  });
  it.each(['token', '%74oken', 'ACCESS_TOKEN', 'refresh_token', 'id_token', 'jwt', 'code', 'state'])('redacts sensitive query name %s outside callback routes', key => {
    expect(redactSensitiveUrl(`/api/fixture?${key}=secret&other=1`)).toBe('/api/fixture');
  });
  it('retains harmless query parameters', () => expect(redactSensitiveUrl('/api/pages/info?pageId=fixture')).toBe('/api/pages/info?pageId=fixture'));
});
