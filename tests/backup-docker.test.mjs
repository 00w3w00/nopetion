import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicJson, initializeKey, loadManifest, readKey } from '../scripts/backup-core.mjs';
import { docker, fingerprint, helperArgs, inventory, MOUNTS, sourceIdentity } from '../scripts/backup-docker.mjs';
import { runBackup } from '../scripts/backup.mjs';
import { runRestore, targetVolumes } from '../scripts/restore.mjs';

// Opt-in only: every resource is new, network-none, port-free, UUID-named and ownership-checked on cleanup.
test('isolated Docker backup, encrypted verification, recovery and fresh restore preserve all six components',
  { skip: process.env.NOPETION_DOCKER_QA !== '1', timeout: 600_000 }, async (t) => {
    const operation = randomUUID(), suffix = operation.replaceAll('-', '').slice(0, 18);
    const project = 'backupqa-' + suffix, target = 'restoreqa-' + suffix;
    const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nopetion-backup-qa-')));
    await chmod(base, 0o700);
    const projectDirectory = path.join(base, 'source'), store = path.join(base, 'store'), keyFile = path.join(base, 'key'), output = path.join(base, 'restored-config');
    await mkdir(projectDirectory, { mode: 0o700 }); await initializeKey(keyFile);
    const secret = randomBytes(32).toString('hex'), password = randomBytes(24).toString('hex'), aiKey = randomBytes(32).toString('base64');
    await writeFile(path.join(projectDirectory, '.env'), `APP_SECRET=${secret}\nPOSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
    const composeFile = path.join(projectDirectory, 'compose.qa.json'); await writeFile(composeFile, '{}', { mode: 0o600 });
    const images = {};
    for (const [name, tag] of [['nopetion', process.env.NOPETION_BACKUP_QA_APP_IMAGE || 'nopetion:local'], ['db', 'postgres:18'], ['redis', 'redis:8']]) {
      images[name] = JSON.parse(await docker(['image', 'inspect', tag]))[0].Id;
    }
    const containerNames = {}, volumes = {}, reports = [];
    const report = (value) => reports.push(value);
    const env = { APP_SECRET: secret, POSTGRES_PASSWORD: password, DATABASE_URL: 'postgresql://docmost:' + password + '@db:5432/docmost' };
    const execSql = async (name, sql) => docker(['exec', name, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -At --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "$1"', 'qa', sql]);
    const waitDb = async (name) => {
      for (let attempt = 0; attempt < 120; attempt++) {
        try { if (await docker(['exec', name, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -h 127.0.0.1 -X -At --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "SELECT 1"']) === '1') return; } catch {}
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw Error('QA PostgreSQL was not ready');
    };
    t.after(async () => {
      // Never discover or remove operational resources by a broad name prefix.
      const ids = (await docker(['ps', '-aq', '--filter', 'label=nopetion.qa.operation=' + operation])).split(/\s+/).filter(Boolean);
      for (const id of ids) {
        const found = JSON.parse(await docker(['inspect', id]))[0];
        assert.equal(found.Config.Labels['nopetion.qa.operation'], operation);
        if (found.State.Running) await docker(['stop', '--time', '30', id]);
        await docker(['rm', id]);
      }
      // Keep fixture volumes, encrypted backup, key and restored configuration for the parent's review.
      await atomicJson(path.join(base, 'qa-resources.json'), { operation, sourceProject: project, targetProject: target, sourceVolumes: volumes,
        targetVolumes: targetVolumes(target, project), store, keyFile, configOutput: output, containersCleaned: true, volumesDeleted: false });
      t.diagnostic('Private QA artifacts preserved: ' + base);
    });
    for (const [kind, [, logical]] of Object.entries(MOUNTS)) {
      const volume = project + '_' + logical;
      const existing = (await docker(['volume', 'ls', '--format', '{{.Name}}'])).split('\n'); assert.equal(existing.includes(volume), false);
      await docker(['volume', 'create', '--label', 'nopetion.qa.operation=' + operation, '--label', 'com.docker.compose.project=' + project, '--label', 'com.docker.compose.volume=' + logical, volume]);
      volumes[kind] = volume;
    }
    for (const kind of ['attachments', 'ai', 'connectors']) {
      const files = kind === 'attachments' ? { '문서.txt': Buffer.from('isolated document attachment').toString('base64') }
        : kind === 'ai' ? { 'encryption.key': aiKey, 'fixture.enc': Buffer.from('isolated encrypted AI settings').toString('base64') }
        : { 'connector.enc': Buffer.from('isolated encrypted connector configuration').toString('base64') };
      const script = `const fs=require('node:fs');for(const [name,data] of Object.entries(${JSON.stringify(files)}))fs.writeFileSync('/volume/'+name,Buffer.from(data,'base64'),{mode:0o600});`;
      await docker([...helperArgs(images.nopetion, volumes[kind], operation, true), '-e', script]);
    }
    for (const service of ['db', 'redis', 'nopetion']) {
      const name = project + '-' + service;
      const args = ['run', '-d', '--pull', 'never', '--network', 'none', '--name', name,
        '--label', 'nopetion.qa.operation=' + operation,
        '--label', 'com.docker.compose.project=' + project, '--label', 'com.docker.compose.service=' + service,
        '--label', 'com.docker.compose.project.working_dir=' + projectDirectory, '--label', 'com.docker.compose.project.config_files=' + composeFile];
      for (const [kind, [owner, , destination]] of Object.entries(MOUNTS)) if (owner === service) args.push('--mount', `type=volume,src=${volumes[kind]},dst=${destination}`);
      if (service === 'db') args.push('--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_USER=docmost', '--env', 'POSTGRES_DB=docmost');
      if (service === 'nopetion') args.push('--env', 'APP_SECRET', '--env', 'DATABASE_URL', '--env', 'REDIS_URL=redis://redis:6379', '--env', 'STORAGE_DRIVER=local', '--env', 'NOPETION_AI_DATA_DIR=/app/data/personal-ai', '--env', 'NOPETION_CONNECTORS_DATA_DIR=/app/data/connectors', '--entrypoint', 'node');
      args.push(images[service]);
      if (service === 'redis') args.push('redis-server', '--appendonly', 'yes', '--maxmemory-policy', 'noeviction');
      if (service === 'nopetion') args.push('-e', "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)");
      await docker(args, { env }); containerNames[service] = name;
    }
    await waitDb(containerNames.db);
    await execSql(containerNames.db, "CREATE TABLE documents(id integer PRIMARY KEY,body text); INSERT INTO documents VALUES (1,'isolated committed Korean 문서');");
    await docker(['exec', containerNames.redis, 'redis-cli', 'LPUSH', 'bull:fixture:wait', 'job-1']);
    const source = await inventory(project, projectDirectory), opts = { project, 'project-dir': projectDirectory, store, 'key-file': keyFile, execute: true, 'confirm-project': project };
    const original = sourceIdentity(source);
    await runBackup('create', { ...opts, execute: false }, report);
    assert.deepEqual(sourceIdentity(await inventory(project, projectDirectory)), original);
    await runBackup('create', opts, report);
    const key = await readKey(keyFile, store), first = await loadManifest(store, 'latest', key);
    await runBackup('verify', { store, 'key-file': keyFile }, report);
    await runBackup('create', opts, report);
    const second = await loadManifest(store, 'latest', key);
    for (const kind of ['attachments', 'ai', 'connectors']) assert.equal(second.components[kind].id, first.components[kind].id);
    assert.deepEqual(sourceIdentity(await inventory(project, projectDirectory)), original);
    // Simulate a dead process after it has stopped exactly these QA source containers.
    const journal = { format: 'nopetion-backup-v1', operation: randomUUID(), project, source: original, stopped: { nopetion: true, redis: true }, phase: 'capturing', preCopies: {} };
    await atomicJson(path.join(store, 'pending.json'), journal);
    await docker(['stop', '--time', '5', source.services.nopetion.Id, source.services.redis.Id]);
    await atomicJson(path.join(store, 'operation.lock'), { pid: 2147483647 });
    await runBackup('recover', { ...opts, resume: true }, report);
    assert.deepEqual(sourceIdentity(await inventory(project, projectDirectory)), original);
    await runBackup('create', { ...opts, resume: true }, report);
    const restored = targetVolumes(target, project);
    await runRestore('inspect', { store, 'key-file': keyFile }, report);
    await runRestore('restore', { store, 'key-file': keyFile, 'target-prefix': target, 'config-out': output }, report);
    assert.equal((await docker(['volume', 'ls', '--format', '{{.Name}}'])).split('\n').includes(restored.database), false);
    await runRestore('restore', { store, 'key-file': keyFile, 'target-prefix': target, 'config-out': output, execute: true, 'confirm-target': target }, report);
    await assert.rejects(runRestore('restore', { store, 'key-file': keyFile, 'target-prefix': target, 'config-out': path.join(base, 'other-config'), execute: true, 'confirm-target': target }, report), /already exists/);
    const restoredConfig = JSON.parse(await readFile(path.join(output, 'effective-environment.json'), 'utf8'));
    assert.ok(restoredConfig.nopetion.APP_SECRET === secret, 'restored APP_SECRET matches'); assert.ok(restoredConfig.db.POSTGRES_PASSWORD === password, 'restored PostgreSQL password matches');
    const dbCheck = target + '-dbcheck', redisCheck = target + '-redischeck';
    await docker(['run', '-d', '--pull', 'never', '--network', 'none', '--name', dbCheck, '--label', 'nopetion.qa.operation=' + operation,
      '--mount', `type=volume,src=${restored.database},dst=/var/lib/postgresql`, '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_USER=docmost', '--env', 'POSTGRES_DB=docmost', images.db], { env });
    await waitDb(dbCheck); assert.equal(await execSql(dbCheck, 'SELECT body FROM documents WHERE id=1'), 'isolated committed Korean 문서');
    await docker(['run', '-d', '--pull', 'never', '--network', 'none', '--name', redisCheck, '--label', 'nopetion.qa.operation=' + operation,
      '--mount', `type=volume,src=${restored.redis},dst=/data`, images.redis, 'redis-server', '--appendonly', 'yes']);
    // Container creation returns before Redis has loaded its restored AOF.
    let redisReady = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try { if (await docker(['exec', redisCheck, 'redis-cli', 'PING']) === 'PONG') { redisReady = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(redisReady, true, 'restored Redis is ready before checking queued work');
    assert.equal(await docker(['exec', redisCheck, 'redis-cli', 'LRANGE', 'bull:fixture:wait', '0', '-1']), 'job-1');
    for (const kind of ['attachments', 'ai', 'connectors']) {
      const file = kind === 'attachments' ? '문서.txt' : kind === 'ai' ? 'encryption.key' : 'connector.enc';
      const value = await docker([...helperArgs(images.nopetion, restored[kind], operation), '-e', `process.stdout.write(require('node:fs').readFileSync('/volume/'+${JSON.stringify(file)}).toString('base64'))`]);
      const expected = kind === 'attachments' ? Buffer.from('isolated document attachment').toString('base64') : kind === 'ai' ? aiKey : Buffer.from('isolated encrypted connector configuration').toString('base64');
      assert.ok(value === expected, 'restored ' + kind + ' bytes match');
    }
    assert.equal(JSON.stringify(reports).includes(secret), false); assert.equal(JSON.stringify(reports).includes(password), false); assert.equal(JSON.stringify(reports).includes(aiKey), false);
    assert.deepEqual(sourceIdentity(await inventory(project, projectDirectory)), original);
  });
