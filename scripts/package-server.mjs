import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, mkdtemp, readFile, readdir, open, chmod, writeFile, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const rootFiles = ['.dockerignore','.env.example','.gitignore','.node-version','Dockerfile','LICENSE','README.md','SECURITY.md','CONTRIBUTING.md','docker-compose.yml','docker-compose.dev.yml','nx.json','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'];
const sourceDirs = ['apps','packages','patches','notices','scripts','tests'];
const docsFiles = ['server-install.md','server-install.ko-KR.md','ai-connection.md','backup-restore.md','upstream-readme.md','upstream-source.json','source-release.md'];
const excluded = new Set(['node_modules','.git','.nx','.pnpm-store','dist','coverage','data','logs','.DS_Store','__pycache__']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
async function exists(file) { try { await lstat(file); return true; } catch (e) { if(e.code === 'ENOENT') return false; throw e; } }

export async function createServerBundle({ root = defaultRoot, out, publicSource = false }) {
  root = path.resolve(root); out = path.resolve(out);
  if (inside(root, out)) throw new Error('Choose a new output path outside the source checkout');
  if (!out.endsWith('.tar.gz')) throw new Error('Output filename must end in .tar.gz');
  if (await exists(out) || await exists(out+'.sha256')) throw new Error('Output already exists; no files were overwritten');
  const localSecrets = [];
  const env = path.join(root,'.env');
  if (await exists(env)) {
    const stat = await lstat(env); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Local environment must be a regular file');
    for (const line of (await readFile(env,'utf8')).split(/\r?\n/)) {
      const match = /^(APP_SECRET|POSTGRES_PASSWORD)=(.*)$/.exec(line);
      if (match) { const value = match[2].replace(/^['"]|['"]$/g,''); if(value.length>=16 && !value.startsWith('REPLACE_')) localSecrets.push(Buffer.from(value)); }
    }
  }
  const temp = await mkdtemp(path.join(tmpdir(),'nopetion-server-source-'));
  const stage = path.join(temp,'nopetion'), files = []; let archiveLinked = false;
  const archive = path.join(temp,'source.tar.gz');
  try {
    await mkdir(stage,{mode:0o755});
    async function copy(relative) {
      const parts=relative.split(path.sep), base=parts.at(-1);
      if(parts.some(p=>excluded.has(p)) || relative === path.join('notices','corresponding-source.tar.gz') || (base.startsWith('.env') && base!=='.env.example') || /\.(log|pyc)$/.test(base)) return;
      const source = path.join(root,relative), stat = await lstat(source);
      if(stat.isSymbolicLink()) throw new Error('Source bundle refuses symbolic links: '+relative);
      if(stat.isDirectory()) { for(const name of (await readdir(source)).sort()) await copy(path.join(relative,name)); return; }
      if(!stat.isFile()) throw new Error('Source bundle accepts only regular source files');
      const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const opened = await handle.stat();
        if(opened.ino !== stat.ino || opened.dev !== stat.dev || !opened.isFile() || opened.nlink !== 1) throw new Error('Source file changed or has external links');
        bytes = await handle.readFile();
      } finally { await handle.close(); }
      if(localSecrets.some(secret=>bytes.includes(secret))) throw new Error('Source contains a local secret; packaging stopped without exposing it');
      if(publicSource && (/\.tail[a-f0-9]{6,}\.ts\.net\b/i.test(bytes.toString('utf8')) || /\/(?:Users\/[a-z0-9_.-]+\/(?:Desktop|Documents|\.codex|\.ssh)|home\/[a-z0-9_.-]+\/(?:\.ssh|\.config))\//i.test(bytes.toString('utf8')))) throw new Error('Source contains a private host or home path: '+relative);
      const target = path.join(stage,relative); await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,bytes,{flag:'wx'}); await chmod(target,stat.mode & 0o111 ? 0o755 : 0o644);
      files.push({path:relative.split(path.sep).join('/'),bytes:bytes.length,sha256:digest(bytes)});
    }
    for(const file of rootFiles) await copy(file);
    for(const dir of sourceDirs) await copy(dir);
    for(const file of docsFiles) await copy(path.join('docs',file));
    await copy(path.join('docs','readme'));
    if(publicSource) {
      if(await exists(path.join(root,'.github/workflows/source-checks.yml'))) await copy('.github/workflows/source-checks.yml');
    }
    // Commercial implementations must not enter the private transfer either.
    for(const file of files.filter(f=>/^(apps\/(client|server)\/src\/ee|packages\/(ee|base-formula))\//.test(f.path))) {
      if(!/(^|\/)LICENSE$/.test(file.path)) throw new Error('Enterprise implementation found in source bundle: '+file.path);
    }
    const pkg = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
    const manifest = {bundleId:randomUUID(),createdAt:new Date().toISOString(),application:'Nopetion',sourceVersion:pkg.version,nodeMajor:24,packageManager:pkg.packageManager,...(publicSource ? {distribution:'CE source only; no dependencies or prebuilt images',publicSourceCandidate:true} : {privateServerTestBundle:true,publicDistributionApproved:false}),excluded:['real .env files','user data','backups','Git history','node_modules','build outputs','private verification artifacts','host-specific Compose override'],files:files.sort((a,b)=>a.path.localeCompare(b.path))};
    await writeFile(path.join(stage,publicSource?'PUBLIC-SOURCE.json':'SERVER-BUNDLE.json'),JSON.stringify(manifest,null,2)+'\n');
    await execute('tar',[...(process.platform === 'darwin' ? ['--no-xattrs', '--no-mac-metadata'] : []),'-czf',archive,'-C',temp,'nopetion'],{env:{...process.env,COPYFILE_DISABLE:'1'},maxBuffer:1024*1024});
    const bytes = await readFile(archive); await link(archive,out); archiveLinked = true;
    await writeFile(out+'.sha256',digest(bytes)+'  '+path.basename(out)+'\n',{flag:'wx',mode:0o600});
    await chmod(out,0o600);
    return {path:out,sha256File:out+'.sha256',sha256:digest(bytes),bytes:bytes.length,files:files.length,bundleId:manifest.bundleId};
  } catch(error) {
    if(archiveLinked) { const [own,current]=await Promise.all([lstat(archive),lstat(out).catch(()=>null)]); if(current?.ino===own.ino&&current.dev===own.dev) await rm(out); }
    throw error;
  } finally { await rm(temp,{recursive:true,force:true}); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2), publicSource=args[0]==='--public';
  if(publicSource)args.shift();
  if(args.length!==2 || args[0]!=='--out') { process.stderr.write('Usage: node scripts/package-server.mjs [--public] --out /absolute/path/nopetion-source.tar.gz\n'); process.exitCode=1; }
  else { try { console.log(JSON.stringify(await createServerBundle({out:args[1],publicSource}),null,2)); } catch(error) { console.error(error.message); process.exitCode=1; } }
}
