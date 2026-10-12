import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { TextDecoder } from 'node:util';
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
const MAX_PER_FILE=64*1024*1024;
const MAX_RECORD_BYTES=128*1024*1024;
const FTS_TOKEN_CHUNK=7000;
const safeSliceEnd=(text:string,start:number,wanted:number):number=>{
  let end=Math.min(text.length,start+wanted);
  if(end<text.length&&end>start){
    const code=text.charCodeAt(end-1);
    if(code>=0xD800&&code<=0xDBFF)end--;
  }
  return Math.max(start+1,end);
};
const splitFtsToken=(token:string):string[]=>{
  const parts:string[]=[];for(let i=0;i<token.length;){const end=safeSliceEnd(token,i,FTS_TOKEN_CHUNK);parts.push(token.slice(i,end));i=end}
  return parts;
};
const ftsSafe=(input:string):string=>input.replace(/[\p{L}\p{N}_]{7001,}/gu,token=>splitFtsToken(token).join(' '));
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
    this.db.exec("PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY,path TEXT NOT NULL UNIQUE,format TEXT NOT NULL,dir INTEGER NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS source_scan (source_id INTEGER PRIMARY KEY,queue TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0,epoch INTEGER NOT NULL DEFAULT 0," +
      "FOREIGN KEY(source_id) REFERENCES sources(id));" +
      "CREATE TABLE IF NOT EXISTS palace_state (key TEXT PRIMARY KEY,value TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY,source_id INTEGER NOT NULL,path TEXT NOT NULL UNIQUE,format TEXT NOT NULL," +
      "position INTEGER NOT NULL DEFAULT 0,session TEXT,turn TEXT,cwd TEXT,dev TEXT,ino TEXT,head_hash TEXT,tail_hash TEXT,missing INTEGER NOT NULL DEFAULT 0," +
      "FOREIGN KEY(source_id) REFERENCES sources(id));" +
      "CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY,ref TEXT NOT NULL UNIQUE,file_id INTEGER NOT NULL,position INTEGER NOT NULL," +
      "bytes INTEGER NOT NULL,part INTEGER NOT NULL,hash TEXT NOT NULL,kind TEXT NOT NULL,session TEXT,turn TEXT,call_id TEXT,tool TEXT," +
      "file_path TEXT,file_key TEXT,outcome TEXT,timestamp TEXT,preview TEXT NOT NULL,FOREIGN KEY(file_id) REFERENCES files(id)," +
      "UNIQUE(file_id,position,part));" +
      "CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(body,content='',contentless_delete=1);" +
      "CREATE TABLE IF NOT EXISTS record_fts_chunk_map (id INTEGER PRIMARY KEY,record_id INTEGER NOT NULL,FOREIGN KEY(record_id) REFERENCES records(id));" +
      "CREATE INDEX IF NOT EXISTS record_fts_chunk_record_idx ON record_fts_chunk_map(record_id);" +
      "CREATE VIRTUAL TABLE IF NOT EXISTS records_fts_chunks USING fts5(body,content='',contentless_delete=1);" +
      "CREATE INDEX IF NOT EXISTS records_file_idx ON records(file_id,position);" +
      "CREATE INDEX IF NOT EXISTS records_call_idx ON records(call_id,session);" +
      "CREATE INDEX IF NOT EXISTS records_session_idx ON records(session);" +
      "CREATE INDEX IF NOT EXISTS records_path_idx ON records(file_key);"
    );
    const fileColumns=this.db.prepare("PRAGMA table_info(files)").all() as Row[];
    if(!fileColumns.some(column=>value(column.name)==='seen_epoch'))this.db.exec('ALTER TABLE files ADD COLUMN seen_epoch INTEGER NOT NULL DEFAULT 0');
    if(!fileColumns.some(column=>value(column.name)==='scan_position'))this.db.exec('ALTER TABLE files ADD COLUMN scan_position INTEGER NOT NULL DEFAULT 0');
    if(!fileColumns.some(column=>value(column.name)==='mtime_ms'))this.db.exec('ALTER TABLE files ADD COLUMN mtime_ms REAL');
    if(!fileColumns.some(column=>value(column.name)==='ctime_ms'))this.db.exec('ALTER TABLE files ADD COLUMN ctime_ms REAL');
    if(!fileColumns.some(column=>value(column.name)==='content_hash'))this.db.exec('ALTER TABLE files ADD COLUMN content_hash TEXT');
  }
  close():void {this.db.close()}
  private atomic<T>(label:string,fn:()=>T):T {
    const savepoint='lp_'+label.replace(/[^a-z0-9_]/gi,'_');
    if(this.db.isTransaction){
      this.db.exec('SAVEPOINT '+savepoint);
      try{const result=fn();this.db.exec('RELEASE '+savepoint);return result}
      catch(error){this.db.exec('ROLLBACK TO '+savepoint);this.db.exec('RELEASE '+savepoint);throw error}
    }
    this.db.exec('BEGIN IMMEDIATE');
    try{const result=fn();this.db.exec('COMMIT');return result}
    catch(error){this.db.exec('ROLLBACK');throw error}
  }
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
  private scanPage(source:Row,maxEntries:number,maxFiles:number):{paths:string[],complete:boolean,epoch:number} {
    const sourceId=Number(source.id),root=value(source.path);
    if(!Number(source.dir))return {paths:[root],complete:true,epoch:1};
    type Cursor={path:string;depth:number;kind:'dir'|'file'};
    type QueueState={head:number;items:Cursor[]};
    const row=this.db.prepare('SELECT queue,complete,epoch FROM source_scan WHERE source_id=?').get(sourceId) as Row|undefined;
    let state:QueueState={head:0,items:[]};
    let epoch=Number(row?.epoch??0);
    if(row&&!Number(row.complete)){
      try{
        const parsed=JSON.parse(value(row.queue)) as QueueState|Cursor[];
        state=Array.isArray(parsed)?{head:0,items:parsed}:parsed;
      }catch{state={head:0,items:[]}}
    }
    if(state.head>=state.items.length){state={head:0,items:[{path:root,depth:0,kind:'dir'}]};epoch++}
    const out:string[]=[];
    let remaining=maxEntries;
    while(state.head<state.items.length&&remaining>0&&out.length<maxFiles){
      const cursor=state.items[state.head++]!;
      remaining--;
      if(cursor.kind==='file'){out.push(cursor.path);continue}
      let entries;
      try{entries=readdirSync(cursor.path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))}
      catch{continue}
      for(const e of entries){
        if(e.isSymbolicLink())continue;
        const p=join(cursor.path,e.name);
        if(e.isDirectory()&&cursor.depth<10)state.items.push({path:p,depth:cursor.depth+1,kind:'dir'});
        else if(e.isFile()&&extensionAllowed(p))state.items.push({path:p,depth:cursor.depth,kind:'file'});
      }
    }
    const complete=state.head>=state.items.length;
    if(!complete&&state.head>=1024){state.items=state.items.slice(state.head);state.head=0}
    this.db.prepare(
      'INSERT INTO source_scan(source_id,queue,complete,epoch) VALUES(?,?,?,?) '+
      'ON CONFLICT(source_id) DO UPDATE SET queue=excluded.queue,complete=excluded.complete,epoch=excluded.epoch'
    ).run(sourceId,JSON.stringify(state),complete?1:0,epoch);
    return {paths:out,complete,epoch};
  }
  private fingerprint(fd:number,start:number,count:number):string {
    const size=Math.min(4096,Math.max(0,count));
    if(!size)return digest('');
    const buf=Buffer.alloc(size);
    const read=readSync(fd,buf,0,size,start);
    return digest(buf.subarray(0,read));
  }
  private contentHash(fd:number,count:number):string {
    const hash=createHash('sha256'),buf=Buffer.alloc(1024*1024);
    let at=0;
    while(at<count){const wanted=Math.min(buf.length,count-at),n=readSync(fd,buf,0,wanted,at);if(n<1)throw new Error('SOURCE_CHANGED');hash.update(buf.subarray(0,n));at+=n}
    return hash.digest('hex');
  }
  private indexSearchText(recordId:number,text:string) {
    if(Buffer.byteLength(text,'utf8')<=1024*1024){
      this.db.prepare('INSERT INTO records_fts(rowid,body) VALUES(?,?)').run(recordId,ftsSafe(text));
      return;
    }
    const map=this.db.prepare('INSERT INTO record_fts_chunk_map(record_id) VALUES(?)');
    const fts=this.db.prepare('INSERT INTO records_fts_chunks(rowid,body) VALUES(?,?)');
    const window=64*1024,stride=56*1024; // 8 KiB overlap > maximum normalized FTS token segment.
    let output='',carry='';
    const emit=(body:string)=>{const mapped=map.run(recordId),rowId=Number(mapped.lastInsertRowid);fts.run(rowId,body)};
    const append=(piece:string)=>{
      output+=piece;
      while(output.length>=window){emit(output.slice(0,window));output=output.slice(stride)}
    };
    for(let start=0;start<text.length;){
      const end=safeSliceEnd(text,start,64*1024),combined=carry+text.slice(start,end);
      const tail=combined.match(/[\p{L}\p{N}_]+$/u)?.[0]??'';
      const stable=combined.slice(0,combined.length-tail.length);
      if(stable)append(ftsSafe(stable));
      carry=tail;
      while(carry.length>FTS_TOKEN_CHUNK*2){
        const cut=safeSliceEnd(carry,0,FTS_TOKEN_CHUNK);
        append(carry.slice(0,cut)+' ');
        carry=carry.slice(cut);
      }
      start=end;
    }
    if(carry)append(ftsSafe(carry));
    if(output)emit(output);
  }
  private reset(id:number) {
    const rows=this.db.prepare('SELECT id FROM records WHERE file_id=?').all(id) as Row[];
    const remove=this.db.prepare('DELETE FROM records_fts WHERE rowid=?');
    const chunkRows=this.db.prepare('SELECT id FROM record_fts_chunk_map WHERE record_id=?');
    const removeChunk=this.db.prepare('DELETE FROM records_fts_chunks WHERE rowid=?');
    const removeChunkMap=this.db.prepare('DELETE FROM record_fts_chunk_map WHERE record_id=?');
    for(const row of rows){
      remove.run(row.id as number);
      for(const chunk of chunkRows.all(row.id as number) as Row[])removeChunk.run(chunk.id as number);
      removeChunkMap.run(row.id as number);
    }
    this.db.prepare('DELETE FROM records WHERE file_id=?').run(id);
    this.db.prepare('UPDATE files SET position=0,scan_position=0,session=NULL,turn=NULL,cwd=NULL,head_hash=NULL,tail_hash=NULL,mtime_ms=NULL,ctime_ms=NULL,content_hash=NULL WHERE id=?').run(id);
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
  private indexFile(source:Row,p:string,allocation:number,seenEpoch=0) {
    const preliminary=statSync(p);
    if(!preliminary.isFile())return {lines:0,records:0,bytes:0,reset:false,stalled:false,partial:false};
    const sourceId=Number(source.id),existing=this.db.prepare('SELECT * FROM files WHERE path=?').get(p) as Row|undefined;
    let fmt=existing?value(existing.format) as ResolvedFormat:this.formatFor(p,value(source.format) as Format);
    if(!existing)this.db.prepare('INSERT INTO files(source_id,path,format,seen_epoch) VALUES(?,?,?,?)').run(sourceId,p,fmt,seenEpoch);
    else this.db.prepare('UPDATE files SET source_id=?,seen_epoch=?,missing=0 WHERE id=?').run(sourceId,seenEpoch,existing.id as number);
    let file=this.db.prepare('SELECT * FROM files WHERE path=?').get(p) as Row;
    const fd=openSync(p,'r');
    try{
      const stats=fstatSync(fd);
      let offset=Number(file.position),scan=Math.max(Number(file.scan_position??0),offset),reset=false;
      const identity=String(stats.dev)+'|'+String(stats.ino);
      const oldIdentity=value(file.dev)+'|'+value(file.ino);
      const verifiedAt=Math.max(offset,scan);
      const sameSizeMetadataChanged=stats.size===verifiedAt&&file.mtime_ms!==null&&
        (Number(file.mtime_ms)!==stats.mtimeMs||Number(file.ctime_ms)!==stats.ctimeMs);
      const sameSizeContentChanged=stats.size===verifiedAt&&file.content_hash!==null&&
        value(file.content_hash)!==this.contentHash(fd,verifiedAt);
      if((file.dev!==null&&oldIdentity!==identity)||stats.size<verifiedAt||sameSizeMetadataChanged||sameSizeContentChanged||
          (verifiedAt>0&&(file.head_hash!==this.fingerprint(fd,0,verifiedAt)||
            file.tail_hash!==this.fingerprint(fd,Math.max(0,verifiedAt-4096),Math.min(4096,verifiedAt))))) {
        this.atomic('reset_file',()=>this.reset(Number(file.id)));
        offset=0;scan=0;reset=true;file=this.db.prepare('SELECT * FROM files WHERE id=?').get(file.id as number) as Row;
        if(source.format==='auto'){
          fmt=this.formatFor(p,'auto');
          this.db.prepare('UPDATE files SET format=? WHERE id=?').run(fmt,file.id as number);
        }
      }
      if(stats.size===offset){
        this.db.prepare('UPDATE files SET scan_position=?,dev=?,ino=?,mtime_ms=?,ctime_ms=?,content_hash=?,missing=0 WHERE id=?')
          .run(offset,String(stats.dev),String(stats.ino),stats.mtimeMs,stats.ctimeMs,this.contentHash(fd,offset),file.id as number);
        return {lines:0,records:0,bytes:0,reset,stalled:false,partial:false};
      }
      const toRead=Math.min(stats.size-scan,allocation,MAX_PER_FILE);
      if(toRead<1)return {lines:0,records:0,bytes:0,reset,stalled:false,partial:scan>offset};
      const buffer=Buffer.alloc(toRead),n=readSync(fd,buffer,0,toRead,scan);
      const firstEnd=buffer.indexOf(10,0);
      if(firstEnd<0){
        const at=scan+n;
        if(at-offset>MAX_RECORD_BYTES)throw new Error('RECORD_TOO_LARGE');
        this.db.prepare('UPDATE files SET scan_position=?,dev=?,ino=?,head_hash=?,tail_hash=?,mtime_ms=?,ctime_ms=?,missing=0 WHERE id=?')
          .run(at,String(stats.dev),String(stats.ino),this.fingerprint(fd,0,at),
            this.fingerprint(fd,Math.max(0,at-4096),Math.min(4096,at)),stats.mtimeMs,stats.ctimeMs,file.id as number);
        return {lines:0,records:0,bytes:n,reset,stalled:false,partial:true};
      }
      let processed=0,count=0,position=0;
      let context:Context={session:file.session as string|null,turn:file.turn as string|null,cwd:file.cwd as string|null};
      const insert=this.db.prepare('INSERT INTO records(ref,file_id,position,bytes,part,hash,kind,session,turn,call_id,tool,file_path,file_key,outcome,timestamp,preview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      const addLine=(line:Buffer,linePosition:number,lineBytes:number)=>{
        if(line.at(-1)===13)line=line.subarray(0,line.length-1);
        const lineHash=digest(line),text=line.toString('utf8');
        const outcome=parse(fmt,text,context);context=outcome.context;
        for(const item of outcome.items){
          const ref=digest(p+'\0'+linePosition+'\0'+item.part+'\0'+lineHash).slice(0,48);
          const result=insert.run(ref,file.id as number,linePosition,lineBytes,item.part,lineHash,item.kind,item.session,item.turn,
            item.callId,item.tool,item.filePath,fileIdentity(item.filePath,context.cwd),item.outcome,item.timestamp,item.preview);
          this.indexSearchText(Number(result.lastInsertRowid),item.searchText);count++;
        }
        processed++;
      };
      return this.atomic('record_file',()=>{
        let at:number,consumed:number;
        if(scan>offset){
          const absoluteEnd=scan+firstEnd,recordBytes=absoluteEnd-offset+1;
          if(recordBytes>MAX_RECORD_BYTES)throw new Error('RECORD_TOO_LARGE');
          const full=Buffer.alloc(recordBytes-1),read=readSync(fd,full,0,full.length,offset);
          if(read!==full.length)throw new Error('SOURCE_CHANGED');
          addLine(full,offset,recordBytes);
          at=absoluteEnd+1;consumed=firstEnd+1;
        }else{
          const end=buffer.lastIndexOf(10,n-1);
          for(let i=0;i<=end;i++)if(buffer[i]===10){
            addLine(buffer.subarray(position,i),offset+position,i-position+1);position=i+1;
          }
          at=offset+position;consumed=position;
        }
        this.db.prepare('UPDATE files SET position=?,scan_position=?,session=?,turn=?,cwd=?,dev=?,ino=?,head_hash=?,tail_hash=?,mtime_ms=?,ctime_ms=?,content_hash=?,missing=0 WHERE id=?')
          .run(at,at,context.session,context.turn,context.cwd,String(stats.dev),String(stats.ino),
            this.fingerprint(fd,0,at),this.fingerprint(fd,Math.max(0,at-4096),Math.min(4096,at)),stats.mtimeMs,stats.ctimeMs,
            at===stats.size?this.contentHash(fd,at):null,file.id as number);
        return {lines:processed,records:count,bytes:consumed,reset,stalled:false,partial:false};
      });
    }finally{closeSync(fd)}
  }
  index(options:{maxFiles?:number;maxBytes?:number}={}) {
    const maxFiles=safeInt(options.maxFiles??200,1,1000),maxBytes=safeInt(options.maxBytes??32*1024*1024,1024,LIMIT_BYTES);
    const registered=this.db.prepare('SELECT * FROM sources ORDER BY id').all() as Row[];
    const candidates:{source:Row,path:string,mtime:number,size:number,epoch:number}[]=[];
    const saved=new Map((this.db.prepare('SELECT path,position,scan_position FROM files').all() as Row[])
      .map(f=>[value(f.path),Math.max(Number(f.position),Number(f.scan_position??0))]));
    let discoveryIncomplete=maxFiles<registered.length;
    const pages=new Map<number,{source:Row,complete:boolean,epoch:number}>();
    const rrRow=this.db.prepare("SELECT value FROM palace_state WHERE key='source_rr_start'").get() as Row|undefined;
    const rrStart=registered.length?Math.max(0,Number(rrRow?.value??0))%registered.length:0;
    const ordered=registered.length?[...registered.slice(rrStart),...registered.slice(0,rrStart)]:[];
    const base=registered.length?Math.floor(maxFiles/registered.length):0;
    const remainder=registered.length?maxFiles%registered.length:0;
    for(let index=0;index<ordered.length;index++){
      const source=ordered[index],quota=base+(index<remainder?1:0);
      if(quota<1)continue;
      const root=value(source.path);
      if(!existsSync(root)){this.db.prepare('UPDATE files SET missing=1 WHERE source_id=?').run(source.id as number);continue}
      const page=this.scanPage(source,Math.max(256,quota*8),quota);
      discoveryIncomplete ||= !page.complete;
      const items:{source:Row,path:string,mtime:number,size:number,epoch:number}[]=[];
      const markSeen=this.db.prepare('UPDATE files SET seen_epoch=?,missing=0 WHERE path=? AND source_id=?');
      for(const p of page.paths){
        try{
          const s=statSync(p);
          markSeen.run(page.epoch,p,source.id as number);
          items.push({source,path:p,mtime:s.mtimeMs,size:s.size,epoch:page.epoch});
        }catch{}
      }
      items.sort((a,b)=>{
        const ap=a.size>(saved.get(a.path)??-1)?0:1;
        const bp=b.size>(saved.get(b.path)??-1)?0:1;
        return ap-bp || b.mtime-a.mtime || a.path.localeCompare(b.path);
      });
      candidates.push(...items);
      pages.set(Number(source.id),{source,complete:page.complete,epoch:page.epoch});
    }
    if(registered.length){
      const advance=Math.min(maxFiles,registered.length);
      this.db.prepare("INSERT INTO palace_state(key,value) VALUES('source_rr_start',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run(String((rrStart+advance)%registered.length));
    }
    let indexed=0,files=0,bytes=0,reset=0,stalled=0,partial=0,lines=0;
    const failures:string[]=[];
    this.atomic('index_batch',()=>{
      for(const c of candidates.slice(0,maxFiles)){
        if(bytes>=maxBytes)break;
        try{
          const r=this.indexFile(c.source,c.path,maxBytes-bytes,c.epoch);
          files++;bytes+=r.bytes;indexed+=r.records;lines+=r.lines;
          if(r.reset)reset++;if(r.stalled)stalled++;if(r.partial)partial++;
        }catch(err){failures.push(basename(c.path)+': '+(err instanceof Error?err.message:'ERROR'))}
      }
    });
    // Missing-path invalidation is amortized: only a completed discovery epoch may declare unseen files stale.
    for(const page of pages.values())if(page.complete)
      this.db.prepare('UPDATE files SET missing=1 WHERE source_id=? AND seen_epoch<?').run(page.source.id as number,page.epoch);
    return {files,records:indexed,lines,bytes,reset,stalled,partial,errors:failures,
      more_files:discoveryIncomplete || candidates.length>maxFiles || bytes>=maxBytes || candidates.some(c=>{
        const row=this.db.prepare('SELECT position,scan_position FROM files WHERE path=?').get(c.path) as Row|undefined;
        return c.size>Math.max(Number(row?.position??0),Number(row?.scan_position??0));
      }),
      total_records:Number((this.db.prepare('SELECT count(*) n FROM records').get() as Row).n)};
  }
  private record(ref:string):Row {
    if(!/^[a-f0-9]{48}$/.test(ref))throw new Error('INVALID_REF');
    const row=this.db.prepare("SELECT r.*,f.path,f.missing,f.source_id FROM records r JOIN files f ON f.id=r.file_id WHERE r.ref=?").get(ref) as Row|undefined;
    if(!row)throw new Error('REF_NOT_FOUND');
    if(Number(row.missing)||!existsSync(value(row.path)))throw new Error('SOURCE_MISSING');
    return row;
  }
  private validUtf8(fd:number,start:number,total:number):boolean {
    const decoder=new TextDecoder('utf-8',{fatal:true}),block=Buffer.alloc(65536);
    try{
      for(let at=0;at<total;){
        const n=readSync(fd,block,0,Math.min(block.length,total-at),start+at);
        if(n<1)return false;
        decoder.decode(block.subarray(0,n),{stream:true});at+=n;
      }
      decoder.decode();return true;
    }catch{return false}
  }
  private selectedPartSpan(fd:number,row:Row,total:number):{start:number;end:number}|null {
    const part=Number(row.record_part??-1);
    if(part<0)return {start:0,end:total};
    const body=Buffer.alloc(total);
    if(readSync(fd,body,0,total,Number(row.record_position))!==total)return null;
    let parsed:unknown;
    try{parsed=JSON.parse(body.toString('utf8'))}catch{return null}
    const selected=(parsed as {message?:{content?:unknown[]}})?.message?.content?.[part];
    if(selected===undefined)return null;
    const needle=Buffer.from(JSON.stringify(selected),'utf8'),start=body.indexOf(needle);
    if(start<0||body.indexOf(needle,start+1)>=0)return null;
    return {start,end:start+needle.length};
  }
  /** Locate FTS terms in original UTF-8 source bytes, never in synthetic search text. */
  private sourceHit(row:Row,terms:string[]):{hit_offset:number|null;hit_term:string|null;anchor_status:string} {
    const usable=terms.filter(term=>term.length>0).map(term=>({
      term,matcher:new RegExp(term.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&'),'iu'),
      bytes:Buffer.byteLength(term,'utf8'),
    }));
    if(!usable.length)return {hit_offset:null,hit_term:null,anchor_status:'unmapped'};
    let fd:number;
    try{fd=openSync(value(row.path),'r')}
    catch{return {hit_offset:null,hit_term:null,anchor_status:'source_unavailable'}}
    try{
      const total=Math.max(0,Number(row.record_bytes)-1),recordStart=Number(row.record_position);
      const span=this.selectedPartSpan(fd,row,total);
      if(!span)return {hit_offset:null,hit_term:null,anchor_status:'unmapped'};
      const spanLength=span.end-span.start,start=recordStart+span.start;
      const overlap=Math.min(65540,Math.max(...usable.map(term=>Math.min(term.bytes,65536)))+4);
      const block=Buffer.alloc(65536);
      let carry=Buffer.alloc(0),at=0;
      while(at<spanLength){
        const n=readSync(fd,block,0,Math.min(block.length,spanLength-at),start+at);
        if(n<1)return {hit_offset:null,hit_term:null,anchor_status:'source_unavailable'};
        const data=carry.length?Buffer.concat([carry,block.subarray(0,n)]):block.subarray(0,n);
        const base=at-carry.length;
        // A scan boundary can bisect UTF-8; align before mapping character indexes to bytes.
        let aligned=0;
        while(aligned<data.length&&(data[aligned]&0xC0)===0x80)aligned++;
        const text=data.subarray(aligned).toString('utf8');
        let first:{offset:number;term:string}|undefined;
        for(const entry of usable){
          const match=entry.matcher.exec(text);
          if(!match)continue;
          const offset=span.start+base+aligned+Buffer.byteLength(text.slice(0,match.index),'utf8');
          if(!first||offset<first.offset)first={offset,term:entry.term};
        }
        if(first)return {hit_offset:first.offset,hit_term:first.term,anchor_status:'raw_match'};
        const kept=Math.min(overlap,data.length);
        carry=Buffer.from(data.subarray(data.length-kept));
        at+=n;
      }
      return {hit_offset:null,hit_term:null,anchor_status:'unmapped'};
    }catch{return {hit_offset:null,hit_term:null,anchor_status:'source_unavailable'}}
    finally{closeSync(fd)}
  }
  search(query:string,limit=5) {
    const tokens=query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu)??[];
    if(!tokens.length)throw new Error('QUERY_REQUIRED');
    safeInt(limit,1,20);
    const safeTokens=tokens.flatMap(token=>token.length>FTS_TOKEN_CHUNK?splitFtsToken(token):[token]);
    if(safeTokens.length>24)throw new Error('BUDGET_EXCEEDED');
    const quoted=safeTokens.map(t=>'"'+t.replace(/"/g,'""')+'"'),match=quoted.join(' AND ');
    const chunkIntersection=quoted.map(()=>
      "SELECT DISTINCT m.record_id FROM records_fts_chunks JOIN record_fts_chunk_map m ON m.id=records_fts_chunks.rowid "+
      "WHERE records_fts_chunks MATCH ?").join(" INTERSECT ");
    const sql="WITH chunk_hits(record_id) AS ("+chunkIntersection+"), hits(record_id,rank) AS ("+
      "SELECT rowid,bm25(records_fts) FROM records_fts WHERE records_fts MATCH ? UNION ALL "+
      "SELECT record_id,0.0 FROM chunk_hits) "+
      "SELECT r.ref,r.kind,r.tool,r.session,r.turn,r.file_path,r.timestamp,r.preview,f.path,"+
      "r.position AS record_position,r.bytes AS record_bytes,r.part AS record_part,min(h.rank) rank "+
      "FROM hits h JOIN records r ON r.id=h.record_id JOIN files f ON f.id=r.file_id WHERE f.missing=0 "+
      "GROUP BY r.id ORDER BY rank,r.id DESC LIMIT ?";
    const rows=this.db.prepare(sql).all(...quoted,match,limit) as Row[];
    return {query,items:rows.map(row=>{
      const {rank,record_position,record_bytes,record_part,...item}=row;
      return {...item,...this.sourceHit(row,tokens),hit_unit:'source_record_byte'};
    }),count:rows.length};
  }
  read(ref:string,maxBytes=8192,fromByte?:number) {
    safeInt(maxBytes,128,65536);
    const row=this.record(ref),fd=openSync(value(row.path),'r');
    try{
      const len=Number(row.bytes);
      if(len>MAX_RECORD_BYTES)throw new Error('LINE_TOO_LARGE');
      const physical=Math.max(0,len-1),hash=createHash('sha256');
      const block=Buffer.alloc(65536),base=Number(row.position);
      const stats=fstatSync(fd);
      if(base+len>stats.size)throw new Error('SOURCE_CHANGED');
      let suffix=Buffer.alloc(0);
      const requested=fromByte??0;
      if(!Number.isSafeInteger(requested)||requested<0||requested>physical)throw new Error('INVALID_OFFSET');
      const prefix=Buffer.alloc(Math.min(maxBytes+4,Math.max(0,physical-requested)));
      let copied=0;
      for(let at=0;at<physical;){
        const n=readSync(fd,block,0,Math.min(block.length,physical-at),base+at);
        if(n<1)throw new Error('SOURCE_CHANGED');
        const part=block.subarray(0,n);
        const begin=Math.max(0,requested-at),end=Math.min(n,requested+prefix.length-at);
        if(begin<end){part.copy(prefix,copied,begin,end);copied+=end-begin}
        // Hash excludes trailing CR, but always includes all other original bytes.
        const combined=suffix.length?Buffer.concat([suffix,part]):part;
        if(combined.length>1){hash.update(combined.subarray(0,combined.length-1));suffix=Buffer.from(combined.subarray(combined.length-1))}
        else suffix=combined;
        at+=n;
      }
      if(suffix.length&&suffix[0]!==13)hash.update(suffix);
      if(hash.digest('hex')!==row.hash)throw new Error('SOURCE_CHANGED');
      if(!this.validUtf8(fd,base,physical))throw new Error('SOURCE_ENCODING_UNSUPPORTED');
      const terminal=Buffer.alloc(1);
      if(readSync(fd,terminal,0,1,base+physical)!==1||terminal[0]!==10)throw new Error('SOURCE_CHANGED');
      const endByte=physical-(suffix.length&&suffix[0]===13?1:0);
      if(requested>endByte)throw new Error('INVALID_OFFSET');
      const take=Math.min(copied,maxBytes,endByte-requested);
      let first=0;
      if(take>0&&(prefix[0]&0xC0)===0x80)throw new Error('INVALID_OFFSET');
      let end=take;
      while(end>0&&(prefix[end]&0xC0)===0x80)end--;
      const raw=prefix.subarray(first,end);
      let text=raw.toString('utf8'),view=fromByte===undefined&&Number(row.part)>=0?'selected_part':'raw_source';
      let total=endByte;
      if(view==='selected_part'){
        // Keep the old selected Pi content-part semantics for unanchored reads.
        const whole=Buffer.alloc(physical);
        if(readSync(fd,whole,0,physical,base)!==physical)throw new Error('SOURCE_CHANGED');
        try{const parsed=JSON.parse(whole.toString('utf8'));const selected=parsed?.message?.content?.[Number(row.part)];
          if(selected!==undefined){text=JSON.stringify(selected);total=Buffer.byteLength(text,'utf8')}
        }catch{}
        const encoded=Buffer.from(text);
        let cut=Math.min(maxBytes,encoded.length);
        while(cut>0&&(encoded[cut]&0xC0)===0x80)cut--;
        text=encoded.subarray(0,cut).toString('utf8');
        return {ref,source:row.path,kind:row.kind,tool:row.tool,session:row.session,turn:row.turn,call_id:row.call_id,
          offset:row.position,bytes:row.bytes,text,view,range_start:0,range_end:cut,next_offset:null,resumable:false,truncated:cut<total};
      }
      return {ref,source:row.path,kind:row.kind,tool:row.tool,session:row.session,turn:row.turn,call_id:row.call_id,
        offset:row.position,bytes:row.bytes,text,view,range_start:requested,range_end:requested+end,
        next_offset:requested+end<endByte?requested+end:null,truncated:requested>0||requested+end<endByte};
    }finally{closeSync(fd)}
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
        base+(scoped?' AND r.call_id=? AND r.session=? AND r.file_id=? LIMIT ?':' AND r.call_id=? AND r.file_id=? LIMIT ?'),
        scoped?[ref,value(focus.call_id),value(focus.session),Number(focus.file_id),limit]:[ref,value(focus.call_id),Number(focus.file_id),limit]);
    }
    if(focus.file_key)push('same_file','explicit argument path resolved against logged cwd',base+" AND r.file_key=? LIMIT ?",
      [ref,value(focus.file_key),limit]);
    if(focus.turn&&focus.session)push('same_turn','explicit session and turn within registered source lineage',
      base+" AND r.session=? AND r.turn=? AND f.source_id=? LIMIT ?",
      [ref,value(focus.session),value(focus.turn),Number(focus.source_id),limit]);
    if(focus.session)push('same_session','explicit session identity within registered source lineage',
      base+" AND r.session=? AND f.source_id=? LIMIT ?",
      [ref,value(focus.session),Number(focus.source_id),limit]);
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
