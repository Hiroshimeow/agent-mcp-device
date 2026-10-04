import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { LocalExecutionEngine } from '../dist/device/execution-engine.js';

async function testRemoteStartupHasZeroChildren() {
    console.log('Testing remote startup generations, zero child spawns, and uninitialized shutdown...');
    const engine = new LocalExecutionEngine();
    const initialState = engine.getRuntimeState();
    const originalSpawn = childProcess.spawn;
    let spawnCount = 0;
    childProcess.spawn = () => {
        spawnCount++;
        throw new Error('Remote startup must not spawn a child');
    };
    syncBuiltinESMExports();
    try {
        await engine.shutdown();
        await engine.shutdown();
        assert.equal(engine.getChildPid(), null);
        assert.deepEqual(engine.getRuntimeState(), initialState);
        assert.equal(engine.mcpClient, null);
        assert.equal(engine.mcpTransport, null);

        // Execute the compiled device class with gateway/persistence boundaries
        // stubbed so startup requires neither credentials nor a running gateway.
        const source = await readFile(new URL('../dist/device/device.js', import.meta.url), 'utf8');
        const classSource = source.split('// Start only when this module')[0]
            .replace(/^#!.*\n/, '')
            .replace(/^import[\s\S]*?;\s*$/gm, '')
            .replace('export class MCPDevice', 'class MCPDevice');
        const generations = [];
        class Store {
            async load() { return { gatewayUrl: 'https://gateway.test', connection: {}, allowedRoots: [] }; }
            async markOffline() {}
        }
        class Owner {
            async bootstrap() {}
            setDeviceId() {}
            async release() {}
        }
        class Channel {
            constructor(options) { this.options = options; }
            async start() { generations.push(this.options.runtimeState().execution_runtime_generation); }
            async stop() {}
        }
        const dependencies = {
            randomUUID, LocalExecutionEngine, GatewayDeviceChannel: Channel,
            GatewayDeviceConfigStore: Store, GatewayDeviceStatusStore: Store,
            GatewayDeviceIdentity: class { async loadOrCreate() { return { deviceId: 'test', enrolled: true }; } },
            GatewayToolAdapter: class {}, RuntimeOwner: Owner,
            acquireRuntimeOwner: async () => {}, bootstrapOfficialGatewayTrust: async () => {},
            assertDeviceStartupAllowedDuringUpdate: async () => {},
            createGatewayProxyAgent: () => ({}),
            reconcileDeviceUpdateAfterStart: async () => ({ action: 'none' }),
            captureRemote: async () => {}, VERSION: '1.0.10'
        };
        const MCPDevice = new Function(...Object.keys(dependencies), `${classSource}\nreturn MCPDevice;`)(...Object.values(dependencies));
        const originalRemote = process.env.MCP_DEVICE_REMOTE;
        const signals = ['SIGINT', 'SIGTERM'];
        const originalListeners = signals.map(signal => process.listeners(signal));
        try {
            const first = new MCPDevice();
            await first.start();
            await first.start();
            const second = new MCPDevice();
            await second.start();
            await first.shutdown();
            await second.shutdown();
        } finally {
            if (originalRemote === undefined) delete process.env.MCP_DEVICE_REMOTE;
            else process.env.MCP_DEVICE_REMOTE = originalRemote;
            signals.forEach((signal, index) => {
                for (const listener of process.listeners(signal)) {
                    if (!originalListeners[index].includes(listener)) process.removeListener(signal, listener);
                }
            });
        }
        assert.equal(generations.length, 3);
        for (const generation of generations) {
            assert.match(generation, /^direct-in-process:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        }
        assert.equal(new Set(generations).size, generations.length, 'Each start must advertise a distinct boot UUID');
        assert.equal(spawnCount, 0, 'Remote startup and shutdown must spawn zero children');
        console.log('PASS: distinct per-start UUIDs, zero child spawns, and repeated uninitialized shutdown');
    } finally {
        childProcess.spawn = originalSpawn;
        syncBuiltinESMExports();
    }
}

testRemoteStartupHasZeroChildren().catch(error => {
    console.error('FAIL:', error);
    process.exitCode = 1;
});
