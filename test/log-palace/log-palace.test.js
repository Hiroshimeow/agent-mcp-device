import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,appendFileSync,renameSync,unlinkSync,rmSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LogPalace} from '../../dist/log-palace/store.js';
import {runLogPalaceCli} from '../../dist/log-palace/cli.js';
const j=x=>JSON.stringify(x)+'\n';
function setup(t){
  const root=mkdtempSync(join(tmpdir(),'mcp-palace-'));
  const db=new LogPalace(join(root,'db'));
  t.after(()=>{db.close();rmSync(root,{recursive:true,force:true})});
  return {root,db};
}
const pi=(sid,id,term,filename='src/file.ts')=>[
  j({type:'session',id:sid,cwd:'E:/repo',timestamp:'2026-10-11T00:00:00Z'}),
  j({type:'message',message:{role:'assistant',content:[{type:'toolCall',id,name:'read_file',
    arguments:{path:filename,note:term}}]},timestamp:'2026-10-11T00:00:01Z'}),
  j({type:'message',message:{role:'toolResult',toolName:'read_file',toolCallId:id,
    content:[{type:'text',text:'RESULT_'+term}]},timestamp:'2026-10-11T00:00:02Z'})
].join('');
test('Pi logs: search locator, exact selected read, graph joins by actual call ID',t=>{
  const {root,db}=setup(t),p=join(root,'pi.jsonl'),raw=pi('pi-s1','call-1','P0_KNOWN_ERROR');
  writeFileSync(p,raw);db.add(p);
  const first=db.index();assert.equal(first.lines,3);assert.equal(first.records,3);
  const hit=db.search('P0_KNOWN_ERROR').items.find(x=>x.kind==='tool_call');
  assert.ok(hit);assert.equal(hit.session,'pi-s1');assert.equal(hit.file_path,'src/file.ts');
  assert.equal(JSON.parse(db.read(hit.ref).text).id,'call-1');
  const edge=db.graph(hit.ref).neighbors.find(x=>x.relation==='same_tool_call'&&x.kind==='tool_result');
  assert.ok(edge);assert.match(db.read(edge.ref).text,/RESULT_P0_KNOWN_ERROR/);
  assert.equal(db.index().records,0);assert.equal(readFileSync(p,'utf8'),raw);
});
test('Codex logs preserve session and turn; reused call ID across sessions not joined',t=>{
  const {root,db}=setup(t),a=join(root,'a.jsonl'),b=join(root,'b.jsonl');
  const lines=(session,term)=>[
    j({type:'session_meta',payload:{id:session,cwd:session==='codex-a'?'E:/repo-alpha':'E:/repo-beta'}}),
    j({type:'event_msg',payload:{type:'task_started',turn_id:'turn-1'}}),
    j({type:'response_item',payload:{type:'function_call',name:'shell_command',call_id:'same-call',
      arguments:JSON.stringify({path:'README.md',note:term})}}),
    j({type:'response_item',payload:{type:'function_call_output',call_id:'same-call',output:'DONE_'+term}})
  ].join('');
  writeFileSync(a,lines('codex-a','UNIQUE_ALPHA'));
  writeFileSync(b,lines('codex-b','UNIQUE_BETA'));
  db.add(root);assert.equal(db.index().records,6);
  const call=db.search('UNIQUE_ALPHA').items.find(x=>x.kind==='tool_call');
  assert.ok(call);assert.equal(call.session,'codex-a');assert.equal(call.turn,'turn-1');
  const edges=db.graph(call.ref).neighbors.filter(x=>x.relation==='same_tool_call');
  assert.equal(edges.length,1);assert.match(db.read(edges[0].ref).text,/DONE_UNIQUE_ALPHA/);
  assert.equal(db.graph(call.ref).neighbors.some(x=>String(x.preview).includes('UNIQUE_BETA')),false);
});
test('Existing MCP history and arbitrary logs are indexed without invented session graph',t=>{
  const {root,db}=setup(t),a=join(root,'history.jsonl'),b=join(root,'free.log');
  writeFileSync(a,j({timestamp:'now',toolName:'edit_file',arguments:{path:'src/fix.js'},
    output:'PATCH_SUCCESS_ABC',duration:42}));
  writeFileSync(b,'FREEFORM_LOG_MARKER\n');db.add(a);db.add(b,'text');
  assert.equal(db.index().records,2);
  const record=db.search('PATCH_SUCCESS_ABC').items[0];
  assert.equal(record.tool,'edit_file');assert.equal(record.file_path,'src/fix.js');
  assert.equal(record.session,null);assert.equal(db.graph(record.ref).count,0);
  assert.match(db.read(db.search('FREEFORM_LOG_MARKER').items[0].ref).text,/FREEFORM/);
});
test('Incremental append, partial line and late result do not require rebuild',t=>{
  const {root,db}=setup(t),p=join(root,'pending.jsonl'),lines=pi('s','c','REPAIR_MARK').split('\n').filter(Boolean);
  writeFileSync(p,lines[0]+'\n'+lines[1]+'\n'+lines[2].slice(0,31));
  db.add(p);assert.equal(db.index().records,2);assert.equal(db.search('RESULT_REPAIR_MARK').count,0);
  appendFileSync(p,lines[2].slice(31)+'\n');
  assert.equal(db.index().records,1);
  const call=db.search('REPAIR_MARK').items.find(x=>x.kind==='tool_call');
  const result=db.search('RESULT_REPAIR_MARK').items[0];
  assert.ok(call);assert.ok(result);
  assert.ok(db.graph(call.ref).neighbors.some(x=>x.ref===result.ref));
  assert.equal(db.index().records,0);
});
test('Rotation, truncate/rewrite and removed input invalidate old lookup/ref',t=>{
  const {root,db}=setup(t),p=join(root,'current.log');
  writeFileSync(p,'PRE_ROTATION_SENTINEL\n');db.add(p,'text');db.index();
  const old=db.search('PRE_ROTATION_SENTINEL').items[0].ref;
  renameSync(p,join(root,'old.log'));writeFileSync(p,'NEW_ROTATION_SENTINEL\n');
  assert.equal(db.index().reset,1);
  assert.equal(db.search('PRE_ROTATION_SENTINEL').count,0);
  assert.equal(db.search('NEW_ROTATION_SENTINEL').count,1);
  assert.throws(()=>db.read(old),/REF_NOT_FOUND/);
  writeFileSync(p,'LATER_REWRITE_SENTINEL\n');db.index();
  assert.equal(db.search('NEW_ROTATION_SENTINEL').count,0);
  assert.equal(db.search('LATER_REWRITE_SENTINEL').count,1);
  unlinkSync(p);db.index();assert.equal(db.search('LATER_REWRITE_SENTINEL').count,0);
});
test('CLI bounded results, no implicit source scanning or new consent gate',t=>{
  const {root}=setup(t),state=join(root,'cli-db'),p=join(root,'fixture.log');
  writeFileSync(p,'CLI_SEARCH_SENTINEL_500\n');
  const invoke=(...args)=>runLogPalaceCli(args,state);
  assert.equal(JSON.parse(invoke('sources').stdout).result.indexed_records,0);
  assert.equal(invoke('add',p).exitCode,0);
  assert.equal(invoke('index').exitCode,0);
  const search=JSON.parse(invoke('search','--query','CLI_SEARCH_SENTINEL_500').stdout).result;
  assert.equal(search.count,1);assert.equal(search.items[0].ref.length,48);
  assert.ok(Buffer.byteLength(invoke('search','--query','CLI_SEARCH_SENTINEL_500').stdout)<800);
  assert.match(invoke('read','--ref',search.items[0].ref).stdout,/CLI_SEARCH_SENTINEL_500/);
  assert.equal(invoke('graph','--ref','invalid').exitCode,1);
  assert.equal(invoke('index','--max-bytes','-1').exitCode,1);
});

test('Bounded repeated indexing covers additional files rather than starving on already-indexed ones',t=>{
  const {root,db}=setup(t),logs=join(root,'many');
  mkdirSync(logs);
  for(let i=0;i<33;i++)writeFileSync(join(logs,'record-'+i+'.log'),'SCOPED_LOG_'+i+'\n');
  db.add(logs,'text');
  let steps=0;
  while(steps++<8){const res=db.index({maxFiles:5,maxBytes:4096});if(!res.more_files)break;}
  assert.equal(db.sources().indexed_records,33);
  assert.equal(db.search('SCOPED_LOG_32').count,1);
});
test('Reused call ID in the same file but different Pi sessions stays unlinked',t=>{
  const {root,db}=setup(t),p=join(root,'multi-session.jsonl');
  writeFileSync(p,pi('session-first','shared-id','FIRST_RPT','a.ts')+
    pi('session-second','shared-id','SECOND_RPT','b.ts'));
  db.add(p);db.index();
  const old=db.search('FIRST_RPT').items.find(x=>x.kind==='tool_call');
  assert.ok(old);
  const links=db.graph(old.ref).neighbors;
  assert.equal(links.some(x=>String(x.preview).includes('SECOND_RPT')),false);
});
test('Auto file format is redetected after source replacement and Linux/Windows cwd are kept distinct',t=>{
  const {root,db}=setup(t),p=join(root,'mixed.jsonl');
  writeFileSync(p,pi('session-legacy','old-call','OLD_FORMAT_MARK'));
  db.add(p);db.index();
  renameSync(p,join(root,'old-backup.txt'));
  writeFileSync(p,[
    j({type:'session_meta',payload:{id:'codex-new',cwd:'/home/developer/project'}}),
    j({type:'response_item',payload:{type:'function_call',name:'shell_command',
      call_id:'new-call',arguments:'{"path":"src/main.ts","command":"cat src/main.ts","note":"NEW_FORMAT_MARK"}'}}),
    j({type:'response_item',payload:{type:'function_call_output',call_id:'new-call',output:'NEW_FORMAT_OUT'}})
  ].join(''));
  db.index();
  assert.equal(db.search('OLD_FORMAT_MARK').count,0);
  const hit=db.search('NEW_FORMAT_MARK').items.find(x=>x.kind==='tool_call');
  assert.equal(hit.session,'codex-new');
  assert.ok(db.graph(hit.ref).neighbors.some(x=>x.kind==='tool_result'));
});

test('Read fails on changed source bytes even before the next index; no stale body leak',t=>{
  const {root,db}=setup(t),p=join(root,'mutate.log');
  writeFileSync(p,'SAME_SIZE_CONTENT_ONE\n');db.add(p,'text');db.index();
  const ref=db.search('SAME_SIZE_CONTENT_ONE').items[0].ref;
  writeFileSync(p,'SAME_SIZE_CONTENT_TWO\n');
  assert.throws(()=>db.read(ref),/SOURCE_CHANGED/);
});
test('Incomplete giant record advances a durable partial cursor without inventing a result',t=>{
  const {root,db}=setup(t),p=join(root,'partial.jsonl');
  writeFileSync(p,'{"type":"message","message":{"role":"user","content":"'+ 'x'.repeat(15000));
  db.add(p,'pi');let state=db.index({maxFiles:1,maxBytes:8192});
  state=db.index({maxFiles:1,maxBytes:8192});
  assert.equal(state.stalled,0);assert.equal(state.partial,1);assert.equal(state.more_files,false);assert.equal(state.total_records,0);
  appendFileSync(p,'"}}\n');state=db.index({maxFiles:1,maxBytes:8192});
  assert.equal(state.records,1);assert.equal(db.search('missing').count,0);
});

test('P1: giant complete JSONL line indexes unique marker beyond eight MiB and supports verified read',t=>{
  const {root,db}=setup(t),p=join(root,'giant.jsonl');
  const marker='GIANT_RECORD_LAST_7A19B';
  writeFileSync(p,j({type:'message',message:{role:'assistant',content:[{type:'text',text:'x '.repeat(5*1024*1024)+marker}]}}));
  db.add(p,'pi');
  for(let attempt=0;attempt<8;attempt++){
    const step=db.index({maxBytes:16*1024*1024});
    if(db.search(marker).count)break;
    assert.equal(step.stalled,0,'a complete oversized line must make bounded progress');
  }
  const items=db.search(marker).items;
  assert.equal(items.length,1,'late content must be searchable');
  assert.equal(db.read(items[0].ref,8192).truncated,true,'bounded read should indicate omitted tail');
});

test('P1: source scan reaches a cold file beyond 10000 entries with bounded calls',t=>{
  const {root,db}=setup(t),dir=join(root,'bulk');mkdirSync(dir);
  for(let i=0;i<10020;i++)writeFileSync(join(dir,'f'+String(i).padStart(5,'0')+'.log'),'BULK_ENTRY_'+i+'\n');
  db.add(dir,'text');
  let completed=false;
  for(let i=0;i<120;i++){
    const result=db.index({maxFiles:200,maxBytes:1024*1024});
    if(db.search('BULK_ENTRY_10019').count){completed=true;break;}
    assert.equal(result.more_files,true,'scan must disclose incomplete discovery');
  }
  assert.equal(completed,true,'the scan must eventually reach entries beyond the legacy 10000-file cap');
});

test('P1: reused session and call IDs from independent source files cannot create a false call edge',t=>{
 const {root,db}=setup(t),a=join(root,'independent-a.jsonl'),b=join(root,'independent-b.jsonl');
 writeFileSync(a,pi('same-session','same-call','SOURCE_A_ONLY'));
 writeFileSync(b,pi('same-session','same-call','SOURCE_B_ONLY'));
 db.add(a,'pi');db.add(b,'pi');db.index();
 const hit=db.search('SOURCE_A_ONLY').items.find(x=>x.kind==='tool_call');
 assert.ok(hit);
 const connected=db.graph(hit.ref).neighbors.filter(x=>x.relation==='same_tool_call');
 assert.ok(connected.some(x=>String(x.preview).includes('RESULT_SOURCE_A_ONLY')));
 assert.equal(connected.some(x=>String(x.preview).includes('SOURCE_B_ONLY')),false);
});

test('P1: FTS preserves a logical token longer than SQLite token limit',t=>{
  const {root,db}=setup(t),p=join(root,'long-token.log');
  const token='a'.repeat(40000)+'TAIL9Z';
  writeFileSync(p,token+'\n');db.add(p,'text');db.index({maxBytes:128*1024});
  assert.equal(db.search(token).count,1);
});

test('P1: discovery cursor survives database restart',t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-palace-restart-')),logs=join(root,'logs'),state=join(root,'db');mkdirSync(logs);
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(let i=0;i<600;i++)writeFileSync(join(logs,'r'+String(i).padStart(4,'0')+'.log'),'RESTART_SCAN_'+i+'\n');
  let db=new LogPalace(state);db.add(logs,'text');db.index({maxFiles:25,maxBytes:1024*1024});db.close();
  db=new LogPalace(state);
  let found=false;for(let i=0;i<30;i++){db.index({maxFiles:25,maxBytes:1024*1024});if(db.search('RESTART_SCAN_599').count){found=true;break;}}
  db.close();assert.equal(found,true);
});

test('P1: bounded indexing is fair across multiple registered roots',t=>{
  const {root,db}=setup(t),hot=join(root,'hot'),cold=join(root,'cold');mkdirSync(hot);mkdirSync(cold);
  for(let i=0;i<100;i++)writeFileSync(join(hot,'h'+i+'.log'),'HOT_'+i+'\n');
  writeFileSync(join(cold,'cold.log'),'COLD_FAIR_SENTINEL\n');
  db.add(hot,'text');db.add(cold,'text');
  db.index({maxFiles:2,maxBytes:4096});
  assert.equal(db.search('COLD_FAIR_SENTINEL').count,1);
});

test('P1: completed discovery epoch invalidates a deleted directory member without scanning every known file each call',t=>{
  const {root,db}=setup(t),dir=join(root,'stale-dir');mkdirSync(dir);
  const a=join(dir,'a.log'),b=join(dir,'b.log');writeFileSync(a,'STALE_DIR_A\n');writeFileSync(b,'STALE_DIR_B\n');
  db.add(dir,'text');let guard=0;while(db.index({maxFiles:1,maxBytes:4096}).more_files&&guard++<10){}
  const ref=db.search('STALE_DIR_B').items[0].ref;unlinkSync(b);
  guard=0;while(db.index({maxFiles:1,maxBytes:4096}).more_files&&guard++<10){}
  assert.equal(db.search('STALE_DIR_B').count,0);assert.throws(()=>db.read(ref),/SOURCE_MISSING/);
});

test('P1: overlapping registered roots do not duplicate a physical log locator',t=>{
  const {root,db}=setup(t),parent=join(root,'parent'),child=join(parent,'child');mkdirSync(parent);mkdirSync(child);
  const p=join(child,'one.log');writeFileSync(p,'OVERLAP_ONE_SENTINEL\n');
  db.add(parent,'text');db.add(child,'text');
  for(let i=0;i<6;i++)db.index({maxFiles:2,maxBytes:4096});
  const hits=db.search('OVERLAP_ONE_SENTINEL',20).items;
  assert.equal(hits.length,1);assert.equal(new Set(hits.map(x=>x.ref)).size,1);
});

test('P1: JSONL record larger than 64 MiB resumes across calls and keeps late search coverage',t=>{
  const {root,db}=setup(t),p=join(root,'over64.jsonl'),marker='OVER_64MIB_LATE_MARKER_71ZX';
  const text='x '.repeat(34*1024*1024)+marker;
  writeFileSync(p,j({type:'message',message:{role:'assistant',content:[{type:'text',text}]}}));
  db.add(p,'pi');let found=false,sawPartial=false;
  for(let i=0;i<8;i++){
    const step=db.index({maxFiles:1,maxBytes:16*1024*1024});sawPartial ||= step.partial>0;
    if(db.search(marker).count){found=true;break;}
  }
  assert.equal(sawPartial,true);assert.equal(found,true);
  const hit=db.search(marker).items[0];assert.equal(db.read(hit.ref,1024).truncated,true);
});

test('P1: same-size rewrite is fingerprint-detected and stale FTS rows are replaced',t=>{
  const {root,db}=setup(t),p=join(root,'same-size.log');
  writeFileSync(p,'SAME_SIZE_OLD_12345\n');db.add(p,'text');db.index();
  const old=db.search('SAME_SIZE_OLD_12345').items[0].ref;
  writeFileSync(p,'SAME_SIZE_NEW_12345\n');const step=db.index();
  assert.equal(step.reset,1);assert.equal(db.search('SAME_SIZE_OLD_12345').count,0);assert.equal(db.search('SAME_SIZE_NEW_12345').count,1);
  assert.throws(()=>db.read(old),/REF_NOT_FOUND/);
});

test('P1: copytruncate and regrow do not preserve stale records',t=>{
  const {root,db}=setup(t),p=join(root,'copytruncate.log');
  writeFileSync(p,'COPYTRUNCATE_OLD_A\nCOPYTRUNCATE_OLD_B\n');db.add(p,'text');db.index();
  writeFileSync(p,'COPYTRUNCATE_NEW\n');let step=db.index();assert.equal(step.reset,1);
  assert.equal(db.search('COPYTRUNCATE_OLD_A').count,0);assert.equal(db.search('COPYTRUNCATE_NEW').count,1);
  appendFileSync(p,'COPYTRUNCATE_REGROW\n');step=db.index();assert.equal(step.records,1);assert.equal(db.search('COPYTRUNCATE_REGROW').count,1);
});

test('P1: append after partial scan resumes once without duplicate locator',t=>{
  const {root,db}=setup(t),p=join(root,'partial-append.log');
  writeFileSync(p,'PARTIAL_APPEND_SENTINEL');db.add(p,'text');let step=db.index({maxBytes:4096});
  assert.equal(step.partial,1);assert.equal(step.more_files,false);
  appendFileSync(p,'\n');step=db.index({maxBytes:4096});assert.equal(step.records,1);
  assert.equal(db.search('PARTIAL_APPEND_SENTINEL',20).items.length,1);assert.equal(db.index({maxBytes:4096}).records,0);
});

test('P1: chunked FTS matches query terms that live in distant windows of one large record',t=>{
  const {root,db}=setup(t),p=join(root,'chunked.log');
  writeFileSync(p,'DISTANT_ALPHA '+('m '.repeat(700000))+' DISTANT_OMEGA\n');db.add(p,'text');db.index({maxBytes:4*1024*1024});
  const hits=db.search('DISTANT_ALPHA DISTANT_OMEGA',20).items;assert.equal(hits.length,1);
});

test('P1: chunked FTS preserves a greater-than-32768-byte logical token in a large record',t=>{
  const {root,db}=setup(t),p=join(root,'chunk-long-token.log');
  const token='z'.repeat(70000)+'TAIL_CHUNK_TOKEN';
  writeFileSync(p,('pad '.repeat(300000))+token+'\n');db.add(p,'text');db.index({maxBytes:4*1024*1024});
  assert.equal(db.search(token).count,1);
});

test('P1: search never silently drops query terms beyond the safe FTS budget',t=>{
  const {root,db}=setup(t),p=join(root,'query-budget.log');writeFileSync(p,'one two three\n');db.add(p,'text');db.index();
  assert.throws(()=>db.search(Array.from({length:25},(_,i)=>'term'+i).join(' ')),/BUDGET_EXCEEDED/);
});

test('P1 independent: maxFiles=1 rotates fairly across registered roots',t=>{
  const {root,db}=setup(t),hot=join(root,'hot-one'),cold=join(root,'cold-one');mkdirSync(hot);mkdirSync(cold);
  for(let i=0;i<40;i++)writeFileSync(join(hot,'h'+String(i).padStart(2,'0')+'.log'),'HOT_ONE_'+i+'\n');
  writeFileSync(join(cold,'cold.log'),'COLD_ONE_SENTINEL\n');db.add(hot,'text');db.add(cold,'text');
  for(let i=0;i<5&&!db.search('COLD_ONE_SENTINEL').count;i++)db.index({maxFiles:1,maxBytes:1024});
  assert.equal(db.search('COLD_ONE_SENTINEL').count,1);
});

test('P1 independent: same-size interior rewrite invalidates stale FTS',t=>{
  const {root,db}=setup(t),p=join(root,'interior.log');
  const before='HEAD '+('a '.repeat(10000))+'INTERIOR_OLD_MARK '+('b '.repeat(10000))+'TAIL\n';
  const after ='HEAD '+('a '.repeat(10000))+'INTERIOR_NEW_MARK '+('b '.repeat(10000))+'TAIL\n';
  assert.equal(Buffer.byteLength(before),Buffer.byteLength(after));writeFileSync(p,before);db.add(p,'text');db.index();
  assert.equal(db.search('INTERIOR_OLD_MARK').count,1);writeFileSync(p,after);const step=db.index();
  assert.equal(step.reset,1);assert.equal(db.search('INTERIOR_OLD_MARK').count,0);assert.equal(db.search('INTERIOR_NEW_MARK').count,1);
});

test('P1 independent: reused session identity across separately registered logs has no session edge',t=>{
  const {root,db}=setup(t),a=join(root,'repo-a.jsonl'),b=join(root,'repo-b.jsonl');
  const make=(cwd,id,term)=>[
    j({type:'session',id:'SESSION_REUSED',cwd,timestamp:'2026-10-11T00:00:00Z'}),
    j({type:'message',message:{role:'assistant',content:[{type:'toolCall',id,name:'read_file',arguments:{path:'README.md',note:term}}]},timestamp:'2026-10-11T00:00:01Z'}),
    j({type:'message',message:{role:'toolResult',toolName:'read_file',toolCallId:id,content:[{type:'text',text:'RESULT_'+term}]},timestamp:'2026-10-11T00:00:02Z'})
  ].join('');
  writeFileSync(a,make('E:/repo-a','ID_REUSED','SESSION_A_ONLY'));writeFileSync(b,make('E:/repo-b','ID_REUSED','SESSION_B_ONLY'));
  db.add(a,'pi');db.add(b,'pi');db.index();const hit=db.search('SESSION_A_ONLY').items.find(x=>x.kind==='tool_call');assert.ok(hit);
  const edges=db.graph(hit.ref).neighbors.filter(x=>x.relation==='same_session'||x.relation==='same_turn');
  assert.equal(edges.some(x=>String(x.preview).includes('SESSION_B_ONLY')),false);
});

test('P1 review R1: discovery visibility survives byte-budget exhaustion and restart',t=>{
  const root=mkdtempSync(join(tmpdir(),'mcp-palace-r1-')),dir=join(root,'logs'),state=join(root,'db');mkdirSync(dir);
  const a=join(dir,'a.log'),b=join(dir,'b.log');writeFileSync(a,'R1_A_BASE\n');writeFileSync(b,'R1_B_STABLE\n');
  let db=new LogPalace(state);db.add(dir,'text');
  for(let i=0;i<6&&(!db.search('R1_A_BASE').count||!db.search('R1_B_STABLE').count);i++)db.index({maxFiles:2,maxBytes:4096});
  const stable=db.search('R1_B_STABLE').items[0];assert.ok(stable);assert.match(db.read(stable.ref).text,/R1_B_STABLE/);
  appendFileSync(a,'R1_A_GROW '+('x'.repeat(1400))+'\n');
  const step=db.index({maxFiles:2,maxBytes:1024});
  assert.ok(step.bytes>=1024||step.more_files);
  assert.equal(db.search('R1_B_STABLE').count,1,'discovered unchanged file must not be marked missing when byte budget is spent elsewhere');
  assert.match(db.read(stable.ref).text,/R1_B_STABLE/);
  db.close();db=new LogPalace(state);
  assert.equal(db.search('R1_B_STABLE').count,1,'visibility must survive DB restart');
  assert.match(db.read(stable.ref).text,/R1_B_STABLE/);db.close();rmSync(root,{recursive:true,force:true});
});

test('P1 locate-read: a 132023-byte late hit is addressable with one bounded selected read',t=>{
  const {root,db}=setup(t),p=join(root,'late-large.log'),marker='UNIQUE_LATE_HIT_20261012';
  const raw='x '.repeat(60000)+marker+' '+'z'.repeat(132023-120000-marker.length-2)+'\n';
  assert.equal(Buffer.byteLength(raw),132023);
  writeFileSync(p,raw);db.add(p,'text');db.index({maxBytes:256*1024});
  const hit=db.search(marker).items[0];assert.ok(hit);
  assert.ok(hit.hit_offset>=65536,'SEARCH must supply a raw-source-byte offset for a late match');
  assert.equal(hit.anchor_status,'raw_match');
  const read=db.read(hit.ref,65536,hit.hit_offset);
  assert.ok(read.text.includes(marker),'single READ using SEARCH anchor must include the evidence');
  assert.equal(read.view,'raw_source');
  assert.equal(read.range_start,hit.hit_offset);
  assert.ok(Buffer.byteLength(read.text,'utf8')<=65536);
  assert.equal(read.truncated,true,'earlier content was intentionally omitted');
  assert.equal(read.next_offset,null,'the selected late window reaches EOF');
  assert.ok(Buffer.byteLength(JSON.stringify(hit),'utf8')<900,'SEARCH locator remains compact');
  assert.equal(readFileSync(p,'utf8'),raw);
});

test('P1 locate-read: UTF-8 boundary, CRLF, cursor round-trip and invalid range',t=>{
  const {root,db}=setup(t),p=join(root,'utf8.log');
  const raw='a'.repeat(127)+'😀'+'END\r\n';writeFileSync(p,raw);db.add(p,'text');db.index();
  const hit=db.search('END').items[0];assert.ok(hit);
  const ref=hit.ref,head=db.read(ref,128);
  assert.equal(Buffer.byteLength(head.text,'utf8'),127);
  assert.equal(head.text,'a'.repeat(127));
  assert.equal(head.next_offset,127);
  assert.equal(head.range_end,127);
  assert.equal(head.text.includes('�'),false);
  const tail=db.read(ref,128,head.next_offset);
  assert.equal(tail.text,'😀END');
  assert.equal(tail.range_start,127);
  assert.equal(tail.range_end,Buffer.byteLength(raw,'utf8')-2);
  assert.equal(tail.next_offset,null);
  assert.ok(Buffer.byteLength(tail.text,'utf8')<=128);
  assert.equal(head.text+tail.text,'a'.repeat(127)+'😀END');
  assert.equal(hit.hit_offset,Buffer.byteLength('a'.repeat(127)+'😀','utf8'));
  assert.throws(()=>db.read(ref,128,128),/INVALID_OFFSET/);
  assert.throws(()=>db.read(ref,128,-1),/INVALID_OFFSET|BUDGET_EXCEEDED/);
  assert.throws(()=>db.read(ref,128,9000),/INVALID_OFFSET/);
  writeFileSync(p,'b'.repeat(127)+'😀END\r\n');
  assert.throws(()=>db.read(ref,128,hit.hit_offset),/SOURCE_CHANGED/);
});

test('P1 locate-read: anchored Pi part uses verified raw JSON; legacy Pi part remains selected',t=>{
  const {root,db}=setup(t),p=join(root,'pi-late.jsonl'),marker='PI_ANCHORED_LATE_20261012';
  writeFileSync(p,pi('pi-large','id1','x '.repeat(60000)+marker));
  db.add(p,'pi');db.index({maxBytes:1024*1024});
  const hit=db.search(marker).items.find(x=>x.kind==='tool_call');
  assert.ok(hit);assert.ok(hit.hit_offset>65536);
  const source=db.read(hit.ref,8192,hit.hit_offset);
  assert.equal(source.view,'raw_source');assert.match(source.text,/PI_ANCHORED_LATE_20261012/);
  const legacy=db.read(hit.ref,8192);
  assert.equal(legacy.view,'selected_part');assert.match(legacy.text,/^\{"type":"toolCall","id":"id1"/);
  const status=runLogPalaceCli(['read','--ref',hit.ref,'--max-bytes','8192','--from-byte',String(hit.hit_offset)],join(root,'db'));
  assert.equal(status.exitCode,0);
  assert.match(JSON.parse(status.stdout).result.text,/PI_ANCHORED_LATE_20261012/);
  const invalid=runLogPalaceCli(['read','--ref',hit.ref,'--from-byte','-3'],join(root,'db'));
  assert.equal(invalid.exitCode,1);
});

test('P1 review F1: invalid UTF-8 never expands model-visible text beyond maxBytes',t=>{
  const {root,db}=setup(t),p=join(root,'invalid-utf8.log');
  writeFileSync(p,Buffer.concat([Buffer.from('BAD_UTF8_MARK '),Buffer.alloc(512,0xff),Buffer.from(' FIN\n')]));
  db.add(p,'text');db.index();
  const hit=db.search('BAD_UTF8_MARK').items[0];assert.ok(hit);
  assert.throws(()=>db.read(hit.ref,128),/SOURCE_ENCODING_UNSUPPORTED/);
  assert.throws(()=>db.read(hit.ref,128,hit.hit_offset),/SOURCE_ENCODING_UNSUPPORTED/);
});

test('P1 review F2: selected Pi part never exposes a cursor in raw-source coordinates',t=>{
  const {root,db}=setup(t),p=join(root,'pi-selected-cursor.jsonl');
  writeFileSync(p,pi('pi-cursor','cursor-id','PI_CURSOR_TERM_2026 '+('M'.repeat(800))));
  db.add(p,'pi');db.index();
  const hit=db.search('PI_CURSOR_TERM_2026').items.find(x=>x.kind==='tool_call');assert.ok(hit);
  const first=db.read(hit.ref,128);
  assert.equal(first.view,'selected_part');assert.equal(first.truncated,true);
  assert.equal(first.next_offset,null);assert.equal(first.resumable,false);
});

test('P1 review F3: Pi multi-part anchor belongs to the indexed selected part',t=>{
  const {root,db}=setup(t),p=join(root,'pi-multipart-anchor.jsonl'),marker='SECOND_PART_UNIQUE_20261012';
  writeFileSync(p,j({type:'session',id:'multi',cwd:'E:/repo'})+
    j({type:'message',message:{role:'assistant',content:[
      {type:'toolCall',id:'first',name:'read_file',arguments:{note:marker}},
      {type:'toolCall',id:'second',name:'read_file',arguments:{note:'x '.repeat(65000)+marker}}
    ]}}));
  db.add(p,'pi');db.index({maxBytes:512*1024});
  const hits=db.search(marker,10).items.filter(x=>x.kind==='tool_call');assert.equal(hits.length,2);
  const second=hits.find(x=>db.read(x.ref,512).text.includes('"id":"second"'));assert.ok(second);
  assert.equal(second.anchor_status,'raw_match');
  assert.ok(second.hit_offset>100000,'second part must not anchor to the first part marker');
  const selected=db.read(second.ref,8192,second.hit_offset);
  assert.match(selected.text,/SECOND_PART_UNIQUE_20261012/);
});
