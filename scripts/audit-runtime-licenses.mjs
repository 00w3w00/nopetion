import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Read the deployed filesystem. No registry fetch, package install, or runtime
// mutation is needed; declarations are evidence, not distribution clearance.
const root = process.argv[2] || '/app';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const noticeName = /^(?:licen[cs]e|notice|copying|copyright|unlicense|ofl)(?:[._-]|$)/i;
function inferLicense(text) {
  // OFL also contains the MIT-style grant sentence; check specific titles first.
  if (/SIL OPEN FONT LICENSE[\s\S]{0,100}Version 1\.1/i.test(text)) return 'OFL-1.1';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE[\s\S]{0,100}Version 3/i.test(text)) return 'AGPL-3.0';
  if (/Apache License[\s\S]{0,150}Version 2\.0/i.test(text)) return 'Apache-2.0';
  if (/free and unencumbered software released into the public domain/i.test(text)) return 'Unlicense';
  if (/permission is hereby granted, free of charge/i.test(text)) return 'MIT';
  if (/ISC License|permission to use, copy, modify, and\/or distribute/i.test(text)) return 'ISC';
  return null;
}
function notices(dir, relative = '', depth = 0) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory() && depth < 2 && !['node_modules', '.git', 'test', 'tests'].includes(entry.name)) {
      return notices(file, rel, depth + 1);
    }
    if (!entry.isFile() || !noticeName.test(entry.name)) return [];
    const bytes = fs.readFileSync(file);
    return [{ file: rel, bytes: bytes.length, sha256: digest(bytes), inferredLicense: inferLicense(bytes.toString('utf8')) }];
  });
}
function inspect(dir) {
  const manifest = path.join(dir, 'package.json');
  if (!fs.existsSync(manifest)) return null;
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const licenseFiles = notices(dir);
  const readmeEvidence = [];
  for (const file of fs.readdirSync(dir).filter(name => /^readme(?:\.|$)/i.test(name))) {
    if (!fs.statSync(path.join(dir, file)).isFile()) continue;
    const bytes = fs.readFileSync(path.join(dir, file));
    const text = bytes.toString('utf8');
    const index = text.search(/^#{1,6}\s+(?:copyright\s*(?:and|&)\s*)?licen[cs]e\b/im);
    if (index < 0) continue;
    const section = text.slice(index).split(/\n#{1,6}\s/)[0];
    readmeEvidence.push({ file, sha256: digest(bytes), licenseSectionSha256: digest(section), inferredLicense: inferLicense(section), hasPermissionText: /permission is hereby granted|permission to use, copy/i.test(section) });
  }
  return { name: data.name, version: data.version, declaredLicense: data.license ?? data.licenses ?? null, licenseFiles, readmeEvidence, repository: data.repository ?? null };
}
const packages = [];
const store = path.join(root, 'node_modules/.pnpm');
for (const entry of fs.readdirSync(store)) {
  const base = path.join(store, entry, 'node_modules');
  if (!fs.existsSync(base)) continue;
  for (const name of fs.readdirSync(base)) {
    const dirs = name.startsWith('@') ? fs.readdirSync(path.join(base, name)).map(child => path.join(name, child)) : [name];
    for (const item of dirs) {
      const dir = path.join(base, item);
      if (!fs.lstatSync(dir).isDirectory()) continue;
      const data = inspect(dir);
      if (data) packages.push(data);
    }
  }
}
packages.sort((a, b) => (a.name + '@' + a.version).localeCompare(b.name + '@' + b.version));
const workspace = ['package.json', 'apps/client/package.json', 'apps/server/package.json', 'packages/editor-ext/package.json', 'packages/base-formula/package.json'].filter(file => fs.existsSync(path.join(root,file))).map(file => ({ file, sha256: digest(fs.readFileSync(path.join(root, file))) }));
const document = {
  checkedAt: new Date().toISOString(), root, scope: 'All physically present pnpm package records, including duplicate versions and build tooling; not a claim of production reachability or distribution rights',
  summary: {
    records: packages.length,
    withNoticeFiles: packages.filter(p => p.licenseFiles.length).length,
    withFullReadmePermissionTextOnly: packages.filter(p => !p.licenseFiles.length && p.readmeEvidence.some(r => r.hasPermissionText)).length,
    withoutNoticeFilesOrFullReadmePermissionText: packages.filter(p => !p.licenseFiles.length && !p.readmeEvidence.some(r => r.hasPermissionText)).length,
  },
  rootNotices: notices(root).filter(n => !n.file.startsWith('node_modules/')),
  licenseBoundaries: ['LICENSE', 'notices/client-ee-LICENSE', 'notices/ee-LICENSE', 'notices/base-formula-LICENSE'].map(file => {
    const target = path.join(root, file);
    return fs.existsSync(target) ? { file, sha256: digest(fs.readFileSync(target)) } : { file, missing: true };
  }),
  fontNotices: notices(path.join(root, 'apps/server/dist/integrations/pdf/fonts')),
  enterpriseArtifacts: { baseFormula: fs.existsSync(path.join(root, 'packages/base-formula/dist/index.server.js')), serverEe: fs.existsSync(path.join(root, 'apps/server/dist/ee/ee.module.js')), clientEeImports: 'Commercial implementations removed from the active source; preserved license files are attribution only' },
  workspace, packages,
};
console.log(JSON.stringify(document, null, 2));
