// Retained, bounded command evidence; refuses to replace a prior receipt.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const [label,cwd,executable,...inputArgs]=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(label||''))throw new Error('Invalid label');
const dir=__dirname,base=path.join(dir,label),out=fs.openSync(base+'.stdout.log','wx'),err=fs.openSync(base+'.stderr.log','wx');
let command=executable,args=inputArgs;
if(executable==='node')command=process.execPath;
if(executable==='npm'){command=process.execPath;args=[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),...inputArgs];}
const startedAt=new Date().toISOString(),started=performance.now();
const child=cp.spawnSync(command,args,{cwd,env:{...process.env},stdio:['ignore',out,err],windowsHide:true,timeout:1800000});
fs.closeSync(out);fs.closeSync(err);
const stdout=fs.readFileSync(base+'.stdout.log','utf8'),stderr=fs.readFileSync(base+'.stderr.log','utf8');
const counts={};for(const key of ['tests','pass','fail','cancelled','skipped']){const m=[...stdout.matchAll(new RegExp('^# '+key+' (\\d+)','gm'))].at(-1);if(m)counts[key]=Number(m[1]);}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const receipt={schemaVersion:1,label,cwd,command,args,startedAt,endedAt:new Date().toISOString(),durationMs:performance.now()-started,node:process.version,platform:process.platform,exitCode:child.status,signal:child.signal,error:child.error?.message,counts,stdout:{path:base+'.stdout.log',sha256:hash(base+'.stdout.log')},stderr:{path:base+'.stderr.log',sha256:hash(base+'.stderr.log')}};
fs.writeFileSync(base+'.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(receipt));console.log(stdout.slice(-6000));if(stderr)console.error(stderr.slice(-4000));process.exitCode=child.status??1;
