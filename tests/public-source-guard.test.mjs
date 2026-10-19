import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script=fileURLToPath(new URL('../scripts/check-public-source.mjs',import.meta.url));
async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'nopetion-public-guard-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const file of ['LICENSE','SECURITY.md','CONTRIBUTING.md','docs/source-release.md','notices/NOPETION-MODIFICATIONS.md','apps/client/src/ee/LICENSE','packages/ee/LICENSE','packages/base-formula/LICENSE']) {
    await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'Synthetic fixture notice\n');
  }
  await mkdir(path.join(root,'notices/vendored'));await writeFile(path.join(root,'notices/vendored/manifest.json'),JSON.stringify({entries:[]}));
  return root;
}
const check=root=>spawnSync(process.execPath,[script,'--root='+root],{encoding:'utf8'});

test('clean source with retained license boundaries passes',async t=>{
  const result=check(await fixture(t));assert.equal(result.status,0,result.stderr);
});
test('private root data and unlisted backup files are refused before reading their contents',async t=>{
  const root=await fixture(t);await mkdir(path.join(root,'data'));await writeFile(path.join(root,'data','private'),'synthetic private data');
  await writeFile(path.join(root,'database-backup.sql'),'synthetic private backup',{mode:0o000});
  const result=check(root);assert.equal(result.status,1);assert(result.stderr.includes('Unexpected root entry: data'));assert(result.stderr.includes('Unexpected root entry: database-backup.sql'));assert(!result.stderr.includes('EACCES'));
});
test('a deleted private file in reachable Git history still blocks publication',async t=>{
  const root=await fixture(t),git=args=>execFileSync('git',['-C',root,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Source Guard Fixture','-c','user.email=fixture@example.invalid',...args],{encoding:'utf8'});
  git(['init','--template=','--initial-branch=main']);await writeFile(path.join(root,'database-backup.sql'),'synthetic backup');git(['add','--all']);git(['commit','-qm','Fixture with excluded history']);git(['rm','database-backup.sql']);git(['commit','-qm','Remove private working file']);
  const result=check(root);assert.equal(result.status,1);assert(result.stderr.includes('Excluded material in Git revision'));
});
