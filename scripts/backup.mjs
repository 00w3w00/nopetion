#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { compose } from 'node:stream';
import { createGzip } from 'node:zlib';
import { access, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyImageArchive } from './backup-images.mjs';
import { acquireLock, atomicJson, authenticateManifest, bufferStream, canonical, captureObject, COMPONENTS, FORMAT,
  initializeKey, initializeStore, isWithin, loadManifest, mac, privateDirectory, readJson, readKey, safeName, signManifest, terminal, verifyObject } from './backup-core.mjs';
import { archive, assertNoOtherWriters, assertSameSource, command, configuration, docker, ensureNoHelpers, fingerprint,
  inspect, inventory, sourceIdentity, waitRedis } from './backup-docker.mjs';

export function argumentsFor(argv, allowed) {
  const [action = 'help', ...rest] = argv, options = {};
  for (let index = 0; index < rest.length; index++) {
    const item = rest[index];
    if (!item.startsWith('--') || !allowed.includes(item.slice(2)) || item.slice(2) in options) throw Error('Unknown or duplicate option');
    const key = item.slice(2);
    if (['execute', 'resume', 'load-images'].includes(key)) options[key] = true;
    else { if (!rest[index + 1] || rest[index + 1].startsWith('--')) throw Error('Missing option value'); options[key] = rest[++index]; }
  }
  return { action, options };
}
async function exists(file) { try { await access(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } }
export async function validateLocation(store, projectDirectory) {
  const absolute = path.resolve(store || '');
  if (!store || isWithin(projectDirectory, absolute) || isWithin(absolute, projectDirectory)) throw Error('Choose a backup store outside the source project, with neither path containing the other');
  return absolute;
}
function assertJournal(journal, project, directory) {
  if (journal.format !== FORMAT || journal.project !== project || journal.source?.directory !== directory ||
      !/^[a-f0-9-]{36}$/.test(journal.operation || '')) throw Error('Pending operation does not match the explicit project');
  for (const service of ['nopetion', 'db', 'redis']) if (!/^[a-f0-9]{64}$/.test(journal.source.services?.[service]?.id || '')) throw Error('Invalid pending source identity');
}
export function recoveryPlan(journal, containers) {
  return ['redis', 'nopetion'].filter((service) => {
    if (!journal.stopped[service]) return false;
    const expected = journal.source.services[service], container = containers[service];
    if (!container || container.Id !== expected.id || container.Image !== expected.image ||
        container.Config.Labels?.['com.docker.compose.project'] !== journal.project ||
        container.Config.Labels?.['com.docker.compose.project.working_dir'] !== journal.source.directory ||
        container.Config.Labels?.['com.docker.compose.service'] !== service) throw Error('Recovery source identity changed; refusing to start another container');
    return !container.State.Running;
  });
}
export async function restartOwned(journal, save) {
  for (const service of ['redis', 'nopetion']) {
    if (!journal.stopped[service]) continue;
    const expected = journal.source.services[service], container = await inspect(expected.id);
    if (container.Id !== expected.id || container.Image !== expected.image || container.Config.Labels?.['com.docker.compose.project'] !== journal.project ||
        container.Config.Labels?.['com.docker.compose.project.working_dir'] !== journal.source.directory ||
        container.Config.Labels?.['com.docker.compose.service'] !== service) throw Error('Recovery source identity changed; refusing to start another container');
    if (!container.State.Running) await docker(['start', expected.id]);
    if (service === 'redis') await waitRedis(expected.id);
    journal.stopped[service] = false; await save();
  }
}
async function stopOwned(journal, service, timeout, save) {
  journal.stopped[service] = true; await save(); // Intent must survive a kill between stop and the next journal write.
  await docker(['stop', '--time', String(timeout), journal.source.services[service].id]);
  const state = (await inspect(journal.source.services[service].id)).State;
  if (state.Running || state.OOMKilled || ![0, 143].includes(state.ExitCode)) throw Error('Service did not stop gracefully; the snapshot will not be published');
}
async function noDatabaseWriters(id) {
  const result = await docker(['exec', id, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -At --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type=\'client backend\'"']);
  if (result !== '0') throw Error('PostgreSQL has another client connection; exclusive application quiescence cannot be established');
}
export async function verifySnapshot(store, selection, key) {
  const manifest = await loadManifest(store, selection, key);
  for (const [name, object] of Object.entries(manifest.components)) await verifyObject(store, object, key, !['database', 'configuration'].includes(name));
  if (manifest.components.images) await verifyImageArchive(store, manifest, key);
  return manifest;
}
export async function runBackup(action, options, report = (value) => process.stdout.write(terminal(value))) {
  if (action === 'keygen') {
    if (!options['key-file']) throw Error('Provide --key-file in a private directory outside the project and backup store');
    const projectDirectory = await realpath(options['project-dir'] || process.cwd()), keyFile = path.resolve(options['key-file']);
    if (isWithin(projectDirectory, keyFile) || (options.store && isWithin(path.resolve(options.store), keyFile))) throw Error('Keep the backup key outside the backup store and source project');
    await initializeKey(options['key-file']); report({ keyCreated: true, bytes: 32 }); return;
  }
  if (action === 'verify') {
    const store = await privateDirectory(options.store), key = await readKey(options['key-file'], store);
    const manifest = await verifySnapshot(store, options.snapshot || 'latest', key);
    report({ verified: true, snapshot: manifest.id, components: Object.keys(manifest.components) }); return;
  }
  if (!['inspect', 'create', 'recover'].includes(action)) throw Error('Use inspect, create, verify, recover or keygen; see docs/backup-restore.md');
  const project = safeName(options.project, 'Compose project'), directory = await realpath(options['project-dir'] || process.cwd());
  if (action === 'recover' && !options.execute) {
    const store = await privateDirectory(await validateLocation(options.store, directory));
    const journal = await readJson(path.join(store, 'pending.json')); assertJournal(journal, project, directory);
    const containers = {};
    for (const service of ['redis', 'nopetion']) if (journal.stopped[service]) containers[service] = await inspect(journal.source.services[service].id);
    report({ dryRun: true, project, restartServices: recoveryPlan(journal, containers), sourceChanged: false }); return;
  }
  if (action === 'inspect' || !options.execute) {
    const source = await inventory(project, directory);
    report({ dryRun: true, project, services: Object.keys(source.services), volumes: source.volumes,
      planned: ['encrypt exact app/PostgreSQL/Redis images and pre-copy stable application volumes', 'gracefully stop the app', 'dump PostgreSQL and archive stopped Redis', 'restart the same Redis and app containers', 'authenticate and publish the snapshot'],
      sourceChanged: false }); return;
  }
  if (options['confirm-project'] !== project) throw Error('Execution requires --confirm-project matching --project');
  const store = await validateLocation(options.store, directory);
  await initializeStore(store);
  const release = await acquireLock(store, Boolean(options.resume)), pending = path.join(store, 'pending.json');
  let journal, save, signal;
  const onSignal = () => { signal = true; };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    if (await exists(pending)) {
      journal = await readJson(pending); assertJournal(journal, project, directory);
      save = () => atomicJson(pending, journal);
      if (!options.resume && action !== 'recover') throw Error('A pending operation exists; inspect it and explicitly --resume or recover');
      try { await ensureNoHelpers(journal.operation); } finally { await restartOwned(journal, save); }
    }
    if (action === 'recover') {
      if (!journal) throw Error('No pending operation to recover');
      journal.phase = 'recovered'; await save(); report({ recovered: true, project, sourceServicesRestarted: true }); return;
    }
    const key = await readKey(options['key-file'], store, directory), source = await inventory(project, directory);
    if (journal) assertSameSource(journal.source, source);
    const previous = journal;
    journal = { format: FORMAT, operation: randomUUID(), project, source: sourceIdentity(source), phase: 'precopy', stopped: {}, preCopies: previous?.preCopies || {} };
    save = () => atomicJson(pending, journal); await save();
    const checkSignal = () => { if (signal) throw Error('Backup interrupted; source services are being recovered'); };
    const appImage = source.services.nopetion.Image, components = {}, fingerprints = {};
    let latest;
    try { latest = await loadManifest(store, 'latest', key); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const imageIds = [...new Set(Object.values(journal.source.services).map(service => service.image))].sort();
    const sameImages = snapshot => snapshot && canonical([...new Set(Object.values(snapshot.source.services).map(service => service.image))].sort()) === canonical(imageIds);
    const imageCopy = journal.preCopies.images?.imageIds && canonical(journal.preCopies.images.imageIds) === canonical(imageIds)
      ? journal.preCopies.images.object : sameImages(latest) ? latest.components.images : undefined;
    if (imageCopy) {
      await verifyObject(store, imageCopy, key, true);
      components.images = imageCopy;
    } else {
      // Export immutable image IDs before the maintenance window. No live env/volumes.
      components.images = await captureObject(store, 'images', key,
        compose(command(['image', 'save', ...imageIds]).output, createGzip({ level: 3 })));
      await verifyObject(store, components.images, key, true);
      journal.preCopies.images = { imageIds, object: components.images }; await save();
    }
    await verifyImageArchive(store, { source: journal.source, components }, key);
    const captureVolume = async (kind, final = false) => {
      checkSignal();
      const before = await fingerprint(appImage, source.volumes[kind], journal.operation);
      const candidates = [journal.preCopies[kind], latest?.project === project && canonical(latest.source) === canonical(journal.source) ? { fingerprint: latest.fingerprints[kind], object: latest.components[kind] } : null].filter(Boolean);
      const reused = candidates.find((candidate) => candidate.fingerprint === before);
      if (reused) {
        await verifyObject(store, reused.object, key, true);
        fingerprints[kind] = before; components[kind] = reused.object; return true;
      }
      const object = await captureObject(store, kind, key, archive(appImage, source.volumes[kind], journal.operation));
      const after = await fingerprint(appImage, source.volumes[kind], journal.operation);
      if (before !== after) { if (final) throw Error('Source files changed while the application was quiesced'); return false; }
      await verifyObject(store, object, key, true);
      journal.preCopies[kind] = { fingerprint: before, object }; await save();
      fingerprints[kind] = before; components[kind] = object; return true;
    };
    // Optimistic pre-copy reduces app downtime; final metadata checks decide whether it is reusable.
    for (const kind of ['attachments', 'ai', 'connectors']) await captureVolume(kind);
    checkSignal(); await assertNoOtherWriters(source);
    if (await docker(['exec', source.services.redis.Id, 'redis-cli', '--raw', 'CONFIG', 'GET', 'appendonly']) !== 'appendonly\nyes') throw Error('Redis AOF persistence must be enabled');
    journal.phase = 'quiescing'; await save();
    try {
      await stopOwned(journal, 'nopetion', 660, save); checkSignal();
      await assertNoOtherWriters(source); await noDatabaseWriters(source.services.db.Id);
      journal.phase = 'capturing'; await save();
      for (const kind of ['attachments', 'ai', 'connectors']) await captureVolume(kind, true);
      components.configuration = await captureObject(store, 'configuration', key, bufferStream(canonical(await configuration(source))));
      await stopOwned(journal, 'redis', 60, save); checkSignal();
      await captureVolume('redis', true);
      components.database = await captureObject(store, 'database', key,
        command(['exec', source.services.db.Id, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump --format=custom --compress=gzip:3 --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"']).output);
      checkSignal(); await noDatabaseWriters(source.services.db.Id); await assertNoOtherWriters(source);
      // A second check catches an unexpected external writer during the dump.
      for (const kind of ['attachments', 'ai', 'connectors', 'redis']) if (await fingerprint(appImage, source.volumes[kind], journal.operation) !== fingerprints[kind]) throw Error('Files changed during the database snapshot');
      await verifyObject(store, components.database, key);
      const identity = { source: journal.source, components: Object.fromEntries(Object.entries(components).map(([kind, object]) => [kind, object.id])) };
      const id = mac(key, canonical(identity));
      const manifest = { format: FORMAT, id, project, createdAt: new Date().toISOString(), source: journal.source, fingerprints, components,
        consistency: 'graceful-app-stop-with-exclusive-volume-and-database-client-checks; stopped-redis-aof' };
      const file = path.join(store, 'snapshots', id + '.json');
      if (await exists(file)) authenticateManifest(await readJson(file), key);
      else await atomicJson(file, signManifest(manifest, key));
      await atomicJson(path.join(store, 'latest.json'), { id });
      journal.phase = 'published'; journal.snapshot = id; await save();
    } finally {
      try { await ensureNoHelpers(journal.operation); } finally { await restartOwned(journal, save); }
    }
    await unlink(pending);
    report({ created: true, snapshot: journal.snapshot, project, encrypted: true, imagesIncluded: true, sourceServicesRestarted: true, pruned: false });
  } finally {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    await release();
  }
}
export async function main(argv = process.argv.slice(2)) {
  const { action, options } = argumentsFor(argv, ['project', 'project-dir', 'store', 'key-file', 'snapshot', 'execute', 'confirm-project', 'resume']);
  if (action === 'help') { process.stdout.write('Nopetion backup: inspect | create | verify | recover | keygen. See docs/backup-restore.md. Execution is opt-in.\n'); return; }
  await runBackup(action, options);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  process.stderr.write('Backup did not complete. No secrets were printed. Inspect the private pending.json; use recover or --resume for interrupted source services. See docs/backup-restore.md.\n'); process.exitCode = 1;
});
