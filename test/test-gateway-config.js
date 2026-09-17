import assert from 'assert';
import fs from 'fs/promises';
import http from 'http';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'device-inner-tls');

import {
  GatewayDeviceConfigStore,
  captureGatewayConfigFromEnvironment,
  createGatewayProxyAgent,
  resolveProxyDecisionFromEnvironment
} from '../dist/device/gateway-config.js';
import { OFFICIAL_GATEWAY_URL, bootstrapOfficialGatewayTrust } from '../dist/device/official-trust.js';

async function testConfigPersistenceAndMonotonicSecurityFloor() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-gateway-config-'));
  const configPath = path.join(root, 'gateway-config.json');
  try {
    const store = new GatewayDeviceConfigStore(configPath, { platform: 'linux' });
    assert.deepEqual(await store.load(), {
      version: 1,
      gatewayUrl: null,
      allowedRoots: [],
      proxy: { mode: 'direct', url: null },
      appCaPem: null,
      securityProtocolFloor: 1
    });
    await store.update({ gatewayUrl: 'https://gateway.example.test', allowedRoots: ['C:\\Work', 'C:\\Work'] });
    let current = await store.load();
    assert.equal(current.gatewayUrl, 'https://gateway.example.test/');
    assert.deepEqual(current.allowedRoots, ['C:\\Work']);
    assert.equal(current.securityProtocolFloor, 1);

    const appCaPem = await fs.readFile(path.join(fixtureDir, 'ca-cert.pem'), 'utf8');
    await store.update({ appCaPem });
    current = await store.load();
    assert.equal(current.securityProtocolFloor, 2, 'provisioning an app CA must raise the local floor before v2 connection');
    await store.update({ securityProtocolFloor: 1 });
    assert.equal((await store.load()).securityProtocolFloor, 2, 'security floor must never automatically decrease');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testWindowsProxyCredentialsAreProtectedAtRest() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-gateway-proxy-'));
  const configPath = path.join(root, 'gateway-config.json');
  const protectSecret = async value => `sealed:${Buffer.from(value).toString('base64')}`;
  const unprotectSecret = async value => Buffer.from(String(value).slice('sealed:'.length), 'base64');
  try {
    const store = new GatewayDeviceConfigStore(configPath, { platform: 'win32', protectSecret, unprotectSecret });
    const proxyUrl = 'http://proxy-user:proxy-pass@127.0.0.1:8080';
    await store.update({ proxy: { mode: 'configured', url: proxyUrl } });
    const raw = await fs.readFile(configPath, 'utf8');
    assert.equal(raw.includes('proxy-user'), false);
    assert.equal(raw.includes('proxy-pass'), false);
    assert.equal(raw.includes(proxyUrl), false);
    const loaded = await store.load();
    assert.deepEqual(loaded.proxy, { mode: 'configured', url: `${proxyUrl}/` });
    const proxy = createGatewayProxyAgent(loaded);
    assert.equal(typeof proxy.agent.destroy, 'function');
    proxy.agent.destroy();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testInteractiveCapturePersistsConnectionInputs() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-gateway-capture-'));
  const configPath = path.join(root, 'gateway-config.json');
  const names = ['MCP_GATEWAY_URL', 'MCP_GATEWAY_ALLOWED_ROOTS', 'MCP_GATEWAY_APP_CA_PATH', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.MCP_GATEWAY_URL = 'https://gateway.example.test';
    process.env.MCP_GATEWAY_ALLOWED_ROOTS = JSON.stringify(['C:\\Work', 'C:\\Work']);
    process.env.MCP_GATEWAY_APP_CA_PATH = path.join(fixtureDir, 'ca-cert.pem');
    process.env.HTTPS_PROXY = 'http://127.0.0.1:8899';
    const store = new GatewayDeviceConfigStore(configPath, { platform: 'linux' });
    const captured = await captureGatewayConfigFromEnvironment(store);
    assert.equal(captured.gatewayUrl, 'https://gateway.example.test/');
    assert.deepEqual(captured.allowedRoots, ['C:\\Work']);
    assert.equal(captured.proxy.url, 'http://127.0.0.1:8899/');
    assert.equal(captured.securityProtocolFloor, 2);
    assert.match(captured.appCaPem, /BEGIN CERTIFICATE/);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise(resolve => server.close(resolve));
}

function httpsRequest(url, options) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.once('error', reject);
  });
}

async function testPersistedProxyTunnelsTrustedOuterTlsAndRejectsUntrustedCertificate() {
  const ca = await fs.readFile(path.join(fixtureDir, 'ca-cert.pem'));
  const cert = await fs.readFile(path.join(fixtureDir, 'server-cert.pem'));
  const key = await fs.readFile(path.join(fixtureDir, 'server-key.pem'));
  const target = https.createServer({ cert, key }, (_req, response) => response.end('proxied-ok'));
  const targetPort = await listen(target);
  let connectCount = 0;
  const tunnelSockets = new Set();
  const proxyServer = http.createServer((_req, response) => {
    response.writeHead(405);
    response.end();
  });
  proxyServer.on('connect', (request, clientSocket, head) => {
    connectCount += 1;
    const [host, portText] = String(request.url || '').split(':');
    const upstream = net.connect(Number(portText), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    tunnelSockets.add(clientSocket);
    tunnelSockets.add(upstream);
    clientSocket.once('close', () => tunnelSockets.delete(clientSocket));
    upstream.once('close', () => tunnelSockets.delete(upstream));
    upstream.on('error', () => clientSocket.destroy());
  });
  const proxyPort = await listen(proxyServer);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-gateway-proxy-boundary-'));
  const configPath = path.join(root, 'gateway-config.json');
  let proxy;
  const savedHttpProxy = process.env.HTTP_PROXY;
  const savedHttpsProxy = process.env.HTTPS_PROXY;
  try {
    const store = new GatewayDeviceConfigStore(configPath, { platform: 'linux' });
    await store.update({
      gatewayUrl: `https://localhost:${targetPort}`,
      proxy: { mode: 'configured', url: `http://127.0.0.1:${proxyPort}` }
    });
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    proxy = createGatewayProxyAgent(await store.load());
    const trusted = await httpsRequest(`https://localhost:${targetPort}/`, { agent: proxy.agent, ca });
    assert.deepEqual(trusted, { statusCode: 200, body: 'proxied-ok' });
    assert(connectCount >= 1, 'persisted proxy must receive the CONNECT tunnel after proxy env is absent');
    await assert.rejects(
      httpsRequest(`https://localhost:${targetPort}/`, { agent: proxy.agent }),
      /certificate|self[- ]signed|unable to verify|issuer/i
    );
  } finally {
    if (savedHttpProxy === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = savedHttpProxy;
    if (savedHttpsProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = savedHttpsProxy;
    proxy?.agent.destroy();
    for (const socket of tunnelSockets) socket.destroy();
    target.closeAllConnections?.();
    await fs.rm(root, { recursive: true, force: true });
    await closeServer(proxyServer);
    await closeServer(target);
  }
}

async function testOfficialGatewayTrustBootstrapIsIndependentAndFailClosed() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-official-trust-'));
  const configPath = path.join(root, 'gateway-config.json');
  const store = new GatewayDeviceConfigStore(configPath, { platform: 'linux' });
  const caPath = path.join(fixtureDir, 'ca-cert.pem');
  try {
    const seeded = await bootstrapOfficialGatewayTrust(store, { gatewayUrl: OFFICIAL_GATEWAY_URL, caPath });
    assert.equal(seeded.gatewayUrl, OFFICIAL_GATEWAY_URL);
    assert.equal(seeded.securityProtocolFloor, 2);
    assert.match(seeded.appCaPem, /BEGIN CERTIFICATE/);
    await store.update({ securityProtocolFloor: 1 });
    assert.equal((await store.load()).securityProtocolFloor, 2);

    const switched = await bootstrapOfficialGatewayTrust(store, {
      gatewayUrl: 'https://custom-switch.example.test/mcp',
      caPath
    });
    assert.equal(switched.gatewayUrl, 'https://custom-switch.example.test/mcp');
    assert.equal(switched.appCaPem, null, 'switching away from the official gateway must not carry the official trust anchor');
    assert.equal(switched.securityProtocolFloor, 2, 'protocol floor remains monotonic so custom trust must be independently provisioned before connection');

    const customStore = new GatewayDeviceConfigStore(path.join(root, 'custom.json'), { platform: 'linux' });
    const custom = await bootstrapOfficialGatewayTrust(customStore, { gatewayUrl: 'https://custom.example.test/mcp', caPath });
    assert.equal(custom.gatewayUrl, 'https://custom.example.test/mcp');
    assert.equal(custom.appCaPem, null, 'custom gateways must not inherit the official trust anchor');
    assert.equal(custom.securityProtocolFloor, 1);

    const missingStore = new GatewayDeviceConfigStore(path.join(root, 'missing.json'), { platform: 'linux' });
    await assert.rejects(
      () => bootstrapOfficialGatewayTrust(missingStore, { gatewayUrl: OFFICIAL_GATEWAY_URL, caPath: path.join(root, 'missing-ca.pem') }),
      /official.*application CA.*not provisioned/i
    );
    assert.equal((await missingStore.load()).securityProtocolFloor, 1, 'missing official trust must fail before floor mutation');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function testStandardProxyEnvironmentResolution() {
  const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.HTTPS_PROXY = 'http://127.0.0.1:8899';
    assert.deepEqual(resolveProxyDecisionFromEnvironment('https://gateway.example.test'), {
      explicit: true,
      proxyUrl: 'http://127.0.0.1:8899'
    });
    process.env.NO_PROXY = 'gateway.example.test';
    assert.deepEqual(resolveProxyDecisionFromEnvironment('https://gateway.example.test'), {
      explicit: true,
      proxyUrl: null
    });
    for (const name of names) delete process.env[name];
    assert.deepEqual(resolveProxyDecisionFromEnvironment('https://gateway.example.test'), {
      explicit: false,
      proxyUrl: null
    });
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
}

await testConfigPersistenceAndMonotonicSecurityFloor();
await testWindowsProxyCredentialsAreProtectedAtRest();
await testInteractiveCapturePersistsConnectionInputs();
await testPersistedProxyTunnelsTrustedOuterTlsAndRejectsUntrustedCertificate();
await testOfficialGatewayTrustBootstrapIsIndependentAndFailClosed();
testStandardProxyEnvironmentResolution();
console.log('Gateway persisted config and proxy tests passed');
