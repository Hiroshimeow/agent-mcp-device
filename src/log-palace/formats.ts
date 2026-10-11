/** Adapters for existing, user-accessible log files. No capture/observer dependency. */
export type Format = 'auto' | 'pi' | 'codex' | 'mcp' | 'text';
export type ResolvedFormat = Exclude<Format, 'auto'>;
export type Context = { session: string | null; turn: string | null; cwd: string | null };
export interface Item {
  part: number; kind: string; timestamp: string | null; session: string | null;
  turn: string | null; callId: string | null; tool: string | null;
  filePath: string | null; outcome: string | null; searchText: string; preview: string;
}
const obj=(x:unknown):Record<string,unknown>|null=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null;
const str=(x:unknown):string|null=>typeof x==='string'&&x.length?x:null;
function render(x:unknown):string {if(typeof x==='string')return x;try{return JSON.stringify(x)??''}catch{return ''}}
function textParts(x:unknown):string {
  if(typeof x==='string')return x;
  if(!Array.isArray(x))return render(x);
  return x.map(v=>{const p=obj(v);return p?(str(p.text)??str(p.input_text)??''):render(v)}).filter(Boolean).join('\n');
}
function sourceFile(a:unknown):string|null {
  const x=typeof a==='string'?(()=>{try{return obj(JSON.parse(a))}catch{return null}})():obj(a);
  return x?(str(x.path)??str(x.file_path)??str(x.filePath)??str(x.filename)):null;
}
export function detect(line:string):ResolvedFormat {
  let x:Record<string,unknown>|null;try{x=obj(JSON.parse(line))}catch{return 'text'}
  if(!x)return 'text';
  if((x.type==='session'&&str(x.id)&&'cwd'in x)||(x.type==='message'&&obj(x.message)?.role))return 'pi';
  if(['session_meta','response_item','turn_context','event_msg'].includes(String(x.type)))return 'codex';
  if(str(x.toolName)&&('arguments'in x||'output'in x))return 'mcp';
  return 'text';
}
export function parse(format:ResolvedFormat,line:string,before:Context):{items:Item[],context:Context} {
  let x:Record<string,unknown>|null=null;try{x=obj(JSON.parse(line))}catch{}
  let session=before.session,turn=before.turn,cwd=before.cwd;
  const items:Item[]=[];
  const add=(part:number,kind:string,body:string,o:Partial<Item>={})=>{
    if(!body.trim())return;
    const searchText=body;
    items.push({part,kind,searchText,preview:body.slice(0,4096).replace(/\s+/g,' ').trim().slice(0,135),
      timestamp:o.timestamp??str(x?.timestamp),session:o.session??session,turn:o.turn??turn,
      callId:o.callId??null,tool:o.tool??null,filePath:o.filePath??null,outcome:o.outcome??null});
  };
  if(format==='pi'&&x){
    if(x.type==='session'){session=str(x.id)??session;cwd=str(x.cwd)??cwd;add(-1,'session','Pi session '+(session??'')+' '+(cwd??''))}
    else if(x.type==='message'){
      const m=obj(x.message),role=str(m?.role)??'message',parts=Array.isArray(m?.content)?m.content:[];
      if(role==='assistant'){
        for(let i=0;i<parts.length;i++){
          const p=obj(parts[i]);if(p?.type==='toolCall'){
            const tool=str(p.name),args=p.arguments;
            add(i,'tool_call',(tool??'')+' '+render(args),{tool,callId:str(p.id),filePath:sourceFile(args)});
          }else if(p?.type==='text'&&str(p.text))add(i,'assistant',str(p.text)!);
        }
      }else if(role==='toolResult'){
        const tool=str(m?.toolName);
        add(-1,'tool_result',(tool??'')+' '+textParts(m?.content),{tool,callId:str(m?.toolCallId),outcome:m?.isError?'error':'result'});
      }else add(-1,role,textParts(m?.content)||render(m?.content));
    }else if(x.type==='session_info')add(-1,'session_info',str(x.name)??'');
  }else if(format==='codex'&&x){
    const p=obj(x.payload),type=str(p?.type);
    if(x.type==='session_meta'){session=str(p?.id)??session;cwd=str(p?.cwd)??cwd;add(-1,'session','Codex session '+(session??'')+' '+(cwd??''))}
    else if(x.type==='turn_context'){turn=str(p?.turn_id)??turn;cwd=str(p?.cwd)??cwd;}
    else if(x.type==='event_msg'&&type==='task_started')turn=str(p?.turn_id)??turn;
    else if(x.type==='response_item'&&(type==='function_call'||type==='custom_tool_call')){
      const tool=str(p?.name),args=p?.arguments??p?.input;
      add(-1,'tool_call',(tool??'')+' '+render(args),{tool,callId:str(p?.call_id),filePath:sourceFile(args)});
    }else if(x.type==='response_item'&&(type==='function_call_output'||type==='custom_tool_call_output')){
      add(-1,'tool_result',render(p?.output),{callId:str(p?.call_id),outcome:'result'});
    }else if(x.type==='response_item'&&type==='message')add(-1,str(p?.role)??'message',textParts(p?.content));
    else if(x.type==='event_msg'&&(type==='user_message'||type==='agent_message'))add(-1,type,str(p?.message)??'');
    if(x.type==='event_msg'&&type==='task_complete')turn=null;
  }else if(format==='mcp'&&x){
    const tool=str(x.toolName)??str(x.tool),args=x.arguments??x.args;
    add(-1,'tool_call_result',(tool??'')+' '+render(args)+' '+render(x.output??x.result??x.error),{
      tool,filePath:sourceFile(args),callId:str(x.call_id),outcome:x.error?'error':'result',
      session:str(x.session_id)??session});
  }else add(-1,'text',line);
  return {items,context:{session,turn,cwd}};
}
