import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import tls from 'tls';
import { Duplex } from 'stream';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import {
  createClientInnerTls,
  createJsonFrameParser,
  encodeJsonFrame,
  exportDeviceAuthKeyingMaterial
} from '../dist/device/gateway-secure-transport.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'device-inner-tls');
const ca = await fs.readFile(path.join(fixtureDir, 'ca-cert.pem'));
const cert = await fs.readFile(path.join(fixtureDir, 'server-cert.pem'));
const key = await fs.readFile(path.join(fixtureDir, 'server-key.pem'));
const wrongCa = await fs.readFile(path.join(fixtureDir, 'wrong-ca-cert.pem')); 

function serverTlsSocket(ws) {
  const duplex = new Duplex({
    read() {},
    write(chunk, _encoding, callback) {
      ws.send(chunk, { binary: true }, callback);
    },
    destroy(error, callback) {
      try { ws.close(); } catch {}
      callback(error);
    }
  });
  ws.on('message', (raw, isBinary) => {
    if (!isBinary) return duplex.destroy(new Error('v2 transport requires binary WebSocket frames'));
    duplex.push(Buffer.from(raw));
  });
  ws.once('close', () => duplex.push(null));
  ws.once('error', error => duplex.destroy(error));
  return new tls.TLSSocket(duplex, {
    isServer: true,
    cert,
    key,
    minVersion: 'TLSv1.3'
  });
}

async function withServer(run) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const address = wss.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try { await run({ wss, port }); }
  finally { await new Promise(resolve => wss.close(resolve)); }
}

async function testFraming() {
  const messages = [];
  const parser = createJsonFrameParser({ onMessage: message => messages.push(message), maxMessageBytes: 128 });
  const first = Buffer.from(JSON.stringify({ type: 'one' }));
  const second = Buffer.from(JSON.stringify({ type: 'two' }));
  const frame = payload => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length, 0);
    return Buffer.concat([header, payload]);
  };
  const combined = Buffer.concat([frame(first), frame(second)]);
  parser.push(combined.subarray(0, 7));
  parser.push(combined.subarray(7));
  assert.deepEqual(messages, [{ type: 'one' }, { type: 'two' }]);
  const invalid = createJsonFrameParser({ onMessage: () => {}, maxMessageBytes: 8 });
  assert.throws(() => invalid.push(Buffer.from([0, 0, 0, 0])), /length/i);
  assert.throws(() => invalid.push(Buffer.from([0, 0, 0, 9])), /maximum|length/i);
}

async function testClientTlsAndOuterOpacity() {
  await withServer(async ({ wss, port }) => {
    const observed = [];
    const serverReceived = [];
    wss.on('connection', ws => {
      ws.on('message', raw => observed.push(Buffer.from(raw)));
      const secure = serverTlsSocket(ws);
      const parse = createJsonFrameParser({ onMessage: message => serverReceived.push(message) });
      secure.on('data', chunk => parse.push(chunk));
      secure.on('error', () => {});
    });

    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const secure = createClientInnerTls(ws, { ca, servername: 'localhost' });
    await new Promise((resolve, reject) => { secure.once('secureConnect', resolve); secure.once('error', reject); });
    assert.equal(secure.getProtocol(), 'TLSv1.3');
    const marker = 'secret-device-tool-marker';
    secure.write(encodeJsonFrame({ protocol_version: 2, type: 'tool_result', payload: { marker } }));
    const deadline = Date.now() + 2000;
    while (serverReceived.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(serverReceived[0].payload.marker, marker);
    assert(observed.length > 0);
    assert.equal(Buffer.concat(observed).includes(Buffer.from(marker)), false);
    assert.equal(exportDeviceAuthKeyingMaterial(secure, 'device-1', 'reconnect').length, 32);
    secure.destroy();
    ws.close();
  });
}

async function testWrongCaFails() {
  await withServer(async ({ wss, port }) => {
    wss.on('connection', ws => serverTlsSocket(ws).on('error', () => {}));
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const secure = createClientInnerTls(ws, { ca: wrongCa, servername: 'localhost' });
    await assert.rejects(
      new Promise((resolve, reject) => { secure.once('secureConnect', resolve); secure.once('error', reject); }),
      /certificate|issuer|verify|self-signed/i
    );
    ws.terminate();
  });
}

async function testReconnectProducesFreshExporter() {
  await withServer(async ({ wss, port }) => {
    wss.on('connection', ws => serverTlsSocket(ws).on('error', () => {}));
    const WebSocket = (await import('ws')).default;
    const exporters = [];
    for (let index = 0; index < 2; index += 1) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
      const secure = createClientInnerTls(ws, { ca, servername: 'localhost' });
      await new Promise((resolve, reject) => { secure.once('secureConnect', resolve); secure.once('error', reject); });
      exporters.push(exportDeviceAuthKeyingMaterial(secure, 'device-1', 'reconnect'));
      secure.destroy();
      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(exporters[0].equals(exporters[1]), false, 'a new TLS session must produce fresh exporter keying material');
  });
}

async function testWrongHostnameFails() {
  await withServer(async ({ wss, port }) => {
    wss.on('connection', ws => serverTlsSocket(ws).on('error', () => {}));
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const secure = createClientInnerTls(ws, { ca, servername: 'wrong.example.test' });
    await assert.rejects(
      new Promise((resolve, reject) => { secure.once('secureConnect', resolve); secure.once('error', reject); }),
      /hostname|altname|certificate/i
    );
    ws.terminate();
  });
}

await testFraming();
await testClientTlsAndOuterOpacity();
await testWrongCaFails();
await testReconnectProducesFreshExporter();
await testWrongHostnameFails();
console.log('Gateway secure transport tests passed');
