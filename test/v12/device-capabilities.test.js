import assert from 'node:assert/strict';
import test from 'node:test';
import { GatewayDeviceChannel } from '../../dist/device/gateway-channel.js';
import { gatewayCapabilities } from '../../dist/device/gateway-tool-adapter.js';

function fixture() {
    const sent = [];
    let capabilities = [...gatewayCapabilities(), 'knowledge.search', 'knowledge.read'];
    const channel = new GatewayDeviceChannel({
        gatewayUrl: 'https://not-contacted.invalid',
        identity: { loadOrCreate: async () => ({ deviceId: 'test-owned-device', enrolled: true }), markEnrolled: async () => {} },
        adapter: { call: async () => ({ content: [] }) },
        capabilities: () => capabilities
    });
    channel.socket = { readyState: 1, send: text => sent.push(JSON.parse(text)) };
    return { channel, sent, setCapabilities: value => { capabilities = value; } };
}

test('capability lifecycle uses existing authenticated epoch-bound frame and avoids unchanged fanout', async () => {
    const f = fixture();
    assert.equal(f.channel.updateCapabilities(), false, 'No capability update before authentication');
    assert.equal(f.sent.length, 0);
    await f.channel.sendHello();
    assert(f.sent[0].payload.capabilities.includes('knowledge.search'));
    assert.equal(f.sent[0].type, 'auth_hello');

    // Same authenticated connection established by the existing proof protocol.
    f.channel.authenticatedDeviceId = 'test-owned-device';
    f.channel.connectionEpoch = 7;
    assert.equal(f.channel.updateCapabilities(), false, 'Unchanged hello metadata does not require a second frame');
    f.setCapabilities(gatewayCapabilities());
    assert.equal(f.channel.updateCapabilities(), true);
    const update = f.sent.at(-1);
    assert.equal(update.type, 'capability_sync');
    assert.equal(update.device_id, 'test-owned-device');
    assert.equal(update.connection_epoch, 7);
    assert.equal(update.protocol_version, 1);
    assert.deepEqual(update.payload.capabilities, gatewayCapabilities());
    assert.equal(f.channel.updateCapabilities(), false);
    assert.equal(f.sent.length, 2);
    assert(!JSON.stringify(update).includes('private_key'));
});

test('change while disconnected is advertised after reconnect, failed send does not lose the update', () => {
    const f = fixture();
    f.channel.authenticatedDeviceId = 'test-owned-device';
    f.channel.connectionEpoch = 8;
    f.channel.socket.readyState = 3;
    assert.equal(f.channel.updateCapabilities(), false);
    f.setCapabilities([...gatewayCapabilities(), 'example.echo']);
    f.channel.socket.readyState = 1;
    f.channel.socket.send = () => { throw new Error('transport closing'); };
    assert.equal(f.channel.updateCapabilities(), false);
    f.channel.socket.send = text => f.sent.push(JSON.parse(text));
    assert.equal(f.channel.updateCapabilities(), true);
    assert(f.sent.at(-1).payload.capabilities.includes('example.echo'));
    assert.equal(f.sent.at(-1).connection_epoch, 8);
});
