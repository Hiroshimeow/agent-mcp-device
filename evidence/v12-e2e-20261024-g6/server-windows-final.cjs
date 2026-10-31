const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root='E:/git-project/agent-mcp-device-v12',work='E:/test/mcp-device-v12-e2e-20261024-g6',evidence=path.join(root,'evidence/v12-e2e-20261024-g6');
if(JSON.parse(fs.readFileSync(path.join(evidence,'linux-final-result.json'),'utf8')).status!=='PASS')throw new Error('Linux validation must finish first');
const env={...process.env,MCP_V12_COLD_PACKAGE_ROOT:path.join(work,'windows/final/cold-device/node_modules/@hcu-lab.me/mcp-device')};
const r=spawnSync(process.execPath,[path.join(evidence,'run-command.cjs'),'server-suite-windows-final',path.join(work,'candidate-three'),'node','scripts/v12/run-platform-tests.mjs','--server'],{env,stdio:'inherit',windowsHide:true});
process.exitCode=r.status??1;
