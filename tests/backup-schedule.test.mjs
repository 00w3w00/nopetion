import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { quote, quoteCron, updateCrontab } from '../scripts/backup-schedule.mjs';

test('installing and updating one backup schedule preserves unrelated cron jobs verbatim', () => {
  const original = 'MAILTO=""\n5 1 * * * /usr/local/bin/unrelated-job\n';
  const first = updateCrontab(original, 'nopetion', '30 4 * * * first');
  assert.equal(first.startsWith(original), true);
  const second = updateCrontab(first, 'nopetion', '30 5 * * * second');
  assert.equal(second.startsWith(original), true);
  assert.equal(second.includes('first'), false);
  assert.equal(second.match(/BEGIN NOPETION BACKUP/g).length, 1);
  assert.equal(updateCrontab(second, 'nopetion', '30 5 * * * second'), second);
});
test('ambiguous schedule ownership is rejected without modifying crontab', () => {
  assert.throws(() => updateCrontab('# BEGIN NOPETION BACKUP nopetion\n', 'nopetion', 'job'), /Ambiguous/);
  const duplicate = '# BEGIN NOPETION BACKUP nopetion\n# END NOPETION BACKUP nopetion\n'.repeat(2);
  assert.throws(() => updateCrontab(duplicate, 'nopetion', 'job'), /Ambiguous/);
});
test('scheduler paths and arguments reach a real shell literally', () => {
  const values = ["space and ' quote", '$(printf injected)', '`printf injected`', '$HOME; echo injected'];
  const command = [process.execPath, '-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...values].map(quote).join(' ');
  assert.deepEqual(JSON.parse(execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' })), values);
});
test('cron percent separators and line injection cannot alter the schedule command', () => {
  assert.equal(quoteCron('/private/50%/backup'), "'/private/50\\%/backup'");
  assert.throws(() => quoteCron('/private/path\n* * * * * another-job'), /control/);
});
