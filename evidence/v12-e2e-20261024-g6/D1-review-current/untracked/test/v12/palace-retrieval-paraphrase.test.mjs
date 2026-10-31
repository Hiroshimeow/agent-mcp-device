import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates } from '../../dist/plugins/palace/retrieval.js';

const card=(id,body)=>({
  id,version:1,contentHash:'x',summary:'Source claim: '+body,body,status:'observed',
  originDeviceId:'fixture',servingDeviceId:'fixture',scope:{visibility:'account'},
  evidence:[],derivedFrom:[],provenance:[],updatedAt:1,lastVerifiedAt:1
});

test('long paraphrase keeps a candidate with two independent lexical signals',()=>{
  const target=card('port','Error EADDRINUSE starting the isolated gateway: the chosen port already has a listener. Use the assigned test port after inspecting its owner. Production and backup listeners must not be terminated.');
  const distractor=card('proxy','Decision: a reverse proxy must forward WebSocket upgrades and preserve the original Host and authorization headers.');
  const query='A test gateway cannot bind its socket because another service owns the address; how do we investigate safely?';
  assert.deepEqual(rankCandidates([target,distractor],query,5).map(x=>x.id),['port']);
});

test('long no-answer query still abstains on a single generic lexical overlap',()=>{
  const node=card('node','Error node:sqlite import failed under Node 20 in the order worker. The package requires Node 22.13 or newer.');
  const query='How do I repair a Rust Cargo checksum mismatch in the package registry?';
  assert.deepEqual(rankCandidates([node],query,5),[]);
});

test('long no-answer query does not combine unrelated single-term cards',()=>{
  const image=card('image','Error image thumbnail conversion: preserve the original aspect ratio.');
  const auth=card('auth','Decision: credentials must be checked before authorization.');
  const query='How should a Kubernetes pod recover from an expired image pull credential?';
  assert.deepEqual(rankCandidates([image,auth],query,5),[]);
});
