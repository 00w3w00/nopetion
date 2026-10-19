#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function bridgeConfiguration({ upstream, mount = '', port = 31415 }) {
  const target = new URL(upstream);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password
    || target.pathname !== '/' || target.search || target.hash) throw Error('Upstream must be an HTTP numeric loopback SSH tunnel');
  const prefix = mount === '/' ? '' : mount.replace(/\/$/, '');
  if (prefix && (!/^\/(?:[a-zA-Z0-9_.~-]+\/)*[a-zA-Z0-9_.~-]+$/.test(prefix)
    || prefix.split('/').some(part => part === '.' || part === '..'))) throw Error('Invalid app mount path');
  const selected = Number(port);
  if (!Number.isInteger(selected) || selected < 0 || selected > 65535) throw Error('Invalid local port');
  return { target, prefix, port: selected };
}

export function createAiLoginBridge(options) {
  const config = bridgeConfiguration(options), upgraded = new Set();
  const server = http.createServer();
  function destination(req, websocket = false) {
    const port = server.address()?.port || config.port;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return null;
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) return null;
    const pathname = req.url.split('?')[0];
    const callback = !websocket && req.method === 'GET' && pathname === '/api/personal-ai/callback';
    const origin = 'http://' + req.headers.host;
    if (!callback && (websocket ? req.headers.origin !== origin : req.headers.origin && req.headers.origin !== origin)) return null;
    const localEntry = req.method === 'GET' && req.headers['sec-fetch-mode'] === 'navigate'
      && ['', '/', '/login', '/settings/personal-ai'].some(suffix => pathname === config.prefix + suffix);
    if (!callback && !localEntry && req.headers['sec-fetch-site'] === 'cross-site') return null;
    if (config.prefix && !callback) {
      if (pathname !== config.prefix && !pathname.startsWith(config.prefix + '/')) return null;
      return req.url.slice(config.prefix.length) || '/';
    }
    return req.url;
  }
  const forward = (req, requestPath) => {
    if (Number(config.target.port || 80) === server.address()?.port) throw Error('Bridge cannot proxy itself');
    return http.request({ hostname: '127.0.0.1', port: config.target.port || 80,
      method: req.method, path: requestPath, headers: req.headers, timeout: 120000 });
  };
  server.on('request', (req, res) => {
    const requestPath = destination(req);
    if (!requestPath) { res.writeHead(403, { 'Cache-Control': 'no-store' }); res.end('Local bridge request refused.'); return; }
    let outgoing;
    try { outgoing = forward(req, requestPath); }
    catch { res.writeHead(502); res.end('SSH tunnel unavailable.'); return; }
    outgoing.on('response', response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    outgoing.on('timeout', () => outgoing.destroy());
    outgoing.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('SSH tunnel unavailable.'); });
    req.on('aborted', () => outgoing.destroy());
    res.on('close', () => outgoing.destroy());
    req.pipe(outgoing);
  });
  server.on('upgrade', (req, socket, head) => {
    const requestPath = destination(req, true);
    if (!requestPath) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    let outgoing;
    try { outgoing = forward(req, requestPath); } catch { socket.destroy(); return; }
    outgoing.on('upgrade', (response, upstream, upstreamHead) => {
      upgraded.add(upstream); upgraded.add(socket);
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`
        + response.rawHeaders.reduce((s, header, i) => s + header + (i % 2 ? '\r\n' : ': '), '') + '\r\n');
      if (head.length) upstream.write(head);
      if (upstreamHead.length) socket.write(upstreamHead);
      socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
      socket.on('close', () => { upgraded.delete(socket); upstream.destroy(); });
      upstream.on('close', () => { upgraded.delete(upstream); socket.destroy(); });
      socket.pipe(upstream).pipe(socket);
    });
    outgoing.on('error', () => socket.destroy());
    outgoing.on('timeout', () => outgoing.destroy());
    outgoing.end();
  });
  server.stopBridge = () => { for (const socket of upgraded) socket.destroy(); server.close(); };
  return { server, config };
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    if (!['upstream', 'mount', 'port'].includes(name) || !argv[i + 1] || name in options) throw Error('Use --upstream, --mount and --port');
    options[name] = argv[i + 1];
  }
  const { server, config } = createAiLoginBridge(options);
  if (!config.port) throw Error('Choose an explicit local port');
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); });
  process.stdout.write(`Local AI connection: http://127.0.0.1:${config.port}${config.prefix}/settings/personal-ai\nKeep the SSH tunnel and this bridge open until the callback completes. Request URLs, cookies and tokens are never logged.\n`);
  process.once('SIGINT', server.stopBridge); process.once('SIGTERM', server.stopBridge);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  process.stderr.write('Local AI bridge could not start. Check the local port and SSH tunnel. No request credentials were printed.\n'); process.exitCode = 1;
});
