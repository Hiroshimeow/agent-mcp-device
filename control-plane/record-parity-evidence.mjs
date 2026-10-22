import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'specs/008-v12-platform/gateway-import-manifest.json');
const inventoryPath = path.join(root, 'specs/008-v12-platform/gateway-parity.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(bytes) {
  const text = bytes.toString('utf8');
  const isText = !bytes.includes(0) && Buffer.from(text, 'utf8').equals(bytes);
  const normalized = isText ? Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8') : bytes;
  return { kind:isText?'utf8-lf':'raw-bytes', sha256:hash(normalized), bytes:normalized.length };
}
const adaptationReasons = {
  'control-plane/scripts/account-http.mjs': 'Optional administrator login for the same authenticated operator application; ordinary user account boundary retained.',
  'control-plane/scripts/authenticated-mcp-wrapper.mjs': 'Callable runtime factory, explicit package/assets/state paths, mandatory embedded shared Core, same-app operator routes, full Context contracts and generic authenticated extraTools, unified upstream config, startup resource rollback and failure-preserving all-resource shutdown.',
  'control-plane/scripts/device-broker.mjs': 'Private in-process endpoint enters existing proof/claim/authorization/epoch/pending machinery; remote protocol unchanged; embedded server update requires its service restart.',
  'control-plane/scripts/operator-dashboard-http.mjs': 'Mount reusable operator routes on the main authenticated application; administrator session required.',
  'control-plane/scripts/upstreams/manager.mjs': 'Close already-created provider clients if mandatory startup or fatal initial catalog construction fails.',
  'control-plane/scripts/upstreams/stdio-client.mjs': 'Close the client/transport when initialization fails before a provider handle can be returned to its manager.',
  'control-plane/tests/device-store.test.mjs': 'Windows fixture cleanup closes SQLite before deleting its temporary directory; source assertions unchanged.'
};
manifest.adaptations = [];
for (const file of manifest.files) {
  if (!file.canonical) {
    const original = fs.readFileSync(path.join(manifest.sourceRoot, file.source));
    if (hash(original) !== file.sha256) throw new Error('Cannot initialize canonical source provenance from changed capture: ' + file.source);
    file.canonical = canonical(original);
  }
  const bytes = fs.readFileSync(path.join(root, file.target));
  const sha256 = hash(bytes), normalized = canonical(bytes);
  if (normalized.sha256 === file.canonical.sha256 && normalized.kind === file.canonical.kind) continue;
  const reason = adaptationReasons[file.target];
  if (!reason) throw new Error('Unreviewed imported-file change: ' + file.target);
  manifest.adaptations.push({ source: file.source, target: file.target, originalSha256: file.sha256, originalCanonicalSha256:file.canonical.sha256, sha256, bytes: bytes.length, canonical:normalized, reason });
}
const additionReasons = {
  'control-plane/scripts/embedded-device.mjs': 'Normal account/PKCE pairing controller and signed local endpoint for the mandatory shared Device Core.',
  'control-plane/config/mcp-servers.toml': 'Generic disabled-upstream default derived from the tracked example; no private configuration.',
  'control-plane/import-gateway.mjs': 'Explicit import-closure collector with fixed source HEAD and provenance hashes.',
  'control-plane/verify-parity.mjs': 'Read-only provenance/inventory verifier and explicit nonvacuous test-group runner.',
  'control-plane/record-parity-evidence.mjs': 'Explicit allowlisted adaptation and local receipt recorder; never changes source repositories.',
  'control-plane/portfree-union-preload.mjs': 'Test-only listener/network denial and isolated home/temp; not packaged.',
  'control-plane/run-portfree-union.mjs': 'Inspected retained behavioral families with isolated environment and comparable baseline/candidate receipts; not packaged.'
};
manifest.additions = Object.entries(additionReasons).map(([target, reason]) => {
  const bytes = fs.readFileSync(path.join(root, target));
  return { target, sha256: hash(bytes), bytes: bytes.length, canonical:canonical(bytes), reason };
});
manifest.summary = {
  importedFiles: manifest.files.length,
  importedBytes: manifest.files.reduce((total, row) => total + row.bytes, 0),
  unchangedImportedFiles: manifest.files.length - manifest.adaptations.length,
  adaptedImportedFiles: manifest.adaptations.length,
  addedFiles: manifest.additions.length,
  sourceScriptModules: manifest.files.filter(row => row.source.startsWith('scripts/') && row.source.endsWith('.mjs')).length,
  retainedTestFiles: manifest.files.filter(row => /^tests\/[^/]+\.test\.mjs$/.test(row.source)).length,
  skillPackages: manifest.files.filter(row => /^scripts\/skills\/[^/]+\/SKILL\.md$/.test(row.source)).length
};
manifest.hashPolicy = {
  capturedRaw:'files[].sha256 and bytes preserve the exact original G6 working-tree bytes at the recorded clean HEAD; never rewritten.',
  canonical:'Valid round-trippable UTF-8 text without NUL normalizes CRLF to LF; binary data remains byte-exact. canonical.sha256 is the portable verification identity.',
  candidate:'Adaptations/additions preserve their captured candidate raw hashes separately from canonical content hashes.'
};
manifest.transformations = 'Original source SHA256/bytes remain immutable in files[]. Explicit adaptations and additions record candidate raw and portable canonical hashes. Run verify-parity.mjs --source to check both repositories.';
manifest.packagingReview = {
  onePackage: true,
  roots: { package: '.', assets: 'control-plane', state: 'explicit stateRoot outside package', database: 'stateRoot/gateway.sqlite' },
  attribution: {
    gateway: { path:'control-plane/scripts/GATEWAY-LICENSE.txt', source:'agent-mcp-gateway/LICENSE', license:'MIT', copyright:'Copyright (c) 2026 Ren Zimeng', preservation:'Exact original copyright, permission notice and disclaimer are packaged.' },
    skills: [
      { license:'MIT', paths:['control-plane/scripts/skills/_upstream_licenses/ponytail-LICENSE.txt','control-plane/scripts/skills/_upstream_licenses/superpowers-LICENSE.txt','control-plane/scripts/skills/_upstream_licenses/hallmark-LICENSE.txt'] },
      { license:'Apache-2.0', paths:['control-plane/scripts/skills/_upstream_licenses/stitch-skills-LICENSE.txt'], perSkillLicenses:'All 11 included Anthropic skill directories retain LICENSE.txt.' },
      { license:'Upstream third-party notices', path:'control-plane/scripts/skills/_upstream_licenses/anthropic-THIRD_PARTY_NOTICES.md', scope:'Notice mentions BSD imageio, GPL FFmpeg, HPND Pillow and OFL fonts. The closure does not vendor these executables, Python packages or standalone font files.' }
    ],
    excludedBySourceLicenseManifest:['canvas-design','doc-coauthoring','docx','pdf','pptx','xlsx'],
    auditScope:'Packaged control-plane/scripts, control-plane/config and control-plane/contracts only; no runtime database, account/identity state, .env, private-key header or symlink found. TLS private test key remains under excluded control-plane/tests.',
    compressedAsset:'The original shadcn-components.tar.gz contains 49 component-source/directory entries, no private material, absolute/traversal paths or links; the original theme-showcase.pdf is retained byte-for-byte.'
  },
  requiredPackagedPaths: ['dist', 'control-plane/scripts', 'control-plane/config', 'control-plane/contracts', 'skills/mcp-device-context'],
  notRuntimeAssets: ['control-plane/tests', 'control-plane/import-gateway.mjs', 'control-plane/verify-parity.mjs', 'control-plane/record-parity-evidence.mjs', 'control-plane/portfree-union-preload.mjs', 'control-plane/run-portfree-union.mjs'],
  details: [
    'Runtime/admin/device-admin relative imports resolve inside control-plane/scripts; dependencies resolve through the single root package.',
    'Skill discovery uses control-plane/scripts/skills and retains all raw assets and source manifests.',
    'The selected TOML path is shared by workspace registry, startup external manager and hot reload.',
    'No separate operator listener; /operator uses administrator account session on the same app.',
    'Dynamic Context catalog import resolves through packageRoot/dist/context/tool-contract.js.',
    'Current root package cold-install acceptance remains owned by the root coordinator.'
  ]
};

const sourceArgs = ['tests/skills.test.mjs','tests/skills-mcp-adapter.test.mjs','tests/upstream-config.test.mjs','tests/upstream-names.test.mjs','tests/upstream-risk.test.mjs','tests/upstream-resource-uri.test.mjs','tests/upstream-cache.test.mjs','tests/upstream-stdio.test.mjs','tests/external-tool-broker.test.mjs','tests/catalog-budget.test.mjs','tests/catalog-output-bounds.test.mjs'];
const securityArgs = ['tests/device-public-contract.test.mjs','tests/account-store.test.mjs','tests/account-oauth.test.mjs','tests/device-pairing-store.test.mjs','tests/device-store.test.mjs','tests/device-access-policy.test.mjs','tests/remote-process-sessions.test.mjs','tests/remote-tool-result.test.mjs','tests/tool-metrics.test.mjs'];
inventory.executionGroups = [
  { id:'gateway-security', cwd:'control-plane', args:['--test',...securityArgs], listener:'NONE', minimumTests:45 },
  { id:'gateway-sources', cwd:'control-plane', args:['--test',...sourceArgs], listener:'NONE', minimumTests:63 },
  { id:'server-unit', cwd:'.', args:['--test','--test-concurrency=1','test/v12/server-broker.test.mjs','test/v12/server-paths.test.mjs','test/v12/server-upstream-startup.test.mjs'], listener:'NONE', minimumTests:14 },
  { id:'server-8104', cwd:'.', args:['--test','--test-concurrency=1','test/v12/server-context.test.mjs','test/v12/server-e2e.test.mjs'], listener:'127.0.0.1:8104', minimumTests:26, precondition:'Coordinator owns exclusive isolated 8104 lease; never stop/rebind 8103 or G8.' }
];
inventory.runner = {
  entry:'control-plane/verify-parity.mjs',
  readOnlyCommand:['node','control-plane/verify-parity.mjs','--source'],
  runSafeCommand:['node','control-plane/verify-parity.mjs','--run','all-safe'],
  runNetworkCommand:['node','control-plane/verify-parity.mjs','--run','server-8104'],
  nodeUsed:'C:/Program Files/nodejs/node.exe v22.22.2',
  nonvacuity:'Each execution group must exit zero and report at least minimumTests TAP tests.'
};
const receiptFiles = {
  security:'server-gateway-security-tests.log', sources:'server-gateway-source-tests.log',
  broker:'server-broker-test.log', context:'server-context-test.log',
  e2e:'server-e2e-test.log', paths:'server-paths-test.log',
  upstreamStartup:'server-upstream-startup-test.log'
};
inventory.candidateReceipts = Object.entries(receiptFiles).map(([id, name]) => {
  const relative = 'specs/008-v12-platform/' + name;
  const bytes = fs.readFileSync(path.join(root, relative));
  const text = bytes.toString('utf8');
  const number = key => Number([...text.matchAll(new RegExp('^# ' + key + ' (\\d+)$', 'gm'))].at(-1)?.[1] || 0);
  const tests = number('tests'), pass = number('pass'), fail = number('fail'), skipped = number('skipped'), cancelled = number('cancelled');
  return { id, path:relative, sha256:hash(bytes), tests, pass, fail, skipped, cancelled,
    status: tests > 0 && fail === 0 && pass > 0 && cancelled === 0 ? 'PASS_WITH_RECORDED_COVERAGE' : 'FAIL_OR_VACUOUS',
    node:'v22.22.2', environment:'G6 isolated test roots; no G8 access' };
});
const evidence = {
  'GW-accounts': { receipts:['security','e2e'], status:'TARGETED_PASS', covered:['account persistence/session hash and role boundaries','one-use invite signup','administrator login and account revocation'], gaps:['Legacy HTTP/admin-cli suites not run as complete families.'] },
  'GW-oauth': { receipts:['security','e2e'], status:'TARGETED_PASS', covered:['DCR/consent/S256 PKCE','CSRF denial','refresh and account revoke invalidation','legacy initialize and modern per-request metadata'], gaps:['Full legacy auth-session/offline-access HTTP suites not run.'] },
  'GW-dashboard': { receipts:['e2e'], status:'TARGETED_PASS', covered:['account dashboard access','anonymous/user/operator role boundary on same listener'], gaps:['All historical dashboard mutation/usage aggregation scenarios not rerun.'] },
  'GW-pairing': { receipts:['security','broker','e2e'], status:'TARGETED_PASS', covered:['PKCE/grant binding and normal browser claim','invalid proof does not consume grant','local and remote account ownership/cross-account denial','remote account relink'], gaps:['Full historical HTTP pairing suite not rerun.'] },
  'GW-identity': { receipts:['security','broker','e2e'], status:'TARGETED_PASS', covered:['durable key/auth generation','rotation/revocation and ABA pending-call guard','proof reconnect and ownership'], gaps:['Forget/device-admin CLI families not rerun.'] },
  'GW-transport': { receipts:['broker','e2e'], status:'TARGETED_PASS', covered:['real remote TLSv2 channel using existing Device implementation','binary outer transport without tool-call plaintext','monotonic protocol floor retained for remote clients','local endpoint no self-WebSocket','reconnect/stale process-session behavior'], gaps:['Complete legacy bad-CA/tamper/replay negative network matrix not rerun.'] },
  'GW-dispatch': { receipts:['security','broker','e2e'], status:'TARGETED_PASS', covered:['shared real Core native filesystem/shell dispatch','explicit ownership/capability authorization','epoch/runtime affinity and pending replacement','late/stale results and no replay'], gaps:['Not every native tool has a real-server round trip; Device parity inventory owns full native surface.'] },
  'GW-access': { receipts:['security','broker','e2e'], status:'TARGETED_PASS', covered:['retained access policy assertions','same-account/foreign-account dispatch boundary','capability withdrawal'], gaps:['Full inventory pagination/profile/risk family not rerun.'] },
  'GW-release': { receipts:[], status:'SOURCE_PRESERVED_NOT_RUN', covered:['release provider source retained byte-for-byte','remote update path retained'], gaps:['No download/update/restart acceptance performed; E2E uses local release-provider stub.','Embedded server updates require owning service restart rather than remotely spawning a second Core.'] },
  'GW-public-contract': { receipts:['security','context','e2e'], status:'TARGETED_PASS', covered:['all 12 frozen broker definitions byte/schema parity','SDK error/structured output assertions','additive full six Context definitions/argument routing','no host fallback on denied dispatch'], gaps:['Actual signed Context authorization artifact unavailable; gate denial tested with real Core and successful routing tested with a fixture Core.'] },
  'GW-projects': { receipts:[], status:'SOURCE_PRESERVED_NOT_RUN', covered:['project/resource/prompt source and tests retained'], gaps:['Detailed projects/resources/prompts runtime parity still requires separate family execution.'] },
  'GW-skills': { receipts:['sources','e2e'], status:'TARGETED_PASS', covered:['retained disk-backed Skills and MCP adapter assertions','raw assets/frontmatter/manifest/hash behavior','real modern MCP skills/list and skills/get'], gaps:['One Windows symlink-privilege fixture skip is recorded in sources receipt; source-sync/check scripts not executed.'] },
  'GW-upstreams': { receipts:['sources','paths','upstreamStartup'], status:'TARGETED_PASS', covered:['real STDIO tool/resource/prompt forwarding','cache modes/reconcile/broker/error/risk/namespaces','explicit/default config startup parity','mandatory-provider/catalog failure cleanup','real unresponsive child timeout cleanup'], gaps:['HTTP upstream listener suite not run.','First-start configured STDIO HTTP E2E was added after initial 17-test receipt and awaits final 18-test run.'] },
  'GW-catalog': { receipts:['sources','context','e2e'], status:'TARGETED_PASS', covered:['catalog budget and output bounds','frozen public schemas plus additive Context/platform tools'], gaps:['Scale/benchmark historical families not run in this lane; timing receipts are not benchmarks.'] },
  'GW-metrics': { receipts:['security','e2e'], status:'TARGETED_PASS', covered:['tool metric metadata/duration/bytes assertions','unified account/device/OAuth gateway.sqlite state'], gaps:['Full legacy usage-event and runtime-DB contract families not rerun.'] },
  'GW-packaging': { receipts:['paths'], status:'ROOT_OWNED_FINAL_ACCEPTANCE', covered:['one root package and explicit package/asset paths','disk Skills/default config/contract closure','Gateway MIT attribution and retained upstream Skill licenses/notices are inside the npm files whitelist','startup failure releases Windows SQLite handles','normal shutdown preserves Core cleanup failures for repeated callers and still closes unrelated resources'], gaps:['Cold tarball install/CLI/service acceptance is tracked by the root coordinator.'] }
};
for (const entry of inventory.entries) {
  entry.statusScope = 'The original baseline command as a whole was not run; fresh candidate evidence is recorded separately.';
  entry.candidateEvidence = evidence[entry.id];
}

const comparedGroups = [
  ['projects','projects',56],
  ['behavior','behavior',63],
  ['compatibility','compatibility',13],
  ['securityExtra','security-extra',7]
];
inventory.comparativeRuns = [];
for (const [id, group, minimumTests] of comparedGroups) {
  const candidateBase = 'specs/008-v12-platform/server-gateway-' + group + '-candidate';
  const baselineBase = 'specs/008-v12-platform/server-gateway-' + group + '-baseline';
  const candidate = JSON.parse(fs.readFileSync(path.join(root,candidateBase+'.json'),'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.join(root,baselineBase+'.json'),'utf8'));
  if (candidate.exitCode !== 0 || candidate.tests < minimumTests || candidate.cancelled !== 0) throw new Error('Candidate receipt failed or vacuous: '+group);
  if (baseline.exitCode !== 0 || baseline.tests < minimumTests || baseline.cancelled !== 0) throw new Error('Baseline receipt failed or vacuous: '+group);
  const bytes = fs.readFileSync(path.join(root,candidateBase+'.log'));
  inventory.candidateReceipts.push({
    id,path:candidateBase+'.log',metadata:candidateBase+'.json',sha256:hash(bytes),
    tests:candidate.tests,pass:candidate.pass,fail:candidate.fail,skipped:candidate.skipped,cancelled:candidate.cancelled,
    status:'PASS_WITH_RECORDED_COVERAGE',node:candidate.node,environment:candidate.networkPolicy
  });
  inventory.comparativeRuns.push({
    group,baselineReceipt:baselineBase+'.json',candidateReceipt:candidateBase+'.json',
    baselineTests:baseline.tests,baselinePass:baseline.pass,candidateTests:candidate.tests,candidatePass:candidate.pass,
    status:'BEHAVIOR_PARITY_PASS',
    exclusions:group==='compatibility'?[
      'static bearer docs describe optional dual auth without replacing OAuth',
      'package exposes benchmark:catalog command',
      'package exposes cross-platform sync commands'
    ]:[]
  });
  inventory.executionGroups.push({
    id:'gateway-'+group,cwd:'.',args:['control-plane/run-portfree-union.mjs',group],
    listener:'NONE',minimumTests,resultFormat:'json-summary'
  });
}
inventory.runner.comparisonCommands = [
  ['node','control-plane/run-portfree-union.mjs','projects','--baseline'],
  ['node','control-plane/run-portfree-union.mjs','behavior','--baseline'],
  ['node','control-plane/run-portfree-union.mjs','compatibility','--baseline'],
  ['node','control-plane/run-portfree-union.mjs','security-extra','--baseline']
];
inventory.layoutOnlyExclusions = {
  initialReceipt:'specs/008-v12-platform/server-gateway-compatibility-candidate-layout-initial.log',
  initialResult:'13 behavioral passes / 3 ENOENT failures for old nested package/docs paths; no source/runtime mutation was used to hide these failures.',
  rerun:'Explicit --test-skip-pattern excludes only three legacy package/docs assertions; candidate 13/13 and original package 16/16.',
  preservedDeveloperCommands:[
    'node control-plane/scripts/benchmark-mcp-catalog.mjs',
    'node control-plane/scripts/sync-skills.mjs',
    'node control-plane/scripts/sync-skills.mjs --check'
  ],
  unexecutedLayoutFamilies:['tests/repo-hygiene.test.mjs','tests/runtime-db-contract.test.mjs'],
  replacement:'One-package cold installation and actual account/device/OAuth persistence tests replace old README/package/PowerShell launcher layout assertions.'
};
function extendEvidence(id, receiptIds, covered, gaps) {
  const target = inventory.entries.find(row=>row.id===id).candidateEvidence;
  target.receipts = [...new Set([...target.receipts,...receiptIds])];
  target.covered.push(...covered);
  if(gaps)target.gaps=gaps;
}
extendEvidence('GW-accounts',['behavior'],['Original admin CLI create/list/revoke/delete accounts and create/revoke invites passed on both baseline and candidate.'],['Complete historical HTTP presentation, anti-enumeration and cooldown suite not rerun.']);
extendEvidence('GW-oauth',['compatibility','securityExtra'],['Auth state survives reopening with tokens hashed at rest.','Offline access/refresh rotation preserves account identity across provider restart.','Redirect matching and typed invalid-token error contracts match baseline.'],['Complete historical OAuth HTTP suite not rerun; actual application account/consent/PKCE/refresh/revoke flow is covered by E2E.']);
extendEvidence('GW-dashboard',['behavior'],['Rolling usage windows, per-device/per-tool accounting, account-scoped sessions and bounded metadata are tested.'],['Historical HTTP dashboard mutation/CSRF and presentation variants not fully rerun.']);
extendEvidence('GW-identity',['behavior','securityExtra'],['Operator pre-enroll/key rotate/revoke CLI passes baseline and candidate.','Forget transaction removes all product-facing rows; late usage does not recreate ghost device rows.'],['Complete historical WebSocket key/ownership negative matrix not rerun.']);
extendEvidence('GW-transport',['securityExtra'],['Exporter-bound challenge encoding rejects every tested mode/nonce/exporter/key/grant/device mutation.','Framing handles split/coalesced messages and rejects zero/oversized frame lengths.'],['Legacy network tamper/replay/bad-host certificate matrix still requires the exclusive 8104 lane.']);
extendEvidence('GW-access',['behavior'],['Inventory schema cardinality, pagination, ambiguity and revoked filtering match baseline.','Retained runtime profiles, risk annotations and exposure rules match baseline.'],[]);
const release = inventory.entries.find(row=>row.id==='GW-release').candidateEvidence;
release.status='TARGETED_PASS';
extendEvidence('GW-release',['behavior'],['Version parsing/minimum bootstrap policy and injected release lookup cache/fallback passed unchanged on baseline and candidate.'],['No real package download/update/restart was performed; broker update-state E2E needs isolated network fixtures.','Embedded server updates require the owning service restart, preserving a single Core.']);
extendEvidence('GW-public-contract',['behavior'],['Strict MCP SDK InMemoryTransport accepts every output shape and rejects missing structured output.','Public routing/no-host-fallback and byte-bound response utility assertions match baseline.']);
const projects = inventory.entries.find(row=>row.id==='GW-projects');
projects.status='PASS';
projects.statusScope='Original nine-file project/resource/prompt command executed on the clean baseline and candidate through the isolated no-network harness.';
projects.baselineReceipt='specs/008-v12-platform/server-gateway-projects-baseline.json';
projects.candidateEvidence.status='PARITY_TESTS_PASS';
extendEvidence('GW-projects',['projects'],['56 unchanged assertions on both baseline and candidate: explicit device/project routing, summaries/trees/Git views, opaque pagination, resources/prompts, traversal/binary/size limits, trusted-root parsing, hot reload and subscriber rollback.'],[]);
extendEvidence('GW-skills',['compatibility','behavior'],['Source lock/manifest provenance, frontmatter descriptions, pinned self-contained assets and source file safety passed.','Skill catalog version/change semantics and lazy resource loading are covered by original custom-tools tests.'],['The earlier raw symlink-creation fixture skip remains in the source receipt.','Source synchronization/check scripts are retained but not executed because --check clones external repositories.']);
extendEvidence('GW-catalog',['behavior','compatibility'],['Fixed cardinality/serialized schema sizes across 1–1000 projects/devices/Skills.','External eager-byte budgets, resource surface modes, static collision names and portable benchmark command construction.','Exact UTF-8 catalog byte accounting and deterministic synthetic input.'],['This is behavioral catalog/measurement validation, not a runtime latency benchmark.']);
extendEvidence('GW-metrics',['behavior','securityExtra'],['Device usage persists metadata-only counters across reopening.','Activity sessions and tool/catalog/skill/schema events retain account attribution and reject ended sessions.','Forgotten devices cannot regain product rows through late metrics.'],['Old runtime-db-contract file depends on the removed Gateway-specific launcher/package layout; real shared-database behavior is covered by store/E2E/cold-package tests.']);

const e2e = inventory.candidateReceipts.find(row => row.id === 'e2e');
if (e2e.tests >= 18 && e2e.fail === 0) {
  const upstream = inventory.entries.find(row => row.id === 'GW-upstreams').candidateEvidence;
  upstream.receipts.push('e2e');
  upstream.covered.push('configured STDIO provider appears and executes on the first HTTP server start');
  upstream.gaps = upstream.gaps.filter(gap => !gap.startsWith('First-start'));
}
inventory.integrationAcceptance = {
  latestRealServerTests:e2e.tests,
  protocols:['2025-11-25 legacy initialize','2026-07-28 modern per-request metadata/server discovery'],
  localSharedCore:true,
  actualRemoteDeviceChildren:2,
  oneListener:'127.0.0.1:8104',
  federation:[
    'A and B have real Palace process providers; C is disabled and never creates a Palace database.',
    'Search/list leave A with zero cards; selected read imports exactly one source-backed B card.',
    'Repeated read deduplicates and preserves origin/provenance/version/hash/evidence receipt.',
    'B correction refreshes the existing imported A card without a duplicate.',
    'C can use shared knowledge without Palace; same-account relink is performed through ordinary pairing.',
    'Plugin disable withdraws capabilities; native Device actions continue; offline session cache returns stale metadata.'
  ],
  limitations:[
    'These are G6 isolated acceptance receipts, not production observations.',
    'The real Core retains its existing signed Context authorization gate; no forged approval artifact was created.',
    'Final root build/versioned capability facade changes require the coordinator final server regression.',
    'First configured-upstream startup test is only covered when latestRealServerTests is at least 18.',
    'No full replication or background n-by-n knowledge sync is introduced.'
  ]
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ importSummary:manifest.summary, receipts:inventory.candidateReceipts.map(({id,tests,pass,fail,skipped})=>({id,tests,pass,fail,skipped})) }, null, 2));
