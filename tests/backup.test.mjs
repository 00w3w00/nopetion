import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gzipSync } from 'node:zlib';
import { acquireLock, atomicJson, authenticateManifest, bufferStream, canonical, captureObject, COMPONENTS, FORMAT,
  initializeKey, initializeStore, readKey, readObject, safeArchiveName, signManifest, TarValidator, verifyObject } from '../scripts/backup-core.mjs';
import { parseInventory, sourceIdentity, assertSameSource } from '../scripts/backup-docker.mjs';
import { argumentsFor, recoveryPlan, runBackup, validateLocation } from '../scripts/backup.mjs';
import { restoredCompose, targetVolumes, validateConfiguration } from '../scripts/restore.mjs';

async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nopetion-backup-unit-')));
  await chmod(base, 0o700); t.after(() => rm(base, { recursive: true, force: true }));
  const store = path.join(base, 'store'); await initializeStore(store);
  return { base, store, key: randomBytes(32) };
}
export function tar(entries) {
  const output = [];
  for (const { name, content = '', type = '0', mode = 0o600, prefix = '' } of entries) {
    const body = Buffer.from(content), header = Buffer.alloc(512);
    header.write(name); header.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8);
    header.write('0000000\0', 108, 8); header.write('0000000\0', 116, 8);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 12); header.fill(32, 148, 156);
    header.write(type, 156); header.write('ustar\0', 257); header.write(prefix, 345);
    let checksum = 0; for (const byte of header) checksum += byte;
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    output.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return Buffer.concat([...output, Buffer.alloc(1024)]);
}
test('encrypted streaming round trip deduplicates identical objects without exposing contents', async (t) => {
  const { store, key } = await fixture(t), secret = Buffer.from('private secret API key and document');
  const first = await captureObject(store, 'configuration', key, bufferStream(secret));
  const second = await captureObject(store, 'configuration', key, bufferStream(secret));
  assert.deepEqual(second, first); assert.deepEqual(await readObject(store, first, key), secret);
  assert.equal((await readFile(path.join(store, 'objects', first.id + '.bin'))).includes(secret), false);
  assert.equal((await stat(path.join(store, 'objects', first.id + '.bin'))).mode & 0o777, 0o600);
  await verifyObject(store, first, key);
  await assert.rejects(verifyObject(store, first, randomBytes(32)));
  const file = path.join(store, 'objects', first.id + '.bin'), bytes = await readFile(file); bytes[30] ^= 1; await writeFile(file, bytes);
  await assert.rejects(verifyObject(store, first, key), /checksum/);
});
test('incomplete producer is not published and can be retried', async (t) => {
  const { store, key } = await fixture(t);
  const broken = Readable.from((async function* () { yield Buffer.from('partial'); throw Error('source failed'); })());
  await assert.rejects(captureObject(store, 'database', key, broken), /source failed/);
  const { readdir } = await import('node:fs/promises'); assert.deepEqual(await readdir(path.join(store, 'objects')), []);
  const result = await captureObject(store, 'database', key, bufferStream('PGDMP-complete'));
  await verifyObject(store, result, key);
});
test('manifest authentication binds every component to the source epoch', async (t) => {
  const { key } = await fixture(t);
  const components = Object.fromEntries(COMPONENTS.map((kind) => [kind, { kind, id: 'a'.repeat(64) }]));
  const manifest = { format: FORMAT, id: 'b'.repeat(64), project: 'personal', components };
  const signed = signManifest(manifest, key); assert.deepEqual(authenticateManifest(signed, key), manifest);
  await assert.rejects(async () => authenticateManifest({ ...signed, project: 'other' }, key), /authentication/);
  await assert.rejects(async () => authenticateManifest({ ...signed, components: { ...components, ai: components.database } }, key), /authentication/);
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
});
test('tar verification rejects traversal, hard/symbolic links, device files and elevated modes', async () => {
  for (const entry of [{ name: '../escape' }, { name: '/etc/passwd' }, { name: 'safe', prefix: '../escape' },
    { name: 'link', type: '1' }, { name: 'link', type: '2' }, { name: 'device', type: '3' }, { name: 'sudo', mode: 0o4755 }]) {
    await assert.rejects(pipeline(bufferStream(tar([entry])), new TarValidator()));
  }
  await pipeline(bufferStream(tar([{ name: './', type: '5', mode: 0o700 }, { name: './korean-문서.txt', content: 'data' }])), new TarValidator());
  await assert.rejects(pipeline(bufferStream(tar([{ name: 'safe' }]).subarray(0, 700)), new TarValidator()), /Truncated/);
  assert.throws(() => safeArchiveName('foo/../../bar'));
});
test('encrypted archive authentication and tar safety both gate restore', async (t) => {
  const { store, key } = await fixture(t);
  const safe = await captureObject(store, 'attachments', key, bufferStream(gzipSync(tar([{ name: './data', content: 'document bytes' }]))));
  await verifyObject(store, safe, key, true);
  const bad = await captureObject(store, 'ai', key, bufferStream(gzipSync(tar([{ name: '../key' }]))));
  await assert.rejects(verifyObject(store, bad, key, true), /Unsafe/);
  await assert.rejects(verifyObject(store, { ...safe, id: '../../unsafe' }, key), /Invalid backup object/);
});
test('private key is exclusive and cannot live beside project data or backup objects', async (t) => {
  const { base, store } = await fixture(t), file = path.join(base, 'key'); await initializeKey(file);
  assert.equal((await readKey(file, store)).length, 32);
  await assert.rejects(initializeKey(file), { code: 'EEXIST' });
  const internal = path.join(store, 'key'); await writeFile(internal, randomBytes(32), { mode: 0o600 });
  await assert.rejects(readKey(internal, store), /outside/);
  await chmod(file, 0o644); await assert.rejects(readKey(file, store), /private/); await chmod(file, 0o600);
  const linked = path.join(base, 'linked'); await symlink(file, linked); await assert.rejects(readKey(linked, store), /regular/);
  await assert.rejects(validateLocation(path.join(base, 'project', 'backup'), path.join(base, 'project')), /outside/);
});
test('only explicit stale lock resume is allowed', async (t) => {
  const { store } = await fixture(t), release = await acquireLock(store);
  await assert.rejects(acquireLock(store), /locked/); await assert.rejects(acquireLock(store, true), /still active/); await release();
  await atomicJson(path.join(store, 'operation.lock'), { pid: 2147483647 });
  await assert.rejects(acquireLock(store), /locked/); const recovered = await acquireLock(store, true); await recovered();
});
export function composeFixture() {
  const project = 'unit-personal', directory = '/private/tmp/fixture', images = 'sha256:' + 'a'.repeat(64);
  const services = ['nopetion', 'db', 'redis'];
  const labels = (service) => ({ 'com.docker.compose.project': project, 'com.docker.compose.project.working_dir': directory, 'com.docker.compose.service': service });
  const mounts = [['docmost', '/app/data/storage', 'nopetion'], ['personal_ai', '/app/data/personal-ai', 'nopetion'], ['personal_connectors', '/app/data/connectors', 'nopetion'], ['db_data', '/var/lib/postgresql', 'db'], ['redis_data', '/data', 'redis']];
  const environment = { nopetion: ['STORAGE_DRIVER=local', 'NOPETION_AI_DATA_DIR=/app/data/personal-ai', 'NOPETION_CONNECTORS_DATA_DIR=/app/data/connectors', 'APP_SECRET=secret', 'DATABASE_URL=postgresql://docmost:password@db:5432/docmost', 'REDIS_URL=redis://redis:6379'], db: ['POSTGRES_DB=docmost', 'POSTGRES_USER=docmost', 'POSTGRES_PASSWORD=password'], redis: [] };
  const containers = services.map((service, index) => ({ Id: String(index + 1).repeat(64), Image: images,
    Config: { Labels: labels(service), Env: environment[service] }, State: { Running: true },
    Mounts: mounts.filter(([, , name]) => name === service).map(([name, destination]) => ({ Name: project + '_' + name, Destination: destination, Type: 'volume', RW: true })) }));
  const volumes = mounts.map(([name]) => ({ Name: project + '_' + name, Driver: 'local', Labels: { 'com.docker.compose.project': project, 'com.docker.compose.volume': name } }));
  return { project, directory, containers, volumes };
}
test('actual Compose labels and mounts resolve all five volumes without guessed prefixes', () => {
  const f = composeFixture(), result = parseInventory(f.containers, f.volumes, f.project, f.directory);
  assert.equal(result.volumes.ai, f.project + '_personal_ai'); assert.equal(Object.keys(result.volumes).length, 5);
  assertSameSource(sourceIdentity(result), result);
  const changed = structuredClone(result); changed.volumes.ai = 'other'; assert.throws(() => assertSameSource(sourceIdentity(result), changed), /identity changed/);
});
test('foreign/shared/external mounts and remote databases fail closed', () => {
  for (const mutate of [
    (f) => { f.volumes[0].Labels['com.docker.compose.project'] = 'foreign'; },
    (f) => { f.containers[0].Mounts[0].Type = 'bind'; },
    (f) => { f.volumes[0].Options = { type: 'nfs' }; },
    (f) => { f.containers.push(structuredClone(f.containers[0])); },
    (f) => { f.containers[1].Config.Labels['com.docker.compose.project.working_dir'] = '/wrong'; },
    (f) => { f.containers[0].Config.Env = f.containers[0].Config.Env.map((value) => value.replace('@db:', '@remote:')); },
    (f) => { f.containers[0].Mounts.push({ Name: 'untracked', Destination: '/extra', RW: true, Type: 'volume' }); },
  ]) { const f = composeFixture(); mutate(f); assert.throws(() => parseInventory(f.containers, f.volumes, f.project, f.directory)); }
});
test('restore reserves a distinct explicit project and preserves all effective secret values privately', () => {
  assert.throws(() => targetVolumes('source', 'source'), /differ/); assert.throws(() => targetVolumes('../escape', 'source'));
  const volumes = targetVolumes('fresh-target', 'source'); assert.equal(new Set(Object.values(volumes)).size, 5);
  const config = { files: { '.env': Buffer.from('APP_SECRET=keep\n').toString('base64') }, environment: { nopetion: { APP_SECRET: 'keep', PROVIDER_SECRET: 'literal$NAME${OTHER}$$' }, db: { POSTGRES_USER: 'docmost', POSTGRES_DB: 'docmost', POSTGRES_PASSWORD: 'password' }, redis: {} } };
  assert.equal(validateConfiguration(config), config);
  const manifest = { source: { services: Object.fromEntries(['nopetion', 'db', 'redis'].map((service) => [service, { image: 'sha256:' + 'a'.repeat(64) }])) } };
  const restored = restoredCompose(manifest, config, 'fresh-target', volumes);
  assert.equal(restored.services.nopetion.environment.APP_SECRET, 'keep'); assert.equal(restored.services.nopetion.ports, undefined);
  assert.equal(restored.services.nopetion.environment.PROVIDER_SECRET, 'literal$$NAME$${OTHER}$$$$');
  assert.equal(config.environment.nopetion.PROVIDER_SECRET, 'literal$NAME${OTHER}$$');
  assert.equal(restored.volumes.personal_ai.external, true);
  assert.throws(() => validateConfiguration({ ...config, files: { '../.env': '' } }));
});
test('CLI requires exact options and does not silently enable execution', () => {
  assert.equal(argumentsFor(['create', '--project', 'source'], ['project', 'execute']).options.execute, undefined);
  assert.throws(() => argumentsFor(['create', '--execute', '--execute'], ['execute']));
  assert.throws(() => argumentsFor(['create', '--project'], ['project']));
  assert.throws(() => argumentsFor(['create', '--unsafe'], []));
});
test('recovery dry-run plans only the original journal-owned stopped services', () => {
  const f = composeFixture(), source = parseInventory(f.containers, f.volumes, f.project, f.directory);
  const journal = { project: f.project, source: sourceIdentity(source), stopped: { redis: true, nopetion: true } };
  const containers = { redis: structuredClone(source.services.redis), nopetion: structuredClone(source.services.nopetion) };
  containers.redis.State.Running = false; containers.nopetion.State.Running = false;
  assert.deepEqual(recoveryPlan(journal, containers), ['redis', 'nopetion']);
  containers.redis.State.Running = true; assert.deepEqual(recoveryPlan(journal, containers), ['nopetion']);
  containers.nopetion.Id = 'f'.repeat(64); assert.throws(() => recoveryPlan(journal, containers), /identity changed/);
});
test('CLI key generation refuses the source checkout before writing secret bytes', async () => {
  await assert.rejects(runBackup('keygen', { 'key-file': path.resolve('must-not-create-backup-key') }, () => {}), /outside/);
});
