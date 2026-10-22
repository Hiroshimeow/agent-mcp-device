#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'specs/008-v12-platform/gateway-import-manifest.json'), 'utf8'));
const argv = process.argv.slice(2), baseline = argv.includes('--baseline');
const selection = argv.find(arg => ['projects','behavior','compatibility','security-extra','all'].includes(arg)) || 'all';
const groupFiles = {
  projects: ['project-id','project-inspection','project-public-contract','project-device-routing','resources','prompts','trusted-roots-projects','workspace-registry','path-utils'],
  behavior: ['device-inventory','tool-risk','runtime-profile','device-release','device-usage','usage-events','surface-config','tool-surface-stability','custom-tools-registry','strict-structured-output','response-utils','pure-control-plane-contract','catalog-scale','benchmark-command','skill-source-safety','device-admin','admin-cli'],
  compatibility: ['auth-session','benchmark-mcp-catalog','skill-sources']
};
const securityExtraFiles = ['device-forget','oauth-offline-access','oauth-authorization-server','device-secure-transport','device-broker-auth'];
const files = (selection === 'security-extra' ? securityExtraFiles : selection === 'all' ? Object.values(groupFiles).flat() : groupFiles[selection]).map(name => 'tests/' + name + '.test.mjs');
const repoRoot = baseline ? manifest.sourceRoot : path.join(packageRoot, 'control-plane');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-union-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(MCP_|HCU_)/i.test(key)));
env.MCP_V12_UNION_FIXTURE_ROOT = fixtureRoot;
env.NODE_OPTIONS = '--import=' + JSON.stringify(pathToFileURL(path.join(packageRoot, 'control-plane', 'portfree-union-preload.mjs')).href);
env.GIT_CONFIG_NOSYSTEM = '1'; env.GIT_CONFIG_GLOBAL = path.join(fixtureRoot, 'empty-gitconfig');
fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
env.TMP = env.TEMP = path.join(fixtureRoot, 'temp');
const filteredNames = !baseline && (selection === 'compatibility' || selection === 'all')
  ? ['--test-skip-pattern=static bearer docs describe|package exposes'] : [];
const extraFilter = selection === 'security-extra' ? ['--test-name-pattern=^(?:OAuth advertises offline_access|revoke hard-forgets every|OAuth redirect matching|AccountAuthProvider emits v2|inner TLS config requires|uint32 framing parses|v2 challenge encoding)'] : [];
const args = ['--test','--test-concurrency=1',...filteredNames,...extraFilter,...files];
const minimumTests = { projects:56, behavior:63, compatibility:baseline?16:13, 'security-extra':7, all:baseline?135:132 }[selection];
const started = Date.now();
const result = spawnSync(process.execPath, args, { cwd:repoRoot, env, encoding:'utf8', maxBuffer:16*1024*1024, timeout:180000, windowsHide:true });
const stdout = result.stdout || '', stderr = result.stderr || '';
const number = key => Number([...stdout.matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))].at(-1)?.[1] || 0);
let cleanupError = null;
try { fs.rmSync(fixtureRoot, { recursive:true, force:true }); } catch(error) { cleanupError = error.code || String(error); }
const summary = {
  node:process.version, sourceBaseline:manifest.sourceHead, repository:repoRoot,
  flavor:baseline?'BASELINE':'CANDIDATE', group:selection,
  args, networkPolicy:'No listener, socket connection or global fetch; inherited operational env removed; isolated home/temp/Git config.',
  testFiles:files.map(relative => ({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot,relative))).digest('hex')})),
  tests:number('tests'), pass:number('pass'), fail:number('fail'), skipped:number('skipped'), cancelled:number('cancelled'),
  exitCode:result.status, elapsedMs:Date.now()-started, cleanupError,
  ...(cleanupError?{retainedFixtureRoot:fixtureRoot}:{}),
  minimumTests, status:result.status===0 && number('tests')>=minimumTests && number('pass')>0 && number('cancelled')===0?'PASS':'FAIL'
};
const receipt = path.join(packageRoot,'specs','008-v12-platform','server-gateway-'+selection+'-'+(baseline?'baseline':'candidate'));
fs.writeFileSync(receipt+'.log',stdout+'\n'+stderr);
fs.writeFileSync(receipt+'.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,testFiles:summary.testFiles.length,receipt},null,2));
process.exitCode=summary.status==='PASS'?0:1;
