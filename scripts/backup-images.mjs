import { createHash } from 'node:crypto';
import { Writable, compose } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import { decryptStream, safeArchiveName, TarValidator } from './backup-core.mjs';
import { docker } from './backup-docker.mjs';

export function snapshotImages(manifest) {
  const ids = [...new Set(['nopetion', 'db', 'redis'].map(service => manifest.source?.services?.[service]?.image))].sort();
  if (ids.some(id => !/^sha256:[a-f0-9]{64}$/.test(id || ''))) throw Error('Invalid snapshot image identity');
  return ids;
}

/** Inspect only small outer metadata files. Layers remain opaque; nothing is extracted. */
export class DockerArchiveValidator extends Writable {
  constructor(expected) {
    super(); this.expected = new Set(expected); this.header = Buffer.alloc(0);
    this.padding = 0; this.entry = null; this.manifest = null; this.hashes = new Map(); this.metadata = new Map();
    this.safety = new TarValidator(); this.safety.on('error', error => this.destroy(error));
  }
  finishEntry() {
    const entry = this.entry;
    if (entry.parts) {
      const bytes = Buffer.concat(entry.parts);
      if (entry.name === 'manifest.json') {
        if (this.manifest) throw Error('Duplicate image manifest');
        this.manifest = JSON.parse(bytes.toString('utf8'));
      } else {
        const digest = createHash('sha256').update(bytes).digest('hex');
        if (this.hashes.has(entry.name)) throw Error('Duplicate image configuration');
        this.hashes.set(entry.name, 'sha256:' + digest);
        try { this.metadata.set('sha256:' + digest, JSON.parse(bytes.toString('utf8'))); } catch { /* opaque small layer */ }
      }
    }
    this.padding = (512 - entry.size % 512) % 512; this.entry = null;
  }
  consume(chunk) {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.entry) {
        const n = Math.min(this.entry.remaining, chunk.length - offset);
        if (this.entry.parts) this.entry.parts.push(Buffer.from(chunk.subarray(offset, offset + n)));
        this.entry.remaining -= n; offset += n;
        if (!this.entry.remaining) this.finishEntry();
      } else if (this.padding) {
        const n = Math.min(this.padding, chunk.length - offset); this.padding -= n; offset += n;
      } else {
        const n = Math.min(512 - this.header.length, chunk.length - offset);
        this.header = Buffer.concat([this.header, chunk.subarray(offset, offset + n)]); offset += n;
        if (this.header.length !== 512) continue;
        const h = this.header; this.header = Buffer.alloc(0);
        if (h.every(byte => byte === 0)) continue;
        const namePart = h.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
        const prefix = h.subarray(257, 263).toString('ascii') === 'ustar\0' ? h.subarray(345, 500).toString('utf8').replace(/\0.*$/, '') : '';
        const name = path.posix.normalize(prefix ? prefix + '/' + namePart : namePart);
        safeArchiveName(name);
        const size = Number.parseInt(h.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8);
        if (!Number.isSafeInteger(size) || size < 0) throw Error('Invalid image archive length');
        const type = String.fromCharCode(h[156] || 48);
        if (!['0', '5'].includes(type)) throw Error('Unsupported Docker archive entry');
        if (name === 'manifest.json' && size > 2 * 1024 * 1024) throw Error('Image manifest is too large');
        const capture = type === '0' && size <= 2 * 1024 * 1024
          && (name === 'manifest.json' || /(?:^|\/)[a-f0-9]{64}(?:\.json)?$/.test(name));
        this.entry = { name, size, remaining: size, parts: capture ? [] : null };
        if (!size) this.finishEntry();
      }
    }
  }
  _write(chunk, encoding, done) {
    try { this.consume(chunk); this.safety.write(chunk, encoding, done); } catch (error) { done(error); }
  }
  _final(done) {
    this.safety.end(() => {
      try {
        if (!Array.isArray(this.manifest) || !this.manifest.length || this.manifest.length > this.expected.size * 16) throw Error('Image archive does not match the snapshot');
        // Classic Docker IDs name a config; containerd IDs can name an OCI manifest/index.
        const reaches = (root, config, visited = new Set()) => {
          if (root === config) return true;
          if (visited.has(root) || visited.size > 64) return false;
          visited.add(root);
          const node = this.metadata.get(root);
          if (node?.config?.digest === config) return true;
          return Array.isArray(node?.manifests) && node.manifests.some(child => reaches(child.digest, config, visited));
        };
        const found = new Set();
        for (const image of this.manifest) {
          const layers = image.Layers ?? []; // Docker emits null for a scratch image.
          if ((image.RepoTags != null && (!Array.isArray(image.RepoTags) || image.RepoTags.length))
            || typeof image.Config !== 'string' || !Array.isArray(layers)) throw Error('Only tag-free snapshot images may be imported');
          safeArchiveName(image.Config);
          for (const layer of layers) { if (typeof layer !== 'string') throw Error('Invalid image layer'); safeArchiveName(layer); }
          const configId = this.hashes.get(path.posix.normalize(image.Config));
          const roots = [...this.expected].filter(root => reaches(root, configId));
          if (!configId || !roots.length) throw Error('Unexpected or missing image configuration');
          roots.forEach(root => found.add(root));
        }
        if (found.size !== this.expected.size) throw Error('Image archive omits a snapshot image');
        done();
      } catch (error) { done(error); }
    });
  }
  _destroy(error, done) { this.safety.destroy(); done(error); }
}

export async function verifyImageArchive(store, manifest, key) {
  if (!manifest.components.images) throw Error('This older snapshot has no image archive; provide its exact saved images separately');
  await pipeline(await decryptStream(store, manifest.components.images, key), createGunzip(), new DockerArchiveValidator(snapshotImages(manifest)));
}

export async function missingSnapshotImages(manifest) {
  // Distinguish an unavailable daemon from a cold image cache.
  await docker(['info', '--format', '{{.OSType}}']);
  const missing = [];
  for (const id of snapshotImages(manifest)) {
    try { await docker(['image', 'inspect', id]); } catch { missing.push(id); }
  }
  return missing;
}

export async function importSnapshotImages(store, manifest, key) {
  // Every encrypted byte and every tag/config identity is verified before Docker receives input.
  await verifyImageArchive(store, manifest, key);
  await docker(['image', 'load', '--quiet'], { input: compose(await decryptStream(store, manifest.components.images, key), createGunzip()) });
  if ((await missingSnapshotImages(manifest)).length) throw Error('Image import did not restore the exact snapshot images');
}
