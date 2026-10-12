import { LogPalace } from './store.js';
import type { Format } from './formats.js';
export interface CliResult {exitCode:number;stdout:string;stderr:string}
const usage=[
  'mcp-device logs discover                         # register existing Pi, Codex, MCP log paths',
  'mcp-device logs add <file-or-dir> [--format auto|pi|codex|mcp|text]',
  'mcp-device logs sources                          # show registered inputs and index size',
  'mcp-device logs index [--max-files N] [--max-bytes N]',
  'mcp-device logs search --query "words" [--limit N]',
  'mcp-device logs read --ref <ref> [--max-bytes N] [--from-byte N]',
  'mcp-device logs graph --ref <ref> [--limit N]',
].join('\n');
function integer(value:string|undefined,def:number):number {
  if(value===undefined)return def;
  if(!/^\d+$/.test(value))throw new Error('BUDGET_EXCEEDED');
  const n=Number(value);if(!Number.isSafeInteger(n))throw new Error('BUDGET_EXCEEDED');
  return n;
}
/** No network, model call, live capture, consent gate or implicit log discovery. */
export function runLogPalaceCli(argv:string[],stateDir?:string):CliResult {
  if(!argv.length||['help','--help','-h'].includes(argv[0]))return {exitCode:0,stdout:usage+'\n',stderr:''};
  let db:LogPalace|undefined;
  try{
    const [command,...args]=argv;
    const opts=new Map<string,string>();
    const positionals:string[]=[];
    for(let i=0;i<args.length;i++){
      const arg=args[i];
      if(arg==='--json')continue;
      if(arg.startsWith('--')){
        if(!['--format','--max-files','--max-bytes','--query','--ref','--limit','--from-byte'].includes(arg)||opts.has(arg))throw new Error('ACTION_UNSUPPORTED');
        if(i+1>=args.length)throw new Error('ACTION_UNSUPPORTED');
        opts.set(arg,args[++i]);
      }else positionals.push(arg);
    }
    const allowed:Record<string,string[]>={
      discover:[],add:['--format'],sources:[],index:['--max-files','--max-bytes'],
      search:['--query','--limit'],read:['--ref','--max-bytes','--from-byte'],graph:['--ref','--limit'],
    };
    if(!(command in allowed)||[...opts.keys()].some(f=>!allowed[command].includes(f)))throw new Error('ACTION_UNSUPPORTED');
    db=new LogPalace(stateDir);
    let result:unknown;
    if(command==='discover'||command==='sources'||command==='index'){
      if(positionals.length)throw new Error('ACTION_UNSUPPORTED');
      if(command==='discover')result=db.discover();
      else if(command==='sources')result=db.sources();
      else result=db.index({maxFiles:integer(opts.get('--max-files'),200),maxBytes:integer(opts.get('--max-bytes'),32*1024*1024)});
    }else if(command==='add'){
      if(positionals.length!==1)throw new Error('ACTION_UNSUPPORTED');
      result=db.add(positionals[0],(opts.get('--format')??'auto') as Format);
    }else if(command==='search'){
      const query=opts.get('--query')??positionals[0];
      if(positionals.length>1||!query)throw new Error('QUERY_REQUIRED');
      result=db.search(query,integer(opts.get('--limit'),5));
    }else{
      const ref=opts.get('--ref')??positionals[0];
      if(positionals.length>1||!ref)throw new Error('INVALID_REF');
      result=command==='read'?db.read(ref,integer(opts.get('--max-bytes'),8192),opts.has('--from-byte')?integer(opts.get('--from-byte'),0):undefined):db.graph(ref,integer(opts.get('--limit'),12));
    }
    return {exitCode:0,stdout:JSON.stringify({ok:true,result})+'\n',stderr:''};
  }catch(error){
    const raw=error instanceof Error?error.message:'INTERNAL_ERROR';
    const code=/^[A-Z_]+$/.test(raw)?raw:'SOURCE_UNAVAILABLE';
    return {exitCode:1,stdout:'',stderr:JSON.stringify({ok:false,error:code})+'\n'};
  }finally{db?.close()}
}
