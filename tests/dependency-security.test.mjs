import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Resolve through the real build consumer, so an unpatched pnpm peer context
// cannot accidentally make this test pass using an unrelated patched copy.
const server = createRequire(new URL('../apps/server/package.json', import.meta.url));
const loader = createRequire(server.resolve('ts-loader'));
const micromatch = createRequire(loader.resolve('micromatch'));
const braces = micromatch('braces');

test('build glob parser rejects deeply nested brace and parenthesis patterns before stack exhaustion', () => {
  for (const [open,close] of [['{','}'],['(',')']]) {
    const pattern=open.repeat(4000)+'a,b'+close.repeat(4000);
    for (const method of ['parse','compile','expand','stringify']) {
      assert.throws(()=>braces[method](pattern),/Brace nesting exceeds the safe limit/);
    }
  }
});

test('build glob AST walkers also bound caller-supplied nesting', () => {
  for (const method of ['compile','expand','stringify']) {
    const root={type:'root',nodes:[]};let current=root;
    for(let i=0;i<5000;i++){const child={type:'paren',nodes:[],parent:current};current.nodes.push(child);current=child;}
    current.nodes.push({type:'text',value:'a',parent:current});
    assert.throws(()=>braces[method](root),/Brace nesting exceeds the safe limit/);
  }
});

test('normal nested and escaped build globs retain their behavior', () => {
  assert.deepEqual(braces.expand('src/{app,{shared,lib}}/*.{ts,tsx}'),[
    'src/app/*.ts','src/app/*.tsx','src/shared/*.ts','src/shared/*.tsx','src/lib/*.ts','src/lib/*.tsx',
  ]);
  assert.deepEqual(braces.expand('src/\\{literal\\}/x.ts'),['src/{literal}/x.ts']);
  assert(loader('micromatch').isMatch('src/lib/x.ts','src/{app,{shared,lib}}/*.{ts,tsx}'));
});
