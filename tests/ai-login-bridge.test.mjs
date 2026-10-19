import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { bridgeConfiguration, createAiLoginBridge } from '../scripts/ai-login-bridge.mjs';

test('bridge upstream and mount cannot select external hosts or protocols', () => {
  for (const upstream of ['https://127.0.0.1:3000', 'http://localhost:3000', 'http://remote.example:3000', 'http://u:p@127.0.0.1:3000', 'http://127.0.0.1:3000/path'])
    assert.throws(() => bridgeConfiguration({ upstream }));
  assert.throws(() => bridgeConfiguration({ upstream: 'http://127.0.0.1:3000', mount: '//evil.example' }));
});
test('loopback bridge strips only the mount, preserves state/cookie headers and refuses cross-site writes', async t => {
  const requests = [];
  const upstream = http.createServer((req, res) => {
    requests.push({ url: req.url, host: req.headers.host, cookie: req.headers.cookie });
    res.writeHead(200, { 'Set-Cookie': 'fixture=one; HttpOnly; Secure; Path=/nopetion', 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: req.url }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const { server } = createAiLoginBridge({ upstream: `http://127.0.0.1:${upstream.address().port}`, mount: '/nopetion', port: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.stopBridge(); upstream.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin + '/nopetion/api/personal-ai/status', { method: 'POST', headers: { Origin: origin, Cookie: 'fixture=one' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), 'fixture=one; HttpOnly; Secure; Path=/nopetion');
  assert.deepEqual(await response.json(), { url: '/api/personal-ai/status' });
  assert.equal(requests[0].host, new URL(origin).host);
  assert.equal((await fetch(origin + '/nopetion/api/personal-ai/sign-in', { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
  const forgedHost = await new Promise((resolve, reject) => {
    const request = http.request(origin + '/nopetion/api/personal-ai/sign-in', { method: 'POST', headers: { Host: 'other.example' } }, result => {
      result.resume(); resolve(result.statusCode);
    }); request.on('error', reject); request.end();
  });
  assert.equal(forgedHost, 403);
  assert.equal((await fetch(origin + '/api/personal-ai/callback?state=fixture', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal(requests.at(-1).url, '/api/personal-ai/callback?state=fixture');
  assert.equal(requests.length, 2);
});
