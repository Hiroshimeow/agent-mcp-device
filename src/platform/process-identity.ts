import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);
let ownBirth:Promise<string|null>|undefined;
let ownNamespace:Promise<ProcessNamespace|null>|undefined;

export interface ProcessNamespace { platform:string;hostname:string;bootId?:string;pidNamespace?:string }

export async function processNamespace():Promise<ProcessNamespace|null>{
  ownNamespace??=(async()=>{
    try{
      const common={platform:process.platform,hostname:os.hostname()};
      if(process.platform==='linux'){
        const [boot,pidNamespace]=await Promise.all([
          fs.readFile('/proc/sys/kernel/random/boot_id','utf8'),
          fs.readlink('/proc/self/ns/pid')
        ]);
        if(!/^[a-f0-9-]{36}$/i.test(boot.trim())||!/^pid:\[\d+\]$/.test(pidNamespace))return null;
        return {...common,bootId:boot.trim(),pidNamespace};
      }
      return common;
    }catch{return null;}
  })();
  return ownNamespace;
}

export async function sameProcessNamespace(recorded:ProcessNamespace|undefined):Promise<boolean>{
  const current=await processNamespace();
  return !!current&&!!recorded&&current.platform===recorded.platform&&current.hostname===recorded.hostname
    &&current.bootId===recorded.bootId&&current.pidNamespace===recorded.pidNamespace;
}

export async function processBirth(pid:number):Promise<string|null>{
  if(!Number.isSafeInteger(pid)||pid<1)return null;
  if(pid===process.pid){ownBirth??=observe(pid);return ownBirth;}
  return observe(pid);
}

async function observe(pid:number):Promise<string|null>{
  try{
    if(process.platform==='linux'){
      const [stat,boot]=await Promise.all([
        fs.readFile(`/proc/${pid}/stat`,'utf8'),
        fs.readFile('/proc/sys/kernel/random/boot_id','utf8')
      ]);
      const end=stat.lastIndexOf(')'),fields=stat.slice(end+2).trim().split(/\s+/),start=fields[19];
      if(end<0||!/^\d+$/.test(start??'')||!/^[a-f0-9-]{36}$/i.test(boot.trim()))return null;
      return 'linux:'+boot.trim()+':'+start;
    }
    if(process.platform==='win32'){
      const powershell=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
      const command=`[Console]::Write((Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToFileTimeUtc().ToString([Globalization.CultureInfo]::InvariantCulture))`;
      const {stdout}=await exec(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{
        encoding:'utf8',windowsHide:true,timeout:3000,maxBuffer:4096
      });
      const ticks=stdout.trim();
      return /^\d{10,}$/.test(ticks)?'win32:'+ticks:null;
    }
  }catch{ /* unknown identity never authorizes takeover */ }
  return null;
}
