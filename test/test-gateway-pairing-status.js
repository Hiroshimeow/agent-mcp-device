import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';

import { GatewayDeviceIdentity } from '../dist/device/gateway-identity.js';
import { pairGatewayDevice } from '../dist/device/gateway-pairing.js';
import { GatewayDeviceStatusStore, formatGatewayStatus } from '../dist/device/device-status.js';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function testPairingUsesPkceQrWithoutOpeningBrowserAndReturnsOnlyEnrollmentGrant() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-pairing-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  let startPayload = null;
  let pollCount = 0;
  let expectedChallenge = '';
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    if (req.url === '/device/start') {
      startPayload = body;
      expectedChallenge = body.code_challenge;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        device_code: 'device-code-test',
        user_code: 'ABCD-2345',
        verification_uri: 'https://gateway.test/device/verify',
        verification_uri_complete: 'https://gateway.test/device/verify?user_code=ABCD-2345',
        expires_in: 600,
        interval: 1
      }));
      return;
    }
    if (req.url === '/device/poll') {
      pollCount += 1;
      const actualChallenge = crypto.createHash('sha256').update(body.code_verifier).digest('base64url');
      assert.equal(actualChallenge, expectedChallenge);
      res.setHeader('content-type', 'application/json');
      if (pollCount === 1) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'authorization_pending' }));
      } else {
        res.end(JSON.stringify({
          enrollment_grant: 'pairing-grant-only',
          device_id: startPayload.device_id,
          account: { connected: true, label: 'Example Gateway' }
        }));
      }
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  const port = await listen(server);
  const opened = [];
  const qrs = [];
  const logs = [];
  let proxyAgentRequests = 0;
  const proxyAgent = new http.Agent();
  const originalAddRequest = proxyAgent.addRequest;
  proxyAgent.addRequest = function (...args) {
    proxyAgentRequests += 1;
    return originalAddRequest.apply(this, args);
  };
  try {
    const result = await pairGatewayDevice({
      gatewayUrl: `http://127.0.0.1:${port}`,
      identity,
      proxyAgent,
      deviceName: 'ThinkBook Pair Test',
      openBrowser: async url => opened.push(url),
      renderQr: value => qrs.push(value),
      sleep: async () => {},
      log: value => logs.push(String(value))
    });
    const record = await identity.loadOrCreate();
    assert.equal(startPayload.device_id, record.deviceId);
    assert.equal(startPayload.device_name, 'ThinkBook Pair Test');
    assert.equal(startPayload.public_key_pem, record.publicKeyPem);
    assert.equal(startPayload.code_challenge_method, 'S256');
    assert.equal(opened.length, 0, 'pairing must never auto-open a browser');
    assert.equal(qrs[0], 'https://gateway.test/device/verify?user_code=ABCD-2345');
    assert(logs.some(line => line.includes('ABCD-2345')));
    assert.deepEqual(result.account, { connected: true, label: 'Example Gateway' });
    assert.equal(result.enrollmentGrant, 'pairing-grant-only');
    assert.equal('accessToken' in result, false);
    assert.equal('refreshToken' in result, false);
    assert(proxyAgentRequests >= 2, 'pairing start and poll must use the configured HTTP agent');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testStatusStorePersistsOnlyNonSecretAccountUsageAndSchemaMetadata() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-status-'));
  const statusPath = path.join(root, 'gateway-status.json');
  const store = new GatewayDeviceStatusStore(statusPath);
  await store.update({
    gatewayUrl: 'https://mcp-v2.example.test',
    deviceId: 'dc-device-1',
    deviceName: 'ThinkBook',
    identityPresent: true,
    account: { connected: true, label: 'Example Gateway' },
    connection: { online: true, connectionEpoch: 2, lastConnectedAt: 123456 },
    usage: {
      connections: 2,
      reconnects: 1,
      toolCallsStarted: 3,
      toolCallsSucceeded: 2,
      toolCallsFailed: 1,
      requestBytes: 100,
      responseBytes: 200,
      lastSeenAt: 123456,
      lastErrorCode: 'TEST'
    },
    schema: {
      toolCount: 16,
      toolSchemaBytes: 16225,
      toolSchemaTokenEstimate: 4057,
      tokenEstimateMethod: 'utf8_bytes_div_4_estimate',
      tokenUsageKind: 'schema_estimate_not_billing'
    },
    usageFreshAt: 123456
  });
  const restored = await new GatewayDeviceStatusStore(statusPath).load();
  assert.equal(restored.account.connected, true);
  assert.equal(restored.schema.toolSchemaTokenEstimate, 4057);
  const raw = await fs.readFile(statusPath, 'utf8');
  assert(!/privateKey|enrollmentGrant|accessToken|refreshToken/.test(raw));

  const statusOptions = {
    service: { installed: true, running: false, autostart: false, registration: 'manual' },
    security: { protocolFloor: 2, appCaProvisioned: true },
    proxy: { mode: 'configured' }
  };
  const text = formatGatewayStatus(restored, { json: false, ...statusOptions });
  assert(text.includes('Account: connected (Example Gateway)'));
  assert(text.includes('Startup: manual'));
  assert(text.includes('Security: v2 required/active; app CA provisioned'));
  assert(text.includes('Proxy: configured'));
  assert(text.includes('Schema token estimate: 4057'));
  assert(/not ChatGPT billing/i.test(text));
  assert.equal(text.includes('proxy-user'), false);
  const json = JSON.parse(formatGatewayStatus(restored, { json: true, ...statusOptions }));
  assert.equal(json.schema.tokenUsageKind, 'schema_estimate_not_billing');
  assert.equal(json.service.installed, true);
  assert.deepEqual(json.security, { protocolFloor: 2, appCaProvisioned: true, channel: 'v2 required/active' });
  assert.deepEqual(json.proxy, { mode: 'configured' });

  const offline = formatGatewayStatus({
    ...restored,
    connection: { ...restored.connection, online: false }
  }, { json: false, ...statusOptions });
  assert(offline.includes('Security: v2 required/offline; app CA provisioned'));

  const legacy = formatGatewayStatus(restored, {
    json: false,
    ...statusOptions,
    security: { protocolFloor: 1, appCaProvisioned: false }
  });
  assert(legacy.includes('Security: legacy v1; app CA not provisioned'));

  await fs.rm(root, { recursive: true, force: true });
}

await testPairingUsesPkceQrWithoutOpeningBrowserAndReturnsOnlyEnrollmentGrant();
await testStatusStorePersistsOnlyNonSecretAccountUsageAndSchemaMetadata();
console.log('Gateway pairing + status tests passed');
