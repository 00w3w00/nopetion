import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv.find(arg=>arg.startsWith('--root='))?.slice(7) || fileURLToPath(new URL('../', import.meta.url)));
const workingTree = process.argv.includes('--working-tree');
const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
const commercial = /^(?:apps\/(?:client|server)\/src\/ee|packages\/(?:ee|base-formula))\/(?!LICENSE$)/;
const privateFile = /(?:^|\/)(?:\.env(?!\.example$)(?:\.|$)|AGENTS\.md$|SERVER-BUNDLE\.json$|docker-compose\.override\.yml$|\.gitmodules$)|^docs\/verification\//;
const ignored = new Set(['node_modules','dist','.git','.nx','.pnpm-store','coverage']);
const allowedRoot = new Set(['apps','packages','patches','notices','scripts','tests','.github','docs','.dockerignore','.env.example','.gitignore','.node-version','Dockerfile','LICENSE','README.md','SECURITY.md','CONTRIBUTING.md','docker-compose.yml','docker-compose.dev.yml','nx.json','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','PUBLIC-SOURCE.json']);
const errors = [], files=[];
async function walk(relative='') {
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})) {
    const file=relative?relative+'/'+entry.name:entry.name;
    if(ignored.has(entry.name))continue;
    if(!relative&&!allowedRoot.has(entry.name)) { if(!workingTree)errors.push('Unexpected root entry: '+file); continue; }
    if(workingTree && ((!relative&&!allowedRoot.has(entry.name)) || file==='docs/verification' || file==='docs/personal-fork.md' || (file.startsWith('docs/') && !['docs/readme','docs/server-install.md','docs/server-install.ko-KR.md','docs/ai-connection.md','docs/backup-restore.md','docs/upstream-readme.md','docs/upstream-source.json','docs/source-release.md'].some(p=>file===p||file.startsWith(p+'/')))))continue;
    if(entry.isSymbolicLink()){errors.push('Symbolic link: '+file);continue;}
    if(privateFile.test(file)||commercial.test(file)||file.split('/').some(part=>['data','logs','backups'].includes(part))) { errors.push('Excluded source: '+file); continue; }
    if(entry.isDirectory()){await walk(file);continue;}
    if(!entry.isFile()){errors.push('Non-regular source: '+file);continue;}
    const bytes=await readFile(path.join(root,file));
    if(/\.tail[a-f0-9]{6,}\.ts\.net\b/i.test(bytes.toString('utf8')) || /\/(?:Users\/[a-z0-9_.-]+\/(?:Desktop|Documents|\.codex|\.ssh)|home\/[a-z0-9_.-]+\/(?:\.ssh|\.config))\//i.test(bytes.toString('utf8')))errors.push('Private host/home path: '+file);
    files.push({path:file,sha256:sha(bytes)});
  }
}
await walk();
for(const required of ['LICENSE','notices/NOPETION-MODIFICATIONS.md','notices/vendored/manifest.json','apps/client/src/ee/LICENSE','packages/ee/LICENSE','packages/base-formula/LICENSE','SECURITY.md','CONTRIBUTING.md','docs/source-release.md']) {
  if(!files.some(f=>f.path===required))errors.push('Required notice or guide missing: '+required);
}
const notices=JSON.parse(await readFile(path.join(root,'notices/vendored/manifest.json'),'utf8'));
for(const entry of notices.entries) {
  for(const key of ['licenseFile','additionalCopyrightFile','additionalLicenseFile']) {
    if(!entry[key])continue;
    const bytes=await readFile(path.join(root,'notices/vendored',entry[key]));
    if(sha(bytes)!==entry[key==='licenseFile'?'sha256':key+'Sha256'])errors.push('Changed original notice: '+entry[key]);
  }
  for(const local of entry.localPaths)await lstat(path.join(root,local));
}
if(!workingTree) {
  // An archive has no history. A newly initialized repository must also be
  // clean in every reachable revision, including tags and remote branches.
  try {
    await lstat(path.join(root,'.git'));
    const commits=execFileSync('git',['-C',root,'rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
    for(const commit of commits) {
      const tree=execFileSync('git',['-C',root,'ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n');
      if(tree.some(file=>!allowedRoot.has(file.split('/')[0])||commercial.test(file)||privateFile.test(file)||file==='apps/server/src/ee'||file.split('/').some(part=>['data','logs','backups'].includes(part))))errors.push('Excluded material in Git revision '+commit);
    }
  } catch(error) { if(error.code!=='ENOENT')throw error; }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({scope:workingTree?'exportable working source only; original history not approved':'extracted source and all reachable Git history',files:files.length,vendoredNotices:notices.entries.length,passed:true},null,2));
