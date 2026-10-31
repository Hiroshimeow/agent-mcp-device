import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import os from 'node:os';
import { verifyPackageImports } from '../../scripts/v12/palace-package-closure.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('standalone public plugin types resolve without the Device package',async()=>{
  const built=spawnSync(process.execPath,[path.join(root,'scripts/v12/build-palace-package.mjs')],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(built.status,0,built.stderr);
  const {output}=JSON.parse(built.stdout);
  const pending=[path.join(output,'dist/plugins/palace/index.d.ts'),path.join(output,'dist/plugins/palace/plugin.d.ts')],seen=new Set();
  while(pending.length){
    const file=pending.pop();if(seen.has(file))continue;seen.add(file);
    const text=await fs.readFile(file,'utf8');
    const imports=ts.preProcessFile(text,true,true).importedFiles;
    for(const item of imports){
      if(!item.fileName.startsWith('.'))continue;
      const resolved=ts.resolveModuleName(item.fileName,file,{module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext},ts.sys).resolvedModule;
      assert.ok(resolved,`Missing public declaration dependency ${path.relative(output,file)} -> ${item.fileName}`);
      const rel=path.relative(output,resolved.resolvedFileName);
      assert.ok(!rel.startsWith('..')&&!path.isAbsolute(rel),`Declaration escapes standalone tarball: ${rel}`);
      if(resolved.resolvedFileName.endsWith('.d.ts'))pending.push(resolved.resolvedFileName);
    }
  }
  assert.ok(seen.size>=3,'The test must inspect the exported declarations and their dependencies.');
});

async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'palace-closure-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:30}));
  const pkg=path.join(dir,'package');await fs.mkdir(pkg);return {dir,pkg};
}
test('closure rejects imports escaping the package even when the external file exists',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.dir,'outside.js'),'export const x=1;');
  await fs.writeFile(path.join(f.pkg,'index.js'),"export {x} from '../outside.js';");
  const result=await verifyPackageImports(f.pkg);
  assert.equal(result.ok,false);assert.equal(result.unresolved[0].reason,'import-escapes-package');
});
test('closure uses syntax nodes rather than matching import text inside comments and strings',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.pkg,'index.js'),"// import missing from './missing.js'\nexport const example=\"import('also-missing')\";\n");
  assert.equal((await verifyPackageImports(f.pkg)).ok,true);
});
test('computed runtime imports require an explicitly reviewed path contract',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.pkg,'index.js'),'export const load=name=>import(name);');
  const result=await verifyPackageImports(f.pkg);
  assert.equal(result.ok,false);assert.equal(result.unresolved[0].reason,'unreviewed-dynamic-import');
});
