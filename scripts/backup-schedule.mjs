#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, initializeKey, initializeStore, isWithin, privateDirectory, readKey, regular, safeName, terminal } from './backup-core.mjs';
import { argumentsFor, runBackup, validateLocation } from './backup.mjs';

export const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
export function quoteCron(value) {
  if (/[\r\n\0]/.test(value)) throw Error('Cron paths cannot contain control characters');
  return quote(value).replaceAll('%', '\\%');
}
export function updateCrontab(existing, project, line) {
  safeName(project, 'Compose project');
  const start = '# BEGIN NOPETION BACKUP ' + project, end = '# END NOPETION BACKUP ' + project;
  const starts = existing.split(start).length - 1, ends = existing.split(end).length - 1;
  if (starts !== ends || starts > 1) throw Error('Ambiguous existing Nopetion schedule; refusing to modify crontab');
  const block = `${start}\n${line}\n${end}\n`;
  if (!starts) return existing + (existing && !existing.endsWith('\n') ? '\n' : '') + block;
  const first = existing.indexOf(start), last = existing.indexOf(end, first) + end.length;
  return existing.slice(0, first) + block + existing.slice(last + (existing[last] === '\n' ? 1 : 0));
}
function cron(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('crontab', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const output = []; child.stdout.on('data', bytes => output.push(bytes));
    child.stderr.resume(); child.stdin.on('error', () => {}); child.stdin.end(input);
    child.on('error', () => reject(Error('crontab is unavailable')));
    child.on('close', code => {
      if (code === 0 || (args[0] === '-l' && code === 1)) resolve(Buffer.concat(output).toString('utf8'));
      else reject(Error('Could not inspect or update the user crontab'));
    });
  });
}
export async function runScheduledBackup(options) {
  if (!options.execute || options['confirm-project'] !== options.project) throw Error('Scheduled execution requires explicit project confirmation');
  const store = await validateLocation(options.store, await realpath(options['project-dir'] || process.cwd()));
  await initializeStore(store);
  const startedAt = new Date().toISOString();
  try {
    let created;
    await runBackup('create', options, result => { created = result; });
    if (!created?.created) throw Error('Snapshot was not published');
    await runBackup('verify', { ...options, snapshot: created.snapshot }, () => {});
    const status = { status: 'ok', startedAt, completedAt: new Date().toISOString(), snapshot: created.snapshot,
      imagesIncluded: true, encrypted: true, verified: true, pruned: false };
    await atomicJson(path.join(store, 'backup-status.json'), status);
    return status;
  } catch (error) {
    await atomicJson(path.join(store, 'backup-status.json'), { status: 'failed', startedAt,
      completedAt: new Date().toISOString(), details: 'Inspect the private operation journal; no credentials are included here.' });
    throw error;
  }
}
export async function installSchedule(options) {
  const project = safeName(options.project, 'Compose project');
  const directory = await realpath(options['project-dir'] || process.cwd());
  const store = path.resolve(options.store), keyFile = path.resolve(options['key-file']);
  if (isWithin(directory, store) || isWithin(directory, keyFile) || isWithin(store, keyFile)) throw Error('Keep backups and key outside the source project and separate from each other');
  const hour = Number(options.hour ?? 4), minute = Number(options.minute ?? 30);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw Error('Invalid daily backup time');
  await runBackup('inspect', { project, 'project-dir': directory }, () => {});
  const node = await realpath(process.execPath), script = fileURLToPath(new URL('./backup-schedule.mjs', import.meta.url));
  const log = path.join(store, 'scheduler.log');
  const args = [node, script, 'run', '--project', project, '--project-dir', directory, '--store', store,
    '--key-file', keyFile, '--execute', '--confirm-project', project, '--resume'];
  const line = `${minute} ${hour} * * * ${args.map(quoteCron).join(' ')} >> ${quoteCron(log)} 2>&1`;
  const previous = await cron(['-l']), next = updateCrontab(previous, project, line);
  const plan = { project, dailyAt: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, existingOtherJobsPreserved: true,
    stopsOnlySelectedAppAndRedis: true, keySeparate: true, installed: false };
  if (!options.execute) return { ...plan, dryRun: true };
  if (options['confirm-project'] !== project) throw Error('Installation requires --execute --confirm-project');
  await initializeStore(store);
  await privateDirectory(path.dirname(keyFile), true);
  try { await access(keyFile); } catch (error) { if (error.code !== 'ENOENT') throw error; await initializeKey(keyFile); }
  await readKey(keyFile, store, directory);
  const handle = await open(log, constants.O_CREAT | constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW, 0o600); await handle.close();
  await regular(log, true);
  await cron(['-'], next);
  await atomicJson(path.join(store, 'schedule.json'), { ...plan, installed: true, node, script, createdAt: new Date().toISOString() });
  return { ...plan, installed: true };
}
export async function main(argv = process.argv.slice(2)) {
  const { action, options } = argumentsFor(argv, ['project', 'project-dir', 'store', 'key-file', 'hour', 'minute', 'execute', 'confirm-project', 'resume']);
  if (action === 'help') { process.stdout.write('Nopetion scheduled backups: install (dry run by default), run, status. See docs/backup-restore.md.\n'); return; }
  let result;
  if (action === 'install') result = await installSchedule(options);
  else if (action === 'run') result = await runScheduledBackup(options);
  else if (action === 'status') {
    const store = await privateDirectory(options.store); const file = path.join(store, 'backup-status.json');
    await regular(file, true); result = JSON.parse(await readFile(file, 'utf8'));
  } else throw Error('Use install, run or status');
  process.stdout.write(terminal(result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  process.stderr.write('Backup schedule operation failed. No credentials were printed. Inspect the private backup journal and status.\n'); process.exitCode = 1;
});
