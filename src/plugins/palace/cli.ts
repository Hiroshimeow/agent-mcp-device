#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { queryTerms, rankCandidates } from './retrieval.js';
import { preview, boundedInt } from './util.js';
import type { KnowledgeCard } from './types.js';

// Standalone read-only CLI for the installable Palace plugin.
// Reads a live SQLite WAL snapshot safely, without invoking MCP or opening a second writer.
interface Params { command:string; positional:string[]; opts:Record<string,string|boolean> }
function parse(argv:string[]):Params {
  const positional:string[]=[]; const opts:Record<string,string|boolean>={};
  const valued=new Set(['runtime-dir','data-root','project-id','limit','max-bytes']);
  const flags=new Set(['include-candidates','include-inactive','full','help']);
  for(let i=0;i<argv.length;i++){
    const part=argv[i];
    if(!part.startsWith('--')){positional.push(part);continue;}
    const eq=part.indexOf('=');const key=part.slice(2,eq<0?undefined:eq);
    if(flags.has(key)&&eq<0){opts[key]=true;continue;}
    if(!valued.has(key))throw new Error('UNKNOWN_OPTION: '+key);
    const value=eq<0?argv[++i]:part.slice(eq+1);
    if(!value||value.startsWith('--'))throw new Error('MISSING_OPTION: '+key);
    opts[key]=value;
  }
  return { command: positional.shift()??'status', positional, opts };
}
function checkedString(value:unknown,max=4096):string {
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>max)throw new Error('INVALID_ARGUMENT');
  return value;
}
function main():void {
  const {command,positional,opts}=parse(process.argv.slice(2));
  if(opts.help){
    process.stdout.write('palace [--data-root DIR|--runtime-dir DIR] status|search QUERY|read ID|skills [--project-id ID] [--limit N] [--max-bytes N] [--include-candidates] [--full]\n');
    return;
  }
  const runtime=path.resolve(String(opts['runtime-dir']??process.env.MCP_DEVICE_CONFIG_DIR??path.join(os.homedir(),'.mcp-device','server')));
  const dataRoot=path.resolve(String(opts['data-root']??process.env.PALACE_DATA_ROOT??path.join(runtime,'plugins','palace','data')));
  const filename=path.join(dataRoot,'palace.sqlite');
  if(!existsSync(filename))throw new Error('PALACE_NOT_INSTALLED: '+filename);
  const db=new DatabaseSync(filename,{readOnly:true});
  try {
    const schema=String((db.prepare('select value from meta where key=?').get('schema') as {value?:string}|undefined)?.value??'');
    if(schema!=='1')throw new Error('PALACE_SCHEMA_UNSUPPORTED');
    const limit=boundedInt(opts.limit===undefined?undefined:Number(opts.limit),10,1,50);
    const maxBytes=boundedInt(opts['max-bytes']===undefined?undefined:Number(opts['max-bytes']),16384,512,65536);
    const projectId=opts['project-id']===undefined?undefined:checkedString(opts['project-id'],512);
    const includeInactive=opts['include-inactive']===true;
    const includeCandidates=opts['include-candidates']===true;
    const full=opts.full===true;
    let response:Record<string,unknown>;
    if(command==='status'){
      const counts=(db.prepare('select kind,status,count(*) as count from cards group by kind,status').all() as Record<string,unknown>[]);
      const totals=(db.prepare('select (select count(*) from cards) cards,(select count(*) from evidence) evidence,(select count(*) from versions) versions').get() as Record<string,unknown>);
      response={ok:true,plugin:'palace',mode:'read-only',dataRoot,totals,counts};
    }else if(command==='search'||command==='skills'){
      const query=command==='search'?checkedString(positional.join(' ')):'';
      if(command==='search'&&!query.trim())throw new Error('QUERY_REQUIRED');
      const terms=queryTerms(query);
      if(terms.length>24)throw new Error('QUERY_TOO_LARGE');
      let sql='select c.json from cards c', where=' where 1=1';
      const args:(string|number)[]=[];
      if(terms.length){
        sql+=' join card_fts on card_fts.id=c.id';
        where+=' and card_fts match ?';
        args.push(terms.map(t=>'"'+t.replace(/"/g,'""')+'"').join(' OR '));
      }
      if(!includeInactive)where+=" and c.status not in ('stale','superseded','withdrawn')";
      if(projectId){where+=" and (c.project_id=? or c.visibility='account')";args.push(projectId);}
      else where+=" and c.visibility!='project'";
      if(command==='skills'){
        where+=" and c.kind='procedure'";
        if(!includeCandidates)where+=" and c.status='validated'";
      }
      sql+=where+' order by c.id limit ?';args.push(Math.max(limit,300));
      const cards=(db.prepare(sql).all(...args) as {json:string}[]).map(row=>JSON.parse(row.json) as KnowledgeCard);
      const selected=terms.length?rankCandidates(cards,query,limit):cards.slice(0,limit);
      const result=selected.map(x=>full?x:preview(x));
      response={ok:true,plugin:'palace',mode:'read-only',query:command==='search'?query:undefined,items:result,
        returned:result.length,candidates:cards.length, note:'Snapshot results; evidence bytes not reverified by read-only CLI'};
    }else if(command==='read'){
      const id=checkedString(positional[0],512);
      if(!id||positional.length!==1)throw new Error('CARD_ID_REQUIRED');
      const row=db.prepare('select json,kind from cards where id=?').get(id) as {json:string;kind:string}|undefined;
      if(!row)throw new Error('KNOWLEDGE_NOT_FOUND');
      const card=JSON.parse(row.json) as KnowledgeCard;
      if(card.scope.visibility==='project' && (!projectId||projectId!==card.scope.projectId))throw new Error('SCOPE_REQUIRED');
      if(!includeInactive&&['stale','superseded','withdrawn'].includes(card.status))throw new Error('KNOWLEDGE_NOT_CURRENT');
      response={ok:true,plugin:'palace',mode:'read-only',kind:row.kind,card,
        evidenceVerifiedNow:false,note:'Source integrity must be verified separately before treating this card as an established fact.'};
    }else throw new Error('UNKNOWN_COMMAND');
    const bytes=Buffer.from(JSON.stringify(response));
    if(bytes.length>maxBytes)throw new Error('BUDGET_TOO_SMALL: '+bytes.length+' > '+maxBytes);
    process.stdout.write(JSON.stringify(response,null,2)+'\n');
  } finally {db.close();}
}
try{main()}catch(error){
  const message=String((error as Error).message??error);
  process.stderr.write(JSON.stringify({ok:false,error:message,code:message.split(':')[0]})+'\n');
  process.exitCode=1;
}
