#!/usr/bin/env node
'use strict';
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
  const serviceProfile=process.platform==='win32'&&/^(?:SYSTEM|LOCAL SERVICE|NETWORK SERVICE)$/i.test(String(process.env.USERNAME??''));
  if(serviceProfile&&process.env.MCP_DEVICE_INSTALL_SKILLS_FORCE!=='1')return {ok:true,skill:'palace-cli',skipped:'service-profile',remediation:'Run palace skill install as the intended interactive agent user, or set MCP_DEVICE_INSTALL_SKILLS_FORCE=1 with an explicit MCP_DEVICE_SKILL_HOME.'};
  const packageRoot=path.resolve(__dirname,path.basename(__dirname).toLowerCase()==='v12'?'../..':'..');
  const manager=path.join(packageRoot,'dist','plugins','palace','skill-manager.js');
  const mod=await import(pathToFileURL(manager).href);
  return await mod.reconcilePalaceSkill({packageRoot});
}
main().then(value=>process.stdout.write(JSON.stringify(value)+'\n')).catch(error=>{
  // Skill setup is recoverable through `palace skill repair`; core package installation remains usable.
  const message=String(error?.message??error),code=String(error?.code??message.split(':')[0]??'PALACE_SKILL_SETUP_FAILED');
  process.stderr.write('[palace-skill] '+JSON.stringify({ok:false,code,error:message,remediation:'Run palace skill repair after correcting the filesystem or policy error.'})+'\n');
});
