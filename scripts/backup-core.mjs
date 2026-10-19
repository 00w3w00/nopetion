import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { appendFile, chmod, link, lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

export const FORMAT = 'nopetion-backup-v1';
const MAGIC = Buffer.from('NOPETIONBK1\0');
const HEADER = MAGIC.length + 12;
export const MAX_BYTES = 1024 ** 4;
export const COMPONENTS = ['database', 'attachments', 'ai', 'connectors', 'redis', 'configuration'];
// Old six-component snapshots remain readable; new snapshots can carry the exact images.
export const OBJECT_KINDS = [...COMPONENTS, 'images'];
export const terminal = (value) => JSON.stringify(value, null, 2) + '\n';
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const mac = (key, value) => createHmac('sha256', key).update(value).digest('hex');
export function safeName(value, label = 'name') {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{2,55}$/.test(value)) throw Error(`Invalid ${label}`);
  return value;
}
export function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export async function regular(file, privateOnly = false) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (privateOnly && (stat.mode & 0o077))) throw Error('Expected a private regular file');
  return stat;
}
export async function privateDirectory(directory, create = false) {
  const absolute = path.resolve(directory);
  if (create) await mkdir(absolute, { recursive: true, mode: 0o700 });
  const stat = await lstat(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Backup directories must be private and cannot be symlinks');
  const resolved = await realpath(absolute);
  if (resolved !== absolute) throw Error('Backup path contains a symlink');
  return absolute;
}
export async function atomicJson(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  const handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(terminal(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, file);
  const directory = await open(path.dirname(file), constants.O_RDONLY);
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function readJson(file) { await regular(file, true); return JSON.parse(await readFile(file, 'utf8')); }
export async function readKey(file, store, projectDirectory) {
  const resolved = path.resolve(file);
  if (isWithin(store, resolved) || (projectDirectory && isWithin(projectDirectory, resolved))) throw Error('Keep the backup key outside the backup store and source project');
  await regular(resolved, true);
  if (await realpath(resolved) !== resolved) throw Error('Key path contains a symlink');
  const value = await readFile(resolved);
  if (value.length !== 32) throw Error('Backup key must contain exactly 32 random bytes');
  return value;
}
export async function initializeKey(file) {
  const parent = await privateDirectory(path.dirname(path.resolve(file)), true);
  const resolved = path.join(parent, path.basename(file));
  const handle = await open(resolved, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(randomBytes(32)); await handle.sync(); } finally { await handle.close(); }
  return resolved;
}
export async function initializeStore(store) {
  await privateDirectory(store, true);
  for (const name of ['objects', 'snapshots']) await privateDirectory(path.join(store, name), true);
}
export async function acquireLock(store, resume = false) {
  const file = path.join(store, 'operation.lock');
  try {
    const handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(terminal({ pid: process.pid })); await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST' || !resume) throw Error('Backup store is locked; inspect the pending operation before resuming');
    const previous = await readJson(file);
    let alive = true;
    try { process.kill(previous.pid, 0); } catch (failure) { if (failure.code === 'ESRCH') alive = false; }
    if (alive) throw Error('Another backup or restore process is still active');
    await unlink(file);
    return acquireLock(store, false);
  }
  return async () => { await unlink(file); };
}
function countHash() {
  const hash = createHash('sha256'); let bytes = 0;
  const stream = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) return done(Error('Backup object exceeds the supported size limit'));
    hash.update(chunk); done(null, chunk);
  } });
  return { stream, result: () => ({ sha256: hash.digest('hex'), bytes }) };
}
export async function hashFile(file) {
  const counter = countHash();
  await pipeline(createReadStream(file), counter.stream, new Writable({ write(_chunk, _encoding, done) { done(); } }));
  return counter.result();
}
export async function decryptStream(store, object, key) {
  if (!object || !/^[a-f0-9]{64}$/.test(object.id) || !OBJECT_KINDS.includes(object.kind)) throw Error('Invalid backup object reference');
  const file = path.join(store, 'objects', object.id + '.bin');
  const stat = await regular(file, true);
  if (stat.size < HEADER + 16 || stat.size > MAX_BYTES + HEADER + 16) throw Error('Invalid encrypted object size');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  const header = Buffer.alloc(HEADER), tag = Buffer.alloc(16);
  try { await handle.read(header, 0, HEADER, 0); await handle.read(tag, 0, 16, stat.size - 16); }
  finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw Error('Unsupported encrypted object');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
  decipher.setAAD(Buffer.from(FORMAT + ':' + object.kind));
  decipher.setAuthTag(tag);
  const input = stat.size === HEADER + 16 ? Readable.from([]) : createReadStream(file, { start: HEADER, end: stat.size - 17 });
  input.on('error', (error) => decipher.destroy(error));
  decipher.on('close', () => input.destroy());
  return input.pipe(decipher);
}
export async function verifyObject(store, object, key, tar = false) {
  if (!object || !/^[a-f0-9]{64}$/.test(object.id) || !OBJECT_KINDS.includes(object.kind)) throw Error('Invalid backup object reference');
  const cipher = await hashFile(path.join(store, 'objects', object.id + '.bin'));
  if (cipher.sha256 !== object.cipherSha256 || cipher.bytes !== object.cipherBytes) throw Error('Encrypted object checksum mismatch');
  const counter = countHash();
  const output = tar ? createGunzip() : new Writable({ write(_chunk, _encoding, done) { done(); } });
  if (tar) await pipeline(await decryptStream(store, object, key), counter.stream, output, new TarValidator());
  else await pipeline(await decryptStream(store, object, key), counter.stream, output);
  const plain = counter.result();
  if (plain.sha256 !== object.plainSha256 || plain.bytes !== object.plainBytes ||
      mac(key, object.kind + ':' + plain.sha256) !== object.id) throw Error('Decrypted object checksum mismatch');
}
export async function captureObject(store, kind, key, input) {
  if (!OBJECT_KINDS.includes(kind)) throw Error('Unknown backup component');
  const temporary = path.join(store, 'objects', randomUUID() + '.partial');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(FORMAT + ':' + kind));
  const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(Buffer.concat([MAGIC, iv])); } finally { await handle.close(); }
  const counter = countHash();
  try {
    await pipeline(input, counter.stream, cipher, createWriteStream(temporary, { flags: 'a', mode: 0o600 }));
    await appendFile(temporary, cipher.getAuthTag());
    const plain = counter.result(), id = mac(key, kind + ':' + plain.sha256);
    const destination = path.join(store, 'objects', id + '.bin');
    const encrypted = await hashFile(temporary);
    let object = { id, kind, plainSha256: plain.sha256, plainBytes: plain.bytes,
      cipherSha256: encrypted.sha256, cipherBytes: encrypted.bytes };
    try {
      await link(temporary, destination);
      const synced = await open(destination, constants.O_RDONLY);
      try { await synced.sync(); } finally { await synced.close(); }
      await atomicJson(path.join(store, 'objects', id + '.json'), object);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const actual = await hashFile(destination);
      object = { ...object, cipherSha256: actual.sha256, cipherBytes: actual.bytes };
      await verifyObject(store, object, key, !['database', 'configuration'].includes(kind));
      // A crash between publishing an object and its metadata is recoverable.
      await atomicJson(path.join(store, 'objects', id + '.json'), object);
    }
    return object;
  } finally { await unlink(temporary).catch(() => {}); }
}
export function signManifest(manifest, key) { return { ...manifest, authentication: mac(key, canonical(manifest)) }; }
export function authenticateManifest(value, key) {
  const { authentication, ...manifest } = value;
  if (manifest.format !== FORMAT || typeof authentication !== 'string' || !/^[a-f0-9]{64}$/.test(authentication) ||
      !timingSafeEqual(Buffer.from(authentication, 'hex'), Buffer.from(mac(key, canonical(manifest)), 'hex'))) throw Error('Manifest authentication failed');
  if (!/^[a-f0-9]{64}$/.test(manifest.id) || COMPONENTS.some((name) => !manifest.components?.[name])) throw Error('Incomplete snapshot');
  safeName(manifest.project, 'source project');
  for (const [name, object] of Object.entries(manifest.components))
    if (!OBJECT_KINDS.includes(name) || object.kind !== name) throw Error('Mismatched snapshot component');
  return manifest;
}
export async function loadManifest(store, selection, key) {
  let id = selection;
  if (selection === 'latest') id = (await readJson(path.join(store, 'latest.json'))).id;
  if (!/^[a-f0-9]{64}$/.test(id || '')) throw Error('Choose a valid snapshot ID or latest');
  const manifest = authenticateManifest(await readJson(path.join(store, 'snapshots', id + '.json')), key);
  if (manifest.id !== id) throw Error('Snapshot identity mismatch');
  return manifest;
}
export async function readObject(store, object, key, maximum = 16 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of await decryptStream(store, object, key)) {
    size += chunk.length; if (size > maximum) throw Error('Configuration object is too large'); chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function safeArchiveName(value) {
  const name = value.replace(/^(\.\/)+/, '').replace(/\/$/, '');
  if (name === '' || name === '.') return;
  if (value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value) || /^[a-z]:/i.test(name) ||
      name.split('/').some((part) => part === '..' || part === '')) throw Error('Unsafe archive path');
}
function numberField(bytes) {
  if (bytes[0] & 128) {
    let number = BigInt(bytes[0] & 127);
    for (const byte of bytes.subarray(1)) number = number * 256n + BigInt(byte);
    if (number > BigInt(MAX_BYTES)) throw Error('Archive numeric field exceeds the supported limit');
    return Number(number);
  }
  const text = bytes.toString('ascii').replace(/\0.*$/, '').trim();
  if (text && !/^[0-7]+$/.test(text)) throw Error('Invalid archive numeric field');
  const result = text ? Number.parseInt(text, 8) : 0;
  if (!Number.isSafeInteger(result) || result > MAX_BYTES) throw Error('Archive numeric field exceeds the supported limit');
  return result;
}
/** Accept only GNU tar regular files/directories, with bounded long names. */
export class TarValidator extends Writable {
  buffer = Buffer.alloc(0); remaining = 0; payload = 0; long = false; nameParts = []; longName = undefined; total = 0; count = 0; ended = false;
  _write(chunk, _encoding, done) {
    try {
      this.total += chunk.length;
      if (this.total > MAX_BYTES) throw Error('Expanded archive is too large');
      let offset = 0;
      while (offset < chunk.length) {
        if (this.remaining) {
          const length = Math.min(this.remaining, chunk.length - offset);
          if (this.long && this.payload) {
            const content = Math.min(this.payload, length);
            this.nameParts.push(chunk.subarray(offset, offset + content)); this.payload -= content;
          }
          this.remaining -= length; offset += length;
          if (!this.remaining && this.long) {
            this.longName = Buffer.concat(this.nameParts).toString('utf8').replace(/\0.*$/, '');
            safeArchiveName(this.longName); this.nameParts = []; this.long = false;
          }
          continue;
        }
        const length = Math.min(512 - this.buffer.length, chunk.length - offset);
        this.buffer = Buffer.concat([this.buffer, chunk.subarray(offset, offset + length)]); offset += length;
        if (this.buffer.length !== 512) continue;
        const header = this.buffer; this.buffer = Buffer.alloc(0);
        if (header.every((byte) => byte === 0)) { this.ended = true; continue; }
        if (this.ended) throw Error('Unexpected data after archive end');
        const expected = numberField(header.subarray(148, 156));
        let checksum = 0; for (let index = 0; index < 512; index++) checksum += index >= 148 && index < 156 ? 32 : header[index];
        if (checksum !== expected) throw Error('Archive header checksum mismatch');
        const size = numberField(header.subarray(124, 136)), mode = numberField(header.subarray(100, 108));
        const type = String.fromCharCode(header[156] || 48);
        if (!['0', '5', 'L'].includes(type) || mode > 0o777) throw Error('Links, special files and elevated archive permissions are unsupported');
        if (++this.count > 2_000_000) throw Error('Archive contains too many entries');
        if (type === 'L') {
          if (size < 1 || size > 4096 || this.longName) throw Error('Invalid archive long name');
          this.long = true; this.payload = size;
        } else {
          const shortName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
          const prefix = header.subarray(257, 263).toString('ascii') === 'ustar\0'
            ? header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '') : '';
          const name = this.longName || (prefix ? prefix + '/' + shortName : shortName);
          safeArchiveName(name); this.longName = undefined;
          if (type === '5' && size) throw Error('Invalid archive directory');
        }
        this.remaining = Math.ceil(size / 512) * 512;
      }
      done();
    } catch (error) { done(error); }
  }
  _final(done) { done(this.remaining || this.buffer.length || this.longName || !this.ended ? Error('Truncated archive') : undefined); }
}
export const bufferStream = (value) => Readable.from([Buffer.isBuffer(value) ? value : Buffer.from(value)]);
