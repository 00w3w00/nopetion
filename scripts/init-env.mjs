import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const template = await readFile(new URL('.env.example', root), 'utf8');
const dbPassword = randomBytes(24).toString('hex');
const content = template
  .replace('APP_SECRET=REPLACE_WITH_LONG_SECRET', `APP_SECRET=${randomBytes(32).toString('hex')}`)
  .replaceAll('REPLACE_WITH_RANDOM_DB_PASSWORD', dbPassword);
try {
  await writeFile(new URL('.env', root), content, { flag: 'wx', mode: 0o600 });
  console.log(`Created ${fileURLToPath(new URL('.env', root))} with fresh local secrets.`);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
