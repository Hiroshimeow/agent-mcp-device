// Build-time verification only. Reuse TypeScript's parser/resolver; no runtime dependency is added.
import fs from 'node:fs/promises';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const compilerOptions={module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext};
const builtins={has:isBuiltin}; // Includes prefix-only built-ins such as node:sqlite.
const within=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
async function filesUnder(dir){
  const result=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw new Error('PALACE_PACKAGE_SYMLINK: '+file);
    if(entry.isDirectory())result.push(...await filesUnder(file));else if(entry.isFile())result.push(file);
  }
  return result;
}
function importsOf(filename,text){
  const source=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true,filename.endsWith('.cjs')||filename.endsWith('.js')?ts.ScriptKind.JS:ts.ScriptKind.TS);
  const imports=[],dynamic=[];
  const add=node=>{if(node&&ts.isStringLiteralLike(node))imports.push(node.text);};
  const visit=node=>{
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))add(node.moduleSpecifier);
    if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference))add(node.moduleReference.expression);
    if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument))add(node.argument.literal);
    if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))){
      if(node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0]))add(node.arguments[0]);
      else dynamic.push({line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,expression:node.getText(source)});
    }
    ts.forEachChild(node,visit);
  };
  visit(source);return {imports:[...new Set(imports)],dynamic};
}

export async function completeRuntimeClosure(canonicalRoot,packageRoot){
  canonicalRoot=path.resolve(canonicalRoot);packageRoot=path.resolve(packageRoot);
  const pending=(await filesUnder(packageRoot)).filter(file=>/\.(?:c?js|mjs)$/.test(file));
  const seen=new Set(),added=[];
  while(pending.length){
    const packaged=pending.pop();if(seen.has(packaged))continue;seen.add(packaged);
    const canonical=path.join(canonicalRoot,path.relative(packageRoot,packaged));
    const parsed=importsOf(packaged,await fs.readFile(packaged,'utf8'));
    for(const specifier of parsed.imports){
      if(builtins.has(specifier))continue;
      if(!specifier.startsWith('.'))throw new Error('PALACE_RUNTIME_EXTERNAL_DEPENDENCY: '+specifier);
      const resolved=fileURLToPath(new URL(specifier,pathToFileURL(canonical)));
      if(!within(canonicalRoot,resolved)||!await fs.stat(resolved).then(stat=>stat.isFile()).catch(()=>false))
        throw new Error('PALACE_RUNTIME_CLOSURE_FAILED: '+canonical+' -> '+specifier);
      const destination=path.join(packageRoot,path.relative(canonicalRoot,resolved));
      if(!await fs.access(destination).then(()=>true).catch(()=>false)){
        await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(resolved,destination);
        added.push(path.relative(packageRoot,destination).split(path.sep).join('/'));
      }
      pending.push(destination);
    }
  }
  return {checked:seen.size,added};
}

export async function completeDeclarationClosure(canonicalRoot,packageRoot){
  canonicalRoot=path.resolve(canonicalRoot);packageRoot=path.resolve(packageRoot);
  const pending=(await filesUnder(path.join(packageRoot,'dist'))).filter(file=>file.endsWith('.d.ts'));
  const seen=new Set(),added=[];
  while(pending.length){
    const packaged=pending.pop();if(seen.has(packaged))continue;seen.add(packaged);
    const canonical=path.join(canonicalRoot,path.relative(packageRoot,packaged));
    for(const specifier of importsOf(packaged,await fs.readFile(packaged,'utf8')).imports){
      if(builtins.has(specifier))continue;
      if(!specifier.startsWith('.'))throw new Error('PALACE_DECLARATION_EXTERNAL_DEPENDENCY: '+specifier);
      const resolved=ts.resolveModuleName(specifier,canonical,compilerOptions,ts.sys).resolvedModule;
      if(!resolved||!resolved.resolvedFileName.endsWith('.d.ts')||!within(path.join(canonicalRoot,'dist'),resolved.resolvedFileName))
        throw new Error('PALACE_DECLARATION_CLOSURE_FAILED: '+canonical+' -> '+specifier);
      const destination=path.join(packageRoot,path.relative(canonicalRoot,resolved.resolvedFileName));
      if(!await fs.access(destination).then(()=>true).catch(()=>false)){
        await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(resolved.resolvedFileName,destination);
        added.push(path.relative(packageRoot,destination).split(path.sep).join('/'));
      }
      pending.push(destination);
    }
  }
  return {checked:seen.size,added};
}

export async function verifyPackageImports(packageRoot){
  packageRoot=path.resolve(packageRoot);const unresolved=[],dynamicImports=[];
  const files=(await filesUnder(packageRoot)).filter(file=>/\.(?:c?js|mjs|d\.ts)$/.test(file));
  for(const file of files){
    const relative=path.relative(packageRoot,file).split(path.sep).join('/');
    const parsed=importsOf(file,await fs.readFile(file,'utf8'));
    for(const specifier of parsed.imports){
      if(builtins.has(specifier))continue;
      if(!specifier.startsWith('.')){unresolved.push({file:relative,specifier,reason:'undeclared-external-import'});continue;}
      const resolved=file.endsWith('.d.ts')
        ?ts.resolveModuleName(specifier,file,compilerOptions,ts.sys).resolvedModule?.resolvedFileName
        :fileURLToPath(new URL(specifier,pathToFileURL(file)));
      if(!resolved||!within(packageRoot,resolved))unresolved.push({file:relative,specifier,reason:'import-escapes-package'});
      else if(!await fs.stat(resolved).then(stat=>stat.isFile()).catch(()=>false))unresolved.push({file:relative,specifier,reason:'missing-relative-import'});
    }
    for(const item of parsed.dynamic){
      // These are reviewed, intentional configuration boundaries, not hidden module-graph dependencies.
      const allowed=(relative==='dist/plugins/palace/plugin.js'&&/import\(pathToFileURL\(settings\.validationModule\)\.href\)/.test(item.expression))
        ||(relative==='scripts/install-palace-skill.cjs'&&/import\(pathToFileURL\(manager\)\.href\)/.test(item.expression));
      dynamicImports.push({file:relative,...item,contract:allowed?'reviewed-configured-path':'unreviewed'});
      if(!allowed)unresolved.push({file:relative,specifier:item.expression,reason:'unreviewed-dynamic-import'});
    }
  }
  return {ok:unresolved.length===0,filesChecked:files.length,unresolved,dynamicImports};
}
