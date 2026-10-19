import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const [auditFile, output] = process.argv.slice(2);
if (!auditFile || !output) throw new Error('Usage: node scripts/collect-license-notices.mjs audit.json output-directory');
const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
const packages = audit.packages.filter(p => !p.licenseFiles.length && !p.readmeEvidence.some(r => r.hasPermissionText));
const notice = /^(?:licen[cs]e|notice|copying|copyright|unlicense)(?:[._-]|$)/i;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(output, { recursive: true });

async function get(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['registry.npmjs.org', 'raw.githubusercontent.com'].includes(parsed.hostname)) throw Error('Unexpected notice source');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok) throw Error('HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}

// Read regular license files from an integrity-verified npm archive. Nothing is
// extracted by pathname and no install hooks or downloaded source are executed.
function tarNotices(bytes) {
  const tar = zlib.gunzipSync(bytes, { maxOutputLength: 80 * 1024 * 1024 });
  const found = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = Number.parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw Error('Invalid archive length');
    const type = header[156];
    if ([0, 48].includes(type) && notice.test(path.posix.basename(name)) && size <= 1024 * 1024) found.push({ name, bytes: tar.subarray(offset + 512, offset + 512 + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return found;
}

const result = { checkedAt: new Date().toISOString(), scope: 'Original notices from pinned npm package releases or their registry-declared Git commit; no license entitlement or compatibility assertion', entries: [] };
const cachedFile = path.join(output, 'manifest.json');
const cached = fs.existsSync(cachedFile) ? JSON.parse(fs.readFileSync(cachedFile, 'utf8')).entries : [];
function classify(record) {
  for (const file of record.files) {
    file.scope = file.source.startsWith('https://raw.githubusercontent.com/') ? 'repository root at release commit' : /^package\/[^/]+$/.test(file.originalPath) ? 'package root' : 'nested notice; may cover a separate third-party component';
  }
  record.hasPackageLevelNotice = record.files.some(file => file.scope !== 'nested notice; may cover a separate third-party component');
  record.status = record.hasPackageLevelNotice ? 'Original package/repository notice collected; license scope still requires review' : record.files.length ? 'Only nested component notice found; parent package notice remains pending' : 'No full notice located at pinned release/commit';
}
const save = () => fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(result, null, 2));
let next = 0;
async function worker() {
  while (next < packages.length) {
    const p = packages[next++], record = { name: p.name, version: p.version, declaredLicense: p.declaredLicense, sources: [], files: [], attempts: [] };
    const previous = cached.find(entry => entry.name === p.name && entry.version === p.version);
    if (previous && (!process.argv.includes("--retry-pending") || previous.hasPackageLevelNotice) && previous.files.every(file => fs.existsSync(path.join(output, file.file)) && sha(fs.readFileSync(path.join(output, file.file))) === file.sha256)) {
      classify(previous); result.entries.push(previous); save(); continue;
    }
    const dir = p.name.replace(/[^a-z0-9._-]/gi, '_') + '-' + p.version.replace(/[^a-z0-9._-]/gi, '_');
    const store = (name, bytes, source) => {
      const target = path.join(dir, record.files.length + '-' + path.posix.basename(name).replace(/[^a-z0-9._-]/gi, '_'));
      fs.mkdirSync(path.join(output, dir), { recursive: true });
      fs.writeFileSync(path.join(output, target), bytes);
      record.files.push({ file: target, originalPath: name, sha256: sha(bytes), bytes: bytes.length, source });
    };
    try {
      const url = 'https://registry.npmjs.org/' + encodeURIComponent(p.name) + '/' + encodeURIComponent(p.version);
      const bytes = await get(url), meta = JSON.parse(bytes.toString('utf8'));
      if (meta.name !== p.name || meta.version !== p.version) throw Error('Registry release mismatch');
      record.sources.push({ url, sha256: sha(bytes), gitHead: meta.gitHead ?? null });
      if (meta.dist?.tarball) {
        try {
          const archive = await get(meta.dist.tarball);
          const integrity = meta.dist.integrity?.split(' ')[0];
          if (integrity) {
            const split = integrity.indexOf('-'), algorithm = integrity.slice(0, split), expected = integrity.slice(split + 1);
            if (!['sha512', 'sha256', 'sha1'].includes(algorithm) || crypto.createHash(algorithm).update(archive).digest('base64') !== expected) throw Error('Archive integrity mismatch');
          } else if (!meta.dist.shasum || crypto.createHash('sha1').update(archive).digest('hex') !== meta.dist.shasum) throw Error('Archive has no matching integrity proof');
          record.sources.push({ url: meta.dist.tarball, sha256: sha(archive), integrityVerified: true });
          for (const file of tarNotices(archive)) store(file.name, file.bytes, meta.dist.tarball);
        } catch (error) { record.attempts.push({ stage: 'release archive', error: error.message }); }
      }
      if (!record.files.some(file => /^package\/[^/]+$/.test(file.originalPath)) && /^[0-9a-f]{40}$/i.test(meta.gitHead || '')) {
        const repository = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
        const repo = repository?.match(/github\.com[/:]([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?$/i);
        if (repo) {
          for (const name of ['LICENSE', 'LICENSE.md', 'license', 'license.md', 'LICENSE-MIT', 'LICENSE.txt', 'COPYING', 'UNLICENSE']) {
            const source = `https://raw.githubusercontent.com/${repo[1]}/${repo[2]}/${meta.gitHead}/${name}`;
            try { const text = await get(source); store(name, text, source); break; }
            catch (error) { if (error.message !== 'HTTP 404') record.attempts.push({ source, error: error.message }); }
          }
        }
      }
      classify(record);
    } catch (error) { record.status = 'Pending'; record.error = error.message; }
    result.entries.push(record); save();
    console.log(p.name + '@' + p.version + ': ' + record.files.length + ' notice files');
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
result.entries.sort((a,b) => a.name.localeCompare(b.name));
result.summary = { requested: packages.length, collected: result.entries.filter(r => r.files.length).length, packageLevelNotices: result.entries.filter(r => r.hasPackageLevelNotice).length, pendingPackageNotices: result.entries.filter(r => !r.hasPackageLevelNotice).length };
save(); console.log(JSON.stringify(result.summary));
