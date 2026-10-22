import { existsSync, lstatSync, readdirSync, readFileSync, statSync, realpathSync } from 'node:fs';
import { basename, join, parse as parsePath, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import type { KnowledgeScope, PalaceOptions } from './types.js';
import { hash, clip } from './util.js';

export interface DocumentSource { path:string; scope:KnowledgeScope; kind:'document'|'skill'; }
const inside=(root:string,path:string)=>{const r=relative(root,path);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!parsePath(r).root);};
export class SourceCatalog {
  readonly projects:string[];
  readonly sources:string[];
  readonly defaults:boolean;
  constructor(options:PalaceOptions) {
    this.projects=[...new Set((options.projectRoots??[]).map(p=>resolve(p)))].slice(0,32);
    this.defaults=options.discoverKnownSources??options.sourceRoots===undefined;
    const known=this.defaults?[
      join(homedir(),'.pi','agent','sessions'),join(homedir(),'.claude','projects'),
      join(homedir(),'.codex','sessions'),join(homedir(),'.mcp-palace')
    ]:[];
    this.sources=[...new Set([...known,...(options.sourceRoots??[])].map(p=>resolve(p)))].slice(0,32);
    for(const root of this.projects)for(const name of ['.pi','.claude','.codex','.mcp-palace'])
      this.sources.push(join(root,name));
    for(const root of [...this.sources,...this.projects])if(root===parsePath(root).root)throw new Error('FULL_DISK_SOURCE_FORBIDDEN');
  }
  scope(path:string):KnowledgeScope {
    const absolute=resolve(path),root=[...this.projects].sort((a,b)=>b.length-a.length).find(r=>inside(r,absolute));
    if(!root)return {visibility:'account'};
    const name=basename(root),collision=this.projects.filter(p=>basename(p)===name).length>1;
    return {projectId:collision?name+'@'+hash(root).slice(0,8):name,visibility:'project'};
  }
  logRoots():string[] {return [...new Set(this.sources)].filter(p=>existsSync(p));}
  documents(maxFiles=32):DocumentSource[] {
    const out:DocumentSource[]=[];
    const add=(path:string,scope:KnowledgeScope,kind:'document'|'skill')=>{
      if(out.length>=maxFiles||!existsSync(path))return;
      try {const stat=lstatSync(path);if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=256*1024)out.push({path,scope,kind});}catch{}
    };
    const skills=(dir:string,scope:KnowledgeScope)=>{
      if(!existsSync(dir)||out.length>=maxFiles)return;
      try{
        for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,32))
          if(entry.isDirectory()&&!entry.isSymbolicLink())add(join(dir,entry.name,'SKILL.md'),scope,'skill');
      }catch{}
    };
    for(const root of this.projects){
      const scope=this.scope(root);
      for(const name of ['README.md','AGENTS.md'])add(join(root,name),scope,'document');
      skills(join(root,'skills'),scope);
    }
    if(this.defaults)skills(join(homedir(),'.codex','skills'),{visibility:'account'});
    for(const source of this.sources)if(/\.(md|markdown)$/i.test(source))add(source,this.scope(source),'document');
    return out;
  }
}
export function readDocument(path:string):{bytes:Buffer;text:string;hash:string} {
  const st=statSync(path);if(!st.isFile()||st.size>256*1024)throw new Error('DOCUMENT_TOO_LARGE');
  const bytes=readFileSync(path);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  return {bytes,text,hash:hash(bytes)};
}
export function extractDocument(text:string):{summary:string;body:string} {
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const title=(lines.find(l=>/^#{1,3}\s+\S/.test(l))??lines[0]??'Project document').replace(/^#+\s*/,'');
  const meaningful=lines.filter(l=>!/^---$|^<!--|^\|[\s:|-]+\|$/.test(l.trim()));
  return {summary:clip(title,256),body:clip(meaningful.join('\n'),8192)};
}
function extract(value:unknown):string {
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(extract).filter(Boolean).join('\n');
  if(!value||typeof value!=='object')return '';
  const x=value as Record<string,unknown>;
  if(typeof x.text==='string')return x.text;
  if(x.content!==undefined)return extract(x.content);
  if(x.output!==undefined)return extract(x.output);
  return '';
}
export function extractObservation(raw:string,kind:string,tool:string):{summary:string;body:string;status:'observed'|'hypothesis'}|null {
  let text=raw;
  try{
    const x=JSON.parse(raw) as Record<string,unknown>;
    const m=x.message as Record<string,unknown>|undefined,p=x.payload as Record<string,unknown>|undefined;
    text=extract(m?.content??p?.output??p?.content??p?.message??x.text??x.output??x.content)||raw;
  }catch{}
  text=text.replace(/\u001b\[[0-9;]*m/g,'').trim();
  if(!text||['session','session_info','user','user_message'].includes(kind))return null;
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const informative=lines.filter(l=>! /^(?:ok|done|waiting|running|polling|success|exit code[: ]+0|\d+%)\.?$/i.test(l));
  if(!informative.length)return null;
  const joined=informative.join('\n');
  const isResult=/tool_result|tool_call_result/.test(kind);
  const explicit=/\b(?:decision|constraint|because|must|never|error|failed|exception|fix|solution|resolved|requires|unsupported|timeout)\b/i.test(joined);
  if(!isResult&&!explicit)return null;
  if(!isResult&&kind==='tool_call')return null;
  const salient=informative.find(l=>/\b(?:error|failed|exception|decision|constraint|fix|resolved|requires|unsupported|timeout)\b/i.test(l))??informative[0];
  const prefix=isResult?'Observed '+(tool||'tool')+' output: ':'Source claim: ';
  return {summary:clip(prefix+salient,256),body:clip(joined,8192),status:isResult?'observed':'hypothesis'};
}
export async function gitSnapshot(root:string):Promise<string|null> {
  if(!existsSync(join(root,'.git')))return null;
  return new Promise(resolveSnapshot=>{
    execFile('git',['-C',root,'log','-5','--format=%H%x09%ct%x09%s'],{timeout:2000,maxBuffer:32768,windowsHide:true},(error,stdout)=>{
      if(error){resolveSnapshot(null);return;}
      resolveSnapshot(String(stdout).trim()||null);
    });
  });
}
