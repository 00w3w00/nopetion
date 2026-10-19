import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { docker } from '../scripts/backup-docker.mjs';
import { restoredCompose, targetVolumes } from '../scripts/restore.mjs';

// Docker Compose config is a local, read-only parse: no daemon, containers or volumes are needed.
test('generated recovery Compose preserves literal dollars and an explicitly selected fresh project',
  { skip: process.env.NOPETION_COMPOSE_QA !== '1' }, async (t) => {
    const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nopetion-backup-compose-')));
    await chmod(directory, 0o700); t.after(() => rm(directory, { recursive: true, force: true }));
    const value = 'literal$NAME${OTHER}$$', prefix = 'fresh-recovery';
    const config = { environment: { nopetion: { PROVIDER_SECRET: value }, db: { POSTGRES_PASSWORD: value }, redis: {} } };
    const manifest = { source: { services: Object.fromEntries(['nopetion', 'db', 'redis'].map((service) => [service, { image: 'sha256:' + 'a'.repeat(64) }])) } };
    const file = path.join(directory, 'compose.restore.json');
    await writeFile(file, JSON.stringify(restoredCompose(manifest, config, prefix, targetVolumes(prefix, 'source'))), { mode: 0o600 });
    const envFile = path.join(directory, '.env');
    await writeFile(envFile, 'NAME=must-not-interpolate\nOTHER=must-not-interpolate\nCOMPOSE_PROJECT_NAME=source\n', { mode: 0o600 });
    const parsed = JSON.parse(await docker(['compose', '--env-file', envFile, '--project-name', prefix, '-f', file, 'config', '--format', 'json']));
    // Compose config re-escapes every dollar when serializing its resolved model
    // (docker/compose cmd/compose/config.go). Decode that display layer once.
    const renderedValue = value.split('$').join('$$');
    assert.ok(parsed.services.nopetion.environment.PROVIDER_SECRET === renderedValue, 'provider value has no interpolation');
    assert.ok(parsed.services.db.environment.POSTGRES_PASSWORD === renderedValue, 'database password has no interpolation');
    assert.ok(parsed.services.nopetion.environment.PROVIDER_SECRET.split('$$').join('$') === value, 'resolved provider value is preserved literally');
    assert.equal(parsed.name, prefix);
  });
