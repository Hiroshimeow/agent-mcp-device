import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve, win32, posix } from 'node:path';
import { CONFIG_DIR } from '../config.js';
import { detect, parse, type Context, type Format, type Item, type ResolvedFormat } from './formats.js';

type Row = Record<string, unknown>;
const digest=(value: string | Buffer):string=>createHash('sha256').update(value).digest('hex');
const value=(v:unknown):string=>typeof v==='string'?v:'';
const safeInt=(n:number,min:number,max:number):number=>{
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('BUDGET_EXCEEDED');
  return n;
};
const extensionAllowed=(p:string)=>['.jsonl','.log','.txt','.ndjson'].includes(extname(p).toLowerCase());
const LIMIT_BYTES=64*1024*1024;
const MAX_PER_FILE=8*1024*1024;
/** Only proven absolute paths match across sessions; relative paths need the logged cwd. */
function fileIdentity(raw:string|null,cwd:string|null):string|null {
  if(!raw)return null;
  const isWindowsAbsolute=(p:string)=>/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(p);
  if(isWindowsAbsolute(raw))return 'win:'+win32.normalize(raw).toLowerCase();
  if(posix.isAbsolute(raw))return 'posix:'+posix.normalize(raw);
  if(!cwd)return null;
  if(isWindowsAbsolute(cwd))return 'win:'+win32.resolve(cwd,raw).toLowerCase();
  if(posix.isAbsolute(cwd))return 'posix:'+posix.resolve(cwd,raw);
  return null;
}

export class LogPalace {
  readonly db:DatabaseSync;
  constructor(stateDir=process.env.MCP_DEVICE_LOG_PALACE_DIR || join(CONFIG_DIR,'log-palace')) {
    mkdirSync(stateDir,{recursive:true});
    this.db=new DatabaseSync(join(stateDir,'index.sqlite'));
    this.db.exec("PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY,path TEXT NOT NULL UNIQUE,format TEXT NOT NULL,dir INTEGER NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY,source_id INTEGER NOT NULL,path TEXT NOT NULL UNIQUE,format TEXT NOT NULL," +
      "position INTEGER NOT NULL DEFAULT 0,session TEXT,turn TEXT,cwd TEXT,dev TEXT,ino TEXT,head_hash TEXT,tail_hash TEXT,missing INTEGER NOT NULL DEFAULT 0," +
      "FOREIGN KEY(source_id) REFERENCES sources(id));" +
      "CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY,ref TEXT NOT NULL UNIQUE,file_id INTEGER NOT NULL,position INTEGER NOT NULL," +
      "bytes INTEGER NOT NULL,part INTEGER NOT NULL,hash TEXT NOT NULL,kind TEXT NOT NULL,session TEXT,turn TEXT,call_id TEXT,tool TEXT," +
      "file_path TEXT,file_key TEXT,outcome TEXT,timestamp TEXT,preview TEXT NOT NULL,FOREIGN KEY(file_id) REFERENCES files(id)," +
      "UNIQUE(file_id,position,part));" +
      "CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(body,content='',contentless_delete=1);" +
      "CREATE INDEX IF NOT EXISTS records_file_idx ON records(file_id,position);" +
      "CREATE INDEX IF NOT EXISTS records_call_idx ON records(call_id,session);" +
      "CREATE INDEX IF NOT EXISTS records_session_idx ON records(session);" +
      "CREATE INDEX IF NOT EXISTS records_path_idx ON records(file_key);"
    );
  }
  close():void {this.db.close()}
  add(sourcePath:string,format:Format='auto') {
    if(!['auto','pi','codex','mcp','text'].includes(format))throw new Error('FORMAT_UNSUPPORTED');
    const file=realpathSync(resolve(sourcePath));
    const dir=statSync(file).isDirectory()?1:0;
    if(!dir&&!statSync(file).isFile())throw new Error('SOURCE_UNSUPPORTED');
    this.db.prepare('INSERT INTO sources(path,format,dir) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET format=excluded.format')
      .run(file,format,dir);
    return {path:file,format,kind:dir?'directory':'file'};
  }
  discover() {
    const roots:[string,Format][]=[
      [join(homedir(),'.pi','agent','sessions'),'pi'],
      [join(homedir(),'.codex','sessions'),'codex'],
      [join(CONFIG_DIR,'logs','history.jsonl'),'mcp'],
    ];
    const added=[];
    for(const [p,format] of roots)if(existsSync(p))added.push(this.add(p,format));
    return {added};
  }
  sources() {
    return {sources:this.db.prepare('SELECT path,format,dir FROM sources ORDER BY path').all(),
      indexed_files:Number((this.db.prepare('SELECT count(*) n FROM files').get() as Row).n),
      indexed_records:Number((this.db.prepare('SELECT count(*) n FROM records').get() as Row).n)};
  }
  private walk(root:string,max:number):string[] {
    const queue:[string,number][]=[[root,0]],out:string[]=[];
    while(queue.length&&out.length<max){
      const [dir,depth]=queue.shift()!;
      if(depth>10)continue;
      let names;try{names=readdirSync(dir,{withFileTypes:true})}catch{continue}
      for(const e of names){
        const p=join(dir,e.name);
        if(e.isSymbolicLink())continue;
        if(e.isDirectory()){if(depth<10)queue.push([p,depth+1])}
        else if(e.isFile()&&extensionAllowed(p)){out.push(p);if(out.length>=max)break}
      }
    }
    return out;
  }
  private fingerprint(fd:number,start:number,count:number):string {
    const size=Math.min(4096,Math.max(0,count));
    if(!size)return digest('');
    const buf=Buffer.alloc(size);
    const read=readSync(fd,buf,0,size,start);
    return digest(buf.subarray(0,read));
  }
  private reset(id:number) {
    const rows=this.db.prepare('SELECT id FROM records WHERE file_id=?').all(id) as Row[];
    const remove=this.db.prepare('DELETE FROM records_fts WHERE rowid=?');
    for(const row of rows)remove.run(row.id as number);
    this.db.prepare('DELETE FROM records WHERE file_id=?').run(id);
    this.db.prepare('UPDATE files SET position=0,session=NULL,turn=NULL,cwd=NULL,head_hash=NULL,tail_hash=NULL WHERE id=?').run(id);
  }
  private formatFor(p:string,preferred:Format):ResolvedFormat {
    if(preferred!=='auto')return preferred;
    const fd=openSync(p,'r');
    try {
      const b=Buffer.alloc(32768),n=readSync(fd,b,0,b.length,0);
      const first=b.subarray(0,n).toString('utf8').split(/\r?\n/).find(v=>v.trim())??'';
      return detect(first);
    } finally{closeSync(fd)}
  }
  private indexFile(source:Row,p:string,allocation:number) {
    const stats=statSync(p);
    if(!stats.isFile())return {lines:0,records:0,bytes:0,reset:false,stalled:false};
    const sourceId=Number(source.id),existing=this.db.prepare('SELECT * FROM files WHERE path=?').get(p) as Row|undefined;
    let fmt=existing?value(existing.format) as ResolvedFormat:this.formatFor(p,value(source.format) as Format);
    if(!existing)this.db.prepare('INSERT INTO files(source_id,path,format) VALUES(?,?,?)').run(sourceId,p,fmt);
    let file=this.db.prepare('SELECT * FROM files WHERE path=?').get(p) as Row;
    const fd=openSync(p,'r');
    try{
      let offset=Number(file.position),reset=false;
      const identity=String(stats.dev)+'|'+String(stats.ino);
      const oldIdentity=value(file.dev)+'|'+value(file.ino);
      if((file.dev!==null&&oldIdentity!==identity)||stats.size<offset||
          (offset>0&&(file.head_hash!==this.fingerprint(fd,0,offset)||
            file.tail_hash!==this.fingerprint(fd,Math.max(0,offset-4096),Math.min(4096,offset))))) {
        this.db.exec('BEGIN IMMEDIATE');
        try{this.reset(Number(file.id));this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}
        offset=0;reset=true;file=this.db.prepare('SELECT * FROM files WHERE id=?').get(file.id as number) as Row;
        if(source.format==='auto'){
          fmt=this.formatFor(p,'auto');
          this.db.prepare('UPDATE files SET format=? WHERE id=?').run(fmt,file.id as number);
        }
      }
      if(stats.size===offset){
        this.db.prepare('UPDATE files SET dev=?,ino=?,missing=0 WHERE id=?').run(String(stats.dev),String(stats.ino),file.id as number);
        return {lines:0,records:0,bytes:0,reset,stalled:false};
      }
      const toRead=Math.min(stats.size-offset,allocation,MAX_PER_FILE);
      if(toRead<1)return {lines:0,records:0,bytes:0,reset,stalled:false};
      const buffer=Buffer.alloc(toRead),n=readSync(fd,buffer,0,toRead,offset);
      const end=buffer.lastIndexOf(10,n-1);
      if(end<0)return {lines:0,records:0,bytes:0,reset,stalled:true};
      let processed=0,count=0,position=0;
      let context:Context={session:file.session as string|null,turn:file.turn as string|null,cwd:file.cwd as string|null};
      const insert=this.db.prepare('INSERT INTO records(ref,file_id,position,bytes,part,hash,kind,session,turn,call_id,tool,file_path,file_key,outcome,timestamp,preview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      const fts=this.db.prepare('INSERT INTO records_fts(rowid,body) VALUES(?,?)');
      this.db.exec('BEGIN IMMEDIATE');
      try{
        for(let i=0;i<=end;i++){
          if(buffer[i]!==10)continue;
          let line=buffer.subarray(position,i);
          if(line.at(-1)===13)line=line.subarray(0,line.length-1);
          const lineHash=digest(line);
          const text=line.toString('utf8');
          // A too-long record stays accessible in its source; only its leading section is searchable.
          const outcome=parse(fmt,text.slice(0,2*1024*1024),context);
          context=outcome.context;
          for(const item of outcome.items){
            const ref=digest(p+'\0'+(offset+position)+'\0'+item.part+'\0'+lineHash).slice(0,48);
            const result=insert.run(ref,file.id as number,offset+position,i-position+1,item.part,lineHash,item.kind,item.session,item.turn,
              item.callId,item.tool,item.filePath,fileIdentity(item.filePath,context.cwd),item.outcome,item.timestamp,item.preview);
            fts.run(Number(result.lastInsertRowid),item.searchText);
            count++;
          }
          processed++;
          position=i+1;
        }
        const at=offset+position;
        this.db.prepare('UPDATE files SET position=?,session=?,turn=?,cwd=?,dev=?,ino=?,head_hash=?,tail_hash=?,missing=0 WHERE id=?')
          .run(at,context.session,context.turn,context.cwd,String(stats.dev),String(stats.ino),
            this.fingerprint(fd,0,at),this.fingerprint(fd,Math.max(0,at-4096),Math.min(4096,at)),file.id as number);
        this.db.exec('COMMIT');
        return {lines:processed,records:count,bytes:position,reset,stalled:false};
      }catch(error){this.db.exec('ROLLBACK');throw error}
    }finally{closeSync(fd)}
  }
  index(options:{maxFiles?:number;maxBytes?:number}={}) {
    const maxFiles=safeInt(options.maxFiles??200,1,1000),maxBytes=safeInt(options.maxBytes??32*1024*1024,1024,LIMIT_BYTES);
    const registered=this.db.prepare('SELECT * FROM sources ORDER BY id').all() as Row[];
    const candidates:{source:Row,path:string,mtime:number,size:number}[]=[];
    const saved=new Map((this.db.prepare('SELECT path,position FROM files').all() as Row[]).map(f=>[value(f.path),Number(f.position)]));
    const seen=new Set<string>();
    for(const source of registered){
      const root=value(source.path);
      if(!existsSync(root))continue;
      const paths=Number(source.dir)?this.walk(root,Math.max(10000,maxFiles*10)):[root];
      for(const p of paths){if(seen.has(p))continue;seen.add(p);try{const s=statSync(p);candidates.push({source,path:p,mtime:s.mtimeMs,size:s.size})}catch{}}
    }
    // Prioritize new/growing files over already-indexed files, so repeated bounded calls make progress.
    candidates.sort((a,b)=>{
      const ap=a.size>(saved.get(a.path)??-1)?0:1;
      const bp=b.size>(saved.get(b.path)??-1)?0:1;
      return ap-bp || b.mtime-a.mtime;
    });
    let indexed=0,files=0,bytes=0,reset=0,stalled=0,lines=0;
    const failures:string[]=[];
    for(const c of candidates.slice(0,maxFiles)){
      if(bytes>=maxBytes)break;
      try{
        const r=this.indexFile(c.source,c.path,maxBytes-bytes);
        files++;bytes+=r.bytes;indexed+=r.records;lines+=r.lines;
        if(r.reset)reset++;if(r.stalled)stalled++;
      }catch(err){failures.push(basename(c.path)+': '+(err instanceof Error?err.message:'ERROR'))}
    }
    // A deleted/renamed source must not be presented as fresh searchable data.
    const known=this.db.prepare('SELECT id,path FROM files').all() as Row[];
    const missing=this.db.prepare('UPDATE files SET missing=1 WHERE id=?');
    for(const f of known)if(!existsSync(value(f.path)))missing.run(f.id as number);
    return {files,records:indexed,lines,bytes,reset,stalled,errors:failures,
      more_files:candidates.length>maxFiles || bytes>=maxBytes || candidates.some(c=>
        c.size>Number((this.db.prepare('SELECT position FROM files WHERE path=?').get(c.path) as Row|undefined)?.position??0)),
      total_records:Number((this.db.prepare('SELECT count(*) n FROM records').get() as Row).n)};
  }
  private record(ref:string):Row {
    if(!/^[a-f0-9]{48}$/.test(ref))throw new Error('INVALID_REF');
    const row=this.db.prepare("SELECT r.*,f.path,f.missing FROM records r JOIN files f ON f.id=r.file_id WHERE r.ref=?").get(ref) as Row|undefined;
    if(!row)throw new Error('REF_NOT_FOUND');
    if(Number(row.missing)||!existsSync(value(row.path)))throw new Error('SOURCE_MISSING');
    return row;
  }
  search(query:string,limit=5) {
    const tokens=query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu)??[];
    if(!tokens.length)throw new Error('QUERY_REQUIRED');
    safeInt(limit,1,20);
    const match=tokens.slice(0,12).map(t=>'"'+t.replace(/"/g,'""')+'"').join(' AND ');
    const rows=this.db.prepare("SELECT r.ref,r.kind,r.tool,r.session,r.turn,r.file_path,r.timestamp,r.preview,f.path,"+
      "round(bm25(records_fts),5) rank FROM records_fts JOIN records r ON r.id=records_fts.rowid "+
      "JOIN files f ON f.id=r.file_id WHERE records_fts MATCH ? AND f.missing=0 ORDER BY rank, r.id DESC LIMIT ?")
      .all(match,limit) as Row[];
    return {query,items:rows.map(row=>({...row,rank:undefined})),count:rows.length};
  }
  read(ref:string,maxBytes=8192) {
    safeInt(maxBytes,128,65536);
    const row=this.record(ref),fd=openSync(value(row.path),'r');
    let body:Buffer;
    try{
      const len=Number(row.bytes);
      if(len>8*1024*1024)throw new Error('LINE_TOO_LARGE');
      body=Buffer.alloc(len);
      const n=readSync(fd,body,0,len,Number(row.position));
      if(n!==len)throw new Error('SOURCE_CHANGED');
      const source=body.subarray(0,body.at(-1)===10?body.length-1:body.length);
      const withoutCr=source.subarray(0,source.at(-1)===13?source.length-1:source.length);
      if(digest(withoutCr)!==row.hash)throw new Error('SOURCE_CHANGED');
    }finally{closeSync(fd)}
    let text=body.toString('utf8').trimEnd();
    if(Number(row.part)>=0){
      try{
        const p=JSON.parse(text);
        const block=p?.message?.content?.[Number(row.part)];
        if(block!==undefined)text=JSON.stringify(block);
      }catch{}
    }
    const content=Buffer.from(text);
    return {ref,source:row.path,kind:row.kind,tool:row.tool,session:row.session,turn:row.turn,call_id:row.call_id,
      offset:row.position,bytes:row.bytes,text:content.subarray(0,maxBytes).toString('utf8'),
      truncated:content.length>maxBytes};
  }
  graph(ref:string,limit=12) {
    safeInt(limit,1,30);
    const focus=this.record(ref),rels:{relation:string,basis:string,row:Row}[]=[];
    const push=(relation:string,basis:string,query:string,args:(number|string)[])=>{
      const rows=this.db.prepare(query).all(...args) as Row[];
      for(const row of rows)if(row.ref!==ref)rels.push({relation,basis,row});
    };
    const base="SELECT r.ref,r.kind,r.tool,r.preview,r.session,r.turn,r.file_path FROM records r JOIN files f ON f.id=r.file_id "+
      "WHERE f.missing=0 AND r.ref<>?";
    if(focus.call_id) {
      // When session identity exists, never fall back to a file-level join across other sessions.
      const scoped=focus.session!==null;
      push('same_tool_call','explicit call_id with session/file scope',
        base+(scoped?' AND r.call_id=? AND r.session=? LIMIT ?':' AND r.call_id=? AND r.file_id=? LIMIT ?'),
        scoped?[ref,value(focus.call_id),value(focus.session),limit]:[ref,value(focus.call_id),Number(focus.file_id),limit]);
    }
    if(focus.file_key)push('same_file','explicit argument path resolved against logged cwd',base+" AND r.file_key=? LIMIT ?",
      [ref,value(focus.file_key),limit]);
    if(focus.turn&&focus.session)push('same_turn','explicit session and turn',base+" AND r.session=? AND r.turn=? LIMIT ?",
      [ref,value(focus.session),value(focus.turn),limit]);
    if(focus.session)push('same_session','explicit session identity',base+" AND r.session=? LIMIT ?",
      [ref,value(focus.session),limit]);
    const seen=new Set<string>(),neighbors=[];
    for(const relation of rels){
      const key=value(relation.row.ref);
      if(seen.has(key))continue;
      seen.add(key);neighbors.push({ref:key,relation:relation.relation,basis:relation.basis,kind:relation.row.kind,
        tool:relation.row.tool,preview:relation.row.preview});
      if(neighbors.length>=limit)break;
    }
    return {ref,kind:focus.kind,session:focus.session,call_id:focus.call_id,neighbors,count:neighbors.length,
      note:'Associations are grounded in recorded IDs/paths; no causality is inferred.'};
  }
}
