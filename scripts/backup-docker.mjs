import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { digest, isWithin, safeName } from './backup-core.mjs';

// Never include Docker stderr/arguments/environment in errors: they can contain credentials.
export function command(args, { env = {}, input, timeout = 0 } = {}) {
  const child = spawn('docker', args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderrBytes = 0;
  child.stderr.on('data', (chunk) => { stderrBytes += chunk.length; });
  child.stdin.on('error', () => {});
  if (input) { input.on('error', () => child.kill('SIGTERM')); input.pipe(child.stdin); }
  else child.stdin.end();
  const timer = timeout ? setTimeout(() => child.kill('SIGTERM'), timeout) : undefined;
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(Error('Docker could not be started')));
    child.once('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`Docker operation failed (exit ${code ?? 'signal'}, diagnostic bytes ${stderrBytes})`)); });
  });
  // Install a handler now, then propagate failure after stdout drains, before publishing an object.
  done.catch(() => {});
  const output = Readable.from((async function* () { for await (const chunk of child.stdout) yield chunk; await done; })());
  return { output, done, child };
}
export async function docker(args, options) {
  const process = command(args, options); const chunks = []; let bytes = 0;
  for await (const chunk of process.output) {
    bytes += chunk.length;
    if (bytes > 32 * 1024 * 1024) { process.child.kill('SIGTERM'); throw Error('Docker inspection output exceeds the supported limit'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}
export async function inspect(id) { return JSON.parse(await docker(['inspect', id]))[0]; }
export function envMap(container) {
  return Object.fromEntries((container.Config.Env || []).map((item) => { const index = item.indexOf('='); return [item.slice(0, index), item.slice(index + 1)]; }));
}
export const MOUNTS = {
  attachments: ['nopetion', 'docmost', '/app/data/storage'],
  ai: ['nopetion', 'personal_ai', '/app/data/personal-ai'],
  connectors: ['nopetion', 'personal_connectors', '/app/data/connectors'],
  database: ['db', 'db_data', '/var/lib/postgresql'],
  redis: ['redis', 'redis_data', '/data'],
};
export function parseInventory(containers, volumes, project, directory) {
  safeName(project, 'Compose project');
  const services = {};
  for (const container of containers) {
    const labels = container.Config.Labels || {};
    if (labels['com.docker.compose.project'] !== project || labels['com.docker.compose.project.working_dir'] !== directory ||
        labels['com.docker.compose.oneoff'] === 'True') throw Error('Container does not belong to the exact source Compose project');
    const service = labels['com.docker.compose.service'];
    if (!['nopetion', 'db', 'redis'].includes(service) || services[service]) throw Error('Expected exactly one app, PostgreSQL and Redis container and no extra services');
    if (!/^[a-f0-9]{64}$/.test(container.Id) || !/^sha256:[a-f0-9]{64}$/.test(container.Image)) throw Error('Invalid container or image identity');
    if (!container.State.Running || container.State.Paused || container.State.Restarting) throw Error('Source app, PostgreSQL and Redis must be running normally');
    services[service] = container;
  }
  if (Object.keys(services).length !== 3) throw Error('Expected exactly three source services');
  const resolved = {};
  for (const [kind, [service, logical, destination]] of Object.entries(MOUNTS)) {
    const matches = services[service].Mounts.filter((mount) => mount.Destination === destination);
    const mount = matches[0], volume = volumes.find((item) => item.Name === mount?.Name);
    if (matches.length !== 1 || mount.Type !== 'volume' || !mount.RW || !volume || volume.Driver !== 'local' ||
        Object.keys(volume.Options || {}).length || volume.Labels?.['com.docker.compose.project'] !== project ||
        volume.Labels?.['com.docker.compose.volume'] !== logical) throw Error('Volume ownership, mount, or driver is unsupported');
    resolved[kind] = mount.Name;
  }
  if (new Set(Object.values(resolved)).size !== 5) throw Error('Backup volumes must be distinct');
  for (const service of Object.values(services)) {
    if (service.Mounts.some((mount) => mount.RW && !Object.values(resolved).includes(mount.Name))) throw Error('Unaccounted writable source mount');
  }
  const app = envMap(services.nopetion), db = envMap(services.db);
  let database, redis;
  try { database = new URL(app.DATABASE_URL); redis = new URL(app.REDIS_URL); } catch { throw Error('Unsupported database or Redis configuration'); }
  if (app.STORAGE_DRIVER !== 'local' || app.NOPETION_AI_DATA_DIR !== '/app/data/personal-ai' ||
      app.NOPETION_CONNECTORS_DATA_DIR !== '/app/data/connectors' || !app.APP_SECRET ||
      !['postgres:', 'postgresql:'].includes(database.protocol) || database.hostname !== 'db' || (database.port && database.port !== '5432') ||
      database.pathname !== '/' + db.POSTGRES_DB || decodeURIComponent(database.username) !== db.POSTGRES_USER ||
      decodeURIComponent(database.password) !== db.POSTGRES_PASSWORD || !db.POSTGRES_PASSWORD ||
      !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(db.POSTGRES_DB || '') || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(db.POSTGRES_USER || '') ||
      redis.protocol !== 'redis:' || redis.hostname !== 'redis' || (redis.port && redis.port !== '6379') || redis.username || redis.password ||
      !['', '/', '/0'].includes(redis.pathname)) throw Error('Only the local Compose database, local storage and unauthenticated local Redis configuration are supported');
  return { project, directory, services, volumes: resolved };
}
export async function inventory(project, directory) {
  safeName(project, 'Compose project'); directory = await realpath(directory);
  const ids = (await docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project])).split(/\s+/).filter(Boolean);
  if (!ids.length) throw Error('No containers found for this Compose project');
  const containers = JSON.parse(await docker(['inspect', ...ids]));
  const names = [...new Set(containers.flatMap((container) => container.Mounts.filter((mount) => mount.Type === 'volume').map((mount) => mount.Name)))];
  const volumes = names.length ? JSON.parse(await docker(['volume', 'inspect', ...names])) : [];
  const value = parseInventory(containers, volumes, project, directory);
  await assertNoOtherWriters(value);
  return value;
}
export async function assertNoOtherWriters(source) {
  const ids = (await docker(['ps', '-q'])).split(/\s+/).filter(Boolean);
  if (!ids.length) return;
  const all = JSON.parse(await docker(['inspect', ...ids]));
  const allowed = new Set(Object.values(source.services).map((container) => container.Id));
  if (all.some((container) => !allowed.has(container.Id) && container.Mounts.some((mount) => mount.RW && Object.values(source.volumes).includes(mount.Name))))
    throw Error('Another running container can write to a source volume');
}
export async function configuration(source) {
  const files = new Set(['.env']);
  for (const container of Object.values(source.services)) {
    const paths = (container.Config.Labels?.['com.docker.compose.project.config_files'] || '').split(',').filter(Boolean);
    if (!paths.length) throw Error('Compose source file labels are missing');
    for (const file of paths) {
      const resolved = path.resolve(source.directory, file);
      if (!isWithin(source.directory, resolved) || await realpath(resolved) !== resolved) throw Error('Compose source file is outside the project or is a symlink');
      files.add(path.relative(source.directory, resolved));
    }
  }
  const content = {};
  for (const file of files) {
    const absolute = path.join(source.directory, file), stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024 || await realpath(absolute) !== absolute) throw Error('Unsupported source configuration file');
    content[file] = (await readFile(absolute)).toString('base64');
  }
  return { files: content, environment: Object.fromEntries(Object.entries(source.services).map(([service, container]) => [service, envMap(container)])) };
}
export function sourceIdentity(source) {
  return { project: source.project, directory: source.directory, volumes: source.volumes,
    services: Object.fromEntries(Object.entries(source.services).map(([name, container]) => [name, { id: container.Id, image: container.Image }])) };
}
export function assertSameSource(expected, actual) {
  if (digest(JSON.stringify(expected)) !== digest(JSON.stringify(sourceIdentity(actual)))) throw Error('Source container or volume identity changed; recovery requires the original containers');
}

// This helper emits only a metadata digest. File names and contents never reach terminal output.
const INVENTORY_SCRIPT = String.raw`
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{const h=crypto.createHash('sha256');let count=0;async function walk(name){const p=path.join('/volume',name),s=await fs.lstat(p,{bigint:true});if(s.isSymbolicLink()||(!s.isFile()&&!s.isDirectory())||(s.mode&0o7000n))throw Error('unsupported entry');if(++count>2000000)throw Error('entry limit');h.update(JSON.stringify([name,s.mode.toString(),s.uid.toString(),s.gid.toString(),s.size.toString(),s.mtimeNs.toString(),s.ctimeNs.toString()])+'\n');if(s.isDirectory()){for(const child of(await fs.readdir(p)).sort())await walk(name?name+'/'+child:child);}}await walk('');process.stdout.write(h.digest('hex'));})().catch(()=>process.exit(1));`;
export function helperArgs(image, volume, operation, writable = false) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw Error('Expected a locally cached exact image ID');
  return ['run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--user', '0', '--cap-drop', 'ALL',
    '--cap-add', 'DAC_OVERRIDE', ...(writable ? ['--cap-add', 'CHOWN', '--cap-add', 'FOWNER'] : []),
    '--security-opt', 'no-new-privileges', '--label', 'nopetion.backup.operation=' + operation,
    '--mount', `type=volume,src=${volume},dst=/volume${writable ? '' : ',readonly'}`, '--entrypoint', 'node', '-i', image];
}
export async function fingerprint(image, volume, operation) {
  const output = await docker([...helperArgs(image, volume, operation), '-e', INVENTORY_SCRIPT]);
  if (!/^[a-f0-9]{64}$/.test(output)) throw Error('Invalid volume inventory response');
  return output;
}
const TAR_SCRIPT = `const {spawn}=require('node:child_process');const c=spawn('tar',['--format=gnu','--sort=name','--numeric-owner','--hard-dereference','-czf','-','-C','/volume','.'],{stdio:['ignore','inherit','inherit']});c.on('error',()=>process.exit(1));c.on('exit',n=>process.exit(n??1));`;
export function archive(image, volume, operation) { return command([...helperArgs(image, volume, operation), '-e', TAR_SCRIPT]).output; }
const EXTRACT_SCRIPT = `const {spawn}=require('node:child_process');const c=spawn('tar',['--numeric-owner','--same-owner','--same-permissions','-xzf','-','-C','/volume'],{stdio:['inherit','inherit','inherit']});c.on('error',()=>process.exit(1));c.on('exit',n=>process.exit(n??1));`;
export async function extract(image, volume, operation, input) { await docker([...helperArgs(image, volume, operation, true), '-e', EXTRACT_SCRIPT], { input }); }
export async function ensureNoHelpers(operation) {
  const ids = (await docker(['ps', '-aq', '--filter', 'label=nopetion.backup.operation=' + operation])).split(/\s+/).filter(Boolean);
  // These labels are unique to the journal; never remove a source service or volume.
  for (const id of ids) await docker(['rm', '-f', id]);
}
export async function waitRedis(id) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if (await docker(['exec', id, 'redis-cli', 'ping']) === 'PONG') return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error('Redis did not become ready; the app was not restarted');
}
