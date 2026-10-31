import test from 'node:test';
import assert from 'node:assert/strict';
import {observeDefender} from './helpers/defender-context.mjs';

const settings={AntivirusEnabled:true,RealTimeProtectionEnabled:true,DisableRealtimeMonitoring:false,ExclusionPath:'N/A: Must be an administrator to view exclusions',ExclusionProcess:'N/A: Must be an administrator to view exclusions'};
const response=(body,extra={})=>()=>({status:0,stdout:JSON.stringify(body),stderr:'',...extra});
test('Windows probe rejects unavailable, disabled and indeterminate Defender before sampling',()=>{
 for(const run of [response(settings,{status:1}),response(settings,{stdout:'not JSON'}),response({...settings,AntivirusEnabled:false}),response({...settings,RealTimeProtectionEnabled:false}),response({...settings,DisableRealtimeMonitoring:true}),response({...settings,RealTimeProtectionEnabled:undefined})])
  assert.throws(()=>observeDefender('win32',run),error=>error.code==='DEFENDER_REQUIRED');
});
test('Windows probe accepts active Defender but does not claim unknown exclusions are absent',()=>{
 const observed=observeDefender('win32',response(settings));
 assert.equal(observed.available,true);assert.equal(observed.settings.ExclusionPath,settings.ExclusionPath);assert.equal(observed.settings.ExclusionProcess,settings.ExclusionProcess);
});
test('non-Windows probe does not pretend Defender exists',()=>{
 assert.deepEqual(observeDefender('linux',()=>{throw new Error('must not query Windows');}),{available:false,reason:'not Windows'});
});
