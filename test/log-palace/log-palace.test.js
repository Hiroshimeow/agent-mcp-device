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
test('Incomplete giant record reports stalled rather than indexing invented result',t=>{
  const {root,db}=setup(t),p=join(root,'partial.jsonl');
  writeFileSync(p,'{"type":"message","message":{"role":"user","content":"'+ 'x'.repeat(15000));
  db.add(p,'pi');const state=db.index({maxFiles:1,maxBytes:8192});
  assert.equal(state.stalled,1);assert.equal(state.total_records,0);
  assert.equal(db.search('missing').count,0);
});
