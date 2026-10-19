#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { access, mkdir, open, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, atomicJson, decryptStream, isWithin, privateDirectory, readKey, readObject, safeArchiveName, safeName, terminal } from './backup-core.mjs';
import { docker, ensureNoHelpers, extract, MOUNTS } from './backup-docker.mjs';
import { argumentsFor, verifySnapshot } from './backup.mjs';
import { importSnapshotImages, missingSnapshotImages, verifyImageArchive } from './backup-images.mjs';

export function targetVolumes(prefix, sourceProject) {
  safeName(prefix, 'new target prefix');
  if (prefix === sourceProject) throw Error('Restore target must differ from the source Compose project');
  return Object.fromEntries(Object.entries(MOUNTS).map(([kind, [, logical]]) => [kind, prefix + '_' + logical]));
}
export function validateConfiguration(value) {
  if (!value || !value.files || !value.environment || !Object.hasOwn(value.files, '.env')) throw Error('Snapshot configuration is incomplete');
  for (const [name, data] of Object.entries(value.files)) {
    safeArchiveName(name);
    if (name === '.' || name === '' || name !== path.posix.normalize(name) || typeof data !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw Error('Invalid source configuration filename or content');
  }
  for (const service of ['nopetion', 'db', 'redis']) {
    const environment = value.environment[service];
    if (!environment || Object.entries(environment).some(([key, data]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof data !== 'string' || data.includes('\0'))) throw Error('Invalid effective service environment');
  }
  const db = value.environment.db;
  if (!db.POSTGRES_PASSWORD || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(db.POSTGRES_USER || '') || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(db.POSTGRES_DB || '')) throw Error('Invalid PostgreSQL restore configuration');
  if (db.PGDATA && (!db.PGDATA.startsWith('/var/lib/postgresql/') || db.PGDATA !== path.posix.normalize(db.PGDATA))) throw Error('Unsupported PostgreSQL data location');
  return value;
}
async function absentTargets(volumes) {
  const existing = new Set((await docker(['volume', 'ls', '--format', '{{.Name}}'])).split('\n'));
  if (Object.values(volumes).some((name) => existing.has(name))) throw Error('A target volume already exists; even an empty existing volume cannot be overwritten');
}
async function outputAbsent(directory, store, sourceDirectory, keyFile) {
  if (!directory) throw Error('Provide a new --config-out directory outside the backup store and source project');
  const output = path.resolve(directory), parent = path.dirname(output);
  if (await realpath(parent) !== parent || [store, sourceDirectory].some((protectedPath) => isWithin(protectedPath, output) || isWithin(output, protectedPath)) || isWithin(output, path.resolve(keyFile))) throw Error('Invalid restore configuration location');
  try { await access(output); throw Error('Configuration output directory already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return output;
}
export function restoredCompose(manifest, config, prefix, volumes) {
  const mounted = (service) => Object.entries(MOUNTS).filter(([, [name]]) => name === service).map(([kind, [, logical, destination]]) => `${logical}:${destination}`);
  const services = Object.fromEntries(['nopetion', 'db', 'redis'].map((service) => [service, {
    image: manifest.source.services[service].image, pull_policy: 'never',
    // These values are already resolved. Compose must not interpolate literal dollars a second time.
    environment: Object.fromEntries(Object.entries(config.environment[service]).map(([key, value]) => [key, value.split('$').join('$$')])), volumes: mounted(service),
    ...(service === 'redis' ? { command: ['redis-server', '--appendonly', 'yes', '--maxmemory-policy', 'noeviction'] } : {}),
    ...(service === 'nopetion' ? { init: true, working_dir: '/app/apps/server',
      command: ['node', '/app/apps/server/dist/main.js'], depends_on: ['db', 'redis'] } : {}),
  }]));
  return { name: prefix, services, volumes: Object.fromEntries(Object.entries(MOUNTS).map(([kind, [, logical]]) => [logical, { external: true, name: volumes[kind] }])) };
}
async function saveConfiguration(directory, config, manifest, prefix, volumes) {
  for (const [name, data] of Object.entries(config.files)) {
    const output = path.join(directory, 'source-files', name);
    await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, Buffer.from(data, 'base64'), { flag: 'wx', mode: 0o600 });
  }
  // Preserve the source .env as well as effective values (interpolation may have overridden the file).
  await writeFile(path.join(directory, '.env'), Buffer.from(config.files['.env'], 'base64'), { flag: 'wx', mode: 0o600 });
  await atomicJson(path.join(directory, 'effective-environment.json'), config.environment);
  await atomicJson(path.join(directory, 'compose.restore.json'), restoredCompose(manifest, config, prefix, volumes));
  await atomicJson(path.join(directory, 'restore-result.json'), { snapshot: manifest.id, targetProject: prefix, volumes, startedApplication: false });
  const handle = await open(directory, 'r'); try { await handle.sync(); } finally { await handle.close(); }
}
async function restoreDatabase(manifest, config, volumes, operation, store, key) {
  const db = config.environment.db, name = 'nopetion-restore-' + operation;
  await docker(['run', '-d', '--pull', 'never', '--network', 'none', '--name', name,
    '--label', 'nopetion.backup.operation=' + operation, '--mount', `type=volume,src=${volumes.database},dst=/var/lib/postgresql`,
    '--env', 'POSTGRES_USER', '--env', 'POSTGRES_DB', '--env', 'POSTGRES_PASSWORD', ...(db.PGDATA ? ['--env', 'PGDATA'] : []), manifest.source.services.db.image],
  { env: { POSTGRES_USER: db.POSTGRES_USER, POSTGRES_DB: db.POSTGRES_DB, POSTGRES_PASSWORD: db.POSTGRES_PASSWORD, ...(db.PGDATA ? { PGDATA: db.PGDATA } : {}) } });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (await docker(['exec', name, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -h 127.0.0.1 -X -At --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "SELECT 1"']) === '1') { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw Error('Isolated restore PostgreSQL did not become ready');
  await docker(['exec', '-i', name, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --exit-on-error --single-transaction --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'],
    { input: await decryptStream(store, manifest.components.database, key) });
  await docker(['stop', '--time', '60', name]);
  await docker(['rm', name]);
}
export async function runRestore(action, options, report = (value) => process.stdout.write(terminal(value))) {
  if (!['inspect', 'restore'].includes(action)) throw Error('Use inspect or restore; see docs/backup-restore.md');
  const store = await privateDirectory(options.store), key = await readKey(options['key-file'], store);
  // Authenticate and validate every byte and tar path before creating any target.
  const manifest = await verifySnapshot(store, options.snapshot || 'latest', key);
  const config = validateConfiguration(JSON.parse((await readObject(store, manifest.components.configuration, key)).toString('utf8')));
  if (action === 'inspect' && !options['target-prefix']) {
    report({ verified: true, dryRun: true, snapshot: manifest.id, sourceProject: manifest.project,
      components: Object.keys(manifest.components), imagesIncluded: !!manifest.components.images,
      createdTargets: false, configurationValuesPrinted: false }); return;
  }
  const prefix = safeName(options['target-prefix'], 'new target prefix'), volumes = targetVolumes(prefix, manifest.project);
  const missingImages = await missingSnapshotImages(manifest);
  if (missingImages.length && manifest.components.images) await verifyImageArchive(store, manifest, key);
  if (missingImages.length && !manifest.components.images) throw Error('Exact snapshot images are missing; this older backup does not include images');
  const output = await outputAbsent(options['config-out'], store, manifest.source.directory, options['key-file']);
  await absentTargets(volumes);
  if (!options.execute || action === 'inspect') {
    report({ verified: true, dryRun: true, snapshot: manifest.id, targetProject: prefix, targetVolumes: volumes,
      freshTargetsAvailable: true, imagesToImport: missingImages.length, requiresLoadImages: !!missingImages.length,
      createdTargets: false, startedApplication: false }); return;
  }
  if (options['confirm-target'] !== prefix) throw Error('Execution requires --confirm-target matching the fresh --target-prefix');
  if (missingImages.length && !options['load-images']) throw Error('A cold cache requires --load-images to import the verified exact snapshot images');
  const release = await acquireLock(store), operation = randomUUID();
  let reserved = false;
  try {
    if (missingImages.length) await importSnapshotImages(store, manifest, key);
    await absentTargets(volumes);
    await mkdir(output, { mode: 0o700 }); reserved = true;
    // Persist ownership before any new volume so a failure is reviewable without guessing names.
    await atomicJson(path.join(output, 'restore-pending.json'), { operation, targetProject: prefix, volumes, snapshot: manifest.id, phase: 'creating-fresh-targets' });
    for (const [kind, volume] of Object.entries(volumes)) {
      await docker(['volume', 'create', '--label', 'nopetion.restore.operation=' + operation,
        '--label', 'com.docker.compose.project=' + prefix, '--label', 'com.docker.compose.volume=' + MOUNTS[kind][1], volume]);
      const created = JSON.parse(await docker(['volume', 'inspect', volume]))[0];
      if (created.Labels?.['nopetion.restore.operation'] !== operation || created.Driver !== 'local' || Object.keys(created.Options || {}).length) throw Error('Target volume creation raced with another operation; refusing to write');
    }
    await atomicJson(path.join(output, 'restore-pending.json'), { operation, targetProject: prefix, volumes, snapshot: manifest.id, phase: 'restoring-fresh-targets' });
    for (const kind of ['attachments', 'ai', 'connectors', 'redis']) await extract(manifest.source.services.nopetion.image, volumes[kind], operation, await decryptStream(store, manifest.components[kind], key));
    await restoreDatabase(manifest, config, volumes, operation, store, key);
    await saveConfiguration(output, config, manifest, prefix, volumes);
    await atomicJson(path.join(output, 'restore-pending.json'), { operation, targetProject: prefix, volumes, snapshot: manifest.id, phase: 'complete' });
    report({ restored: true, snapshot: manifest.id, targetProject: prefix, targetVolumes: volumes,
      imagesImported: missingImages.length, startedApplication: false, existingVolumesChanged: false });
  } finally {
    // Only temporary helper containers are removed; new or old volumes are never removed here.
    try { if (reserved) await ensureNoHelpers(operation); } finally { await release(); }
  }
}
export async function main(argv = process.argv.slice(2)) {
  const { action, options } = argumentsFor(argv, ['store', 'key-file', 'snapshot', 'target-prefix', 'config-out', 'execute', 'confirm-target', 'load-images']);
  if (action === 'help') { process.stdout.write('Nopetion restore: inspect | restore. Targets must be new. See docs/backup-restore.md.\n'); return; }
  await runRestore(action, options);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  process.stderr.write('Restore did not complete. No secrets were printed. Existing volumes are never overwritten; inspect the private restore-pending.json and use a new target prefix for another attempt. See docs/backup-restore.md.\n'); process.exitCode = 1;
});
