import {spawnSync} from 'node:child_process';

// Windows MF-6 requires active Defender during the fresh-process measurement.
export function observeDefender(platform=process.platform,run=spawnSync){
 if(platform!=='win32')return {available:false,reason:'not Windows'};
 const observed=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-MpComputerStatus -ErrorAction Stop;$p=Get-MpPreference -ErrorAction Stop;[PSCustomObject]@{AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;AMProductVersion=$s.AMProductVersion;AntivirusSignatureVersion=$s.AntivirusSignatureVersion;DisableRealtimeMonitoring=$p.DisableRealtimeMonitoring;ExclusionPath=$p.ExclusionPath;ExclusionProcess=$p.ExclusionProcess}|ConvertTo-Json -Compress"],{encoding:'utf8',timeout:15000,windowsHide:true});
 let defender;
 try{defender={available:observed.status===0,settings:JSON.parse(observed.stdout)};}
 catch{defender={available:false,exit:observed.status,error:observed.stderr};}
 if(!defender.available||defender.settings?.AntivirusEnabled!==true||defender.settings?.RealTimeProtectionEnabled!==true||defender.settings?.DisableRealtimeMonitoring!==false)
  throw Object.assign(new Error('Windows CLI probe requires observable active Defender and real-time protection; no samples collected.'),{code:'DEFENDER_REQUIRED',defender});
 return defender;
}
