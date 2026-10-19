import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServerBundle } from '../scripts/package-server.mjs';
async function fixture(t) {
  const base=await mkdtemp(path.join(tmpdir(),'nopetion-source-package-test-')),root=path.join(base,'project');await mkdir(root);
  t.after(()=>rm(base,{recursive:true,force:true}));
  const files=['.dockerignore','.env.example','.gitignore','.node-version','Dockerfile','LICENSE','README.md','SECURITY.md','CONTRIBUTING.md','docker-compose.yml','docker-compose.dev.yml','nx.json','pnpm-lock.yaml','pnpm-workspace.yaml','docs/server-install.md','docs/server-install.ko-KR.md','docs/ai-connection.md','docs/backup-restore.md','docs/upstream-readme.md','docs/upstream-source.json','docs/source-release.md','docs/readme/en-US.md','apps/client/source.ts','packages/editor-ext/source.ts','patches/fix.patch','notices/LICENSE','scripts/init-env.mjs','tests/example.mjs'];
  for(const file of files){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'synthetic source\n');}
  await writeFile(path.join(root,'package.json'),JSON.stringify({version:'0.96.0',packageManager:'pnpm@11.28.2'}));
  return {base,root,out:path.join(base,'nopetion.tar.gz')};
}
test('source bundle excludes host secrets, data, history, backups and dependencies',async t=>{
 const f=await fixture(t);for(const name of ['.env','docker-compose.override.yml','apps/client/.env.local','apps/client/dist/private.txt','node_modules/private.txt','docs/verification/private.json','.git/private.txt','data/private.txt']){await mkdir(path.dirname(path.join(f.root,name)),{recursive:true});await writeFile(path.join(f.root,name),'private');}
 const result=await createServerBundle(f);const entries=execFileSync('tar',['-tzf',result.path],{encoding:'utf8'});assert(!entries.includes('private'));assert(!entries.includes('docker-compose.override'));assert(entries.includes('nopetion/SERVER-BUNDLE.json'));assert(entries.includes('nopetion/.env.example'));assert(entries.includes('nopetion/docs/source-release.md'));assert(entries.includes('nopetion/SECURITY.md'));assert.equal(result.files,29);assert((await readFile(result.sha256File,'utf8')).startsWith(result.sha256));
});
test('source bundle refuses actual environment secrets accidentally copied into code',async t=>{
 const f=await fixture(t),secret='synthetic-private-value-0123456789';await writeFile(path.join(f.root,'.env'),'APP_SECRET='+secret+'\n');await writeFile(path.join(f.root,'apps/client/source.ts'),secret);await assert.rejects(createServerBundle(f),/local secret/);
});
test('source bundle never follows source symlinks outside the project',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.base,'outside'),'private');await symlink(path.join(f.base,'outside'),path.join(f.root,'apps/client/link'));await assert.rejects(createServerBundle(f),/symbolic links/);
});
test('source bundle refuses Enterprise implementations while allowing their license notices',async t=>{
 const f=await fixture(t);await mkdir(path.join(f.root,'packages/ee'));await writeFile(path.join(f.root,'packages/ee/LICENSE'),'terms');await writeFile(path.join(f.root,'packages/ee/implementation.ts'),'commercial source');await assert.rejects(createServerBundle(f),/Enterprise implementation/);
});
test('source bundle preserves an existing output and requires an external destination',async t=>{
 const f=await fixture(t);await writeFile(f.out,'keep');await assert.rejects(createServerBundle(f),/already exists/);assert.equal(await readFile(f.out,'utf8'),'keep');await assert.rejects(createServerBundle({...f,out:path.join(f.root,'source.tar.gz')}),/outside/);
});
test('public source export has its own manifest and preserves source notices without transferring Git history',async t=>{
 const f=await fixture(t);
 for(const name of ['SECURITY.md','CONTRIBUTING.md','docs/source-release.md'])await writeFile(path.join(f.root,name),'source release instructions\n');
 await mkdir(path.join(f.root,'.git'));await writeFile(path.join(f.root,'.git','private-commercial-history'),'excluded');
 const result=await createServerBundle({...f,publicSource:true});
 const entries=execFileSync('tar',['-tzf',result.path],{encoding:'utf8'});
 assert(entries.includes('nopetion/PUBLIC-SOURCE.json'));assert(!entries.includes('SERVER-BUNDLE.json'));assert(!entries.includes('private-commercial-history'));
 const manifest=JSON.parse(execFileSync('tar',['-xOzf',result.path,'nopetion/PUBLIC-SOURCE.json'],{encoding:'utf8'}));
 assert.equal(manifest.publicSourceCandidate,true);assert.equal(manifest.distribution,'CE source only; no dependencies or prebuilt images');
 assert(manifest.files.some(f=>f.path==='SECURITY.md'));assert.equal(manifest.privateServerTestBundle,undefined);
});
test('public source export blocks a private Tailscale hostname copied into source',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.root,'apps/client/source.ts'),'https://example.'+'tailabcdef'+'.ts.net');
 await assert.rejects(createServerBundle({...f,publicSource:true}),/private host/);
});
