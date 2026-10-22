import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import childProcess from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
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
            .replace('export class MCPDevice', 'class MCPDevice')
            .replace("await import('../config.js')", 'await loadFixtureConfig()');
        const generations = [];
        const leaseAcquisitions = [], leaseReleases = [];
        const fixtureStateRoot = path.resolve(os.tmpdir(), 'mcp-device-nochild-state');
        class Store {
            async load() { return { gatewayUrl: 'https://gateway.test', connection: {}, allowedRoots: [] }; }
            async markOffline() {}
        }
        class Owner {
            paths = { root: fixtureStateRoot };
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
            randomUUID, path, LocalExecutionEngine, GatewayDeviceChannel: Channel,
            loadFixtureConfig: async () => ({ CONFIG_DIR: fixtureStateRoot }),
            acquireServerLease: async (root, options) => {
                assert.equal(options.allowDeviceOwnerPid, process.pid);
                leaseAcquisitions.push(root);
                return async () => { leaseReleases.push(root); };
            },
            GatewayDeviceConfigStore: Store, GatewayDeviceStatusStore: Store,
            GatewayDeviceIdentity: class { async loadOrCreate() { return { deviceId: 'test', enrolled: true }; } },
            createDeviceCore: async () => ({
                runtimeInstanceId: `direct-in-process:${randomUUID()}`,
                capabilities: [], invoke: async () => ({}), close: async () => {}
            }), RuntimeOwner: Owner,
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
        assert.deepEqual(leaseAcquisitions, [fixtureStateRoot, fixtureStateRoot, fixtureStateRoot], 'Owner and Core roots must be deduplicated per start');
        assert.equal(leaseReleases.length, leaseAcquisitions.length, 'Shutdown must release every acquired shared-state lease');
        for (const generation of generations) {
            assert.match(generation, /^direct-in-process:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        }
        assert.equal(new Set(generations).size, generations.length, 'Each start must advertise a distinct boot UUID');
        // Execute shutdown failures through the real compiled Device control flow.
        // Every external boundary, including process exit and update helpers, is inert.
        function shutdownFixture() {
            const state = { fail: true, closes: 0, leases: 0, owners: 0, handoffs: 0, helpers: 0, exits: [], channel: undefined };
            const listeners = new Map();
            const fixtureProcess = {
                env: {}, argv: [], platform: process.platform, pid: process.pid, exitCode: undefined,
                on: (signal, listener) => listeners.set(signal, listener),
                exit: code => { state.exits.push(code); }
            };
            const cleanupError = Object.assign(new Error('Fixture cleanup remains owned'), { code: 'PLUGIN_TERMINATION_FAILED' });
            const fixtureDependencies = {
                ...dependencies, os, process: fixtureProcess,
                RuntimeOwner: class extends Owner { async release() { state.owners++; } },
                acquireServerLease: async () => async () => { state.leases++; },
                GatewayDeviceChannel: class {
                    constructor(options) { state.channel = options; }
                    async start() {}
                    async stop() {}
                },
                createDeviceCore: async () => ({
                    runtimeInstanceId: `direct-in-process:${randomUUID()}`,
                    capabilities: [], invoke: async () => ({}),
                    close: async () => {
                        state.closes++;
                        await Promise.resolve();
                        if (state.fail) throw cleanupError;
                    }
                }),
                prepareDevicePackageUpdate: async () => ({ state: { requestId: 'fixture' } }),
                launchDeviceUpdateHelper: async () => { state.helpers++; },
                retireDeviceUpdateState: async () => {},
                signalDeviceUpdateHandoff: async () => { state.handoffs++; }
            };
            const FixtureDevice = new Function(...Object.keys(fixtureDependencies), `${classSource}\nreturn MCPDevice;`)(...Object.values(fixtureDependencies));
            return { device: new FixtureDevice(), state, listeners, process: fixtureProcess };
        }
        async function waitForFixture(predicate) {
            const deadline = Date.now() + 1000;
            while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
            assert.ok(predicate(), 'Fixture shutdown callback must complete within one second');
        }

        const update = shutdownFixture();
        await update.device.start();
        const prepared = await update.state.channel.onUpdateRequest('1.0.12', { requestId: 'fixture' });
        assert.equal(update.state.helpers, 1, 'Update helper may be prepared while still inert');
        await assert.rejects(prepared.handoff(), { code: 'PLUGIN_TERMINATION_FAILED' });
        assert.equal(update.state.handoffs, 0, 'Failed cleanup must never arm the update helper');
        assert.deepEqual(update.state.exits, [], 'Failed handoff must not exit the owner');
        assert.equal(update.state.leases, 0, 'Failed cleanup must retain the shared state lease');
        assert.equal(update.state.owners, 0, 'Failed cleanup must retain RuntimeOwner');
        const firstShutdown = update.device.shutdown();
        const concurrentShutdown = update.device.shutdown();
        assert.equal(concurrentShutdown, firstShutdown, 'Concurrent shutdown callers must share one cleanup outcome');
        const failures = await Promise.allSettled([firstShutdown, concurrentShutdown]);
        assert.ok(failures.every(result => result.status === 'rejected' && result.reason.code === 'PLUGIN_TERMINATION_FAILED'));
        assert.equal(update.state.closes, 2, 'A failed shutdown must retry once, shared by concurrent callers');
        assert.equal(update.state.leases, 0);
        assert.equal(update.state.owners, 0);
        update.state.fail = false;
        await update.device.shutdown();
        await update.device.shutdown();
        assert.equal(update.state.closes, 3, 'Successful cleanup is cached; failed cleanup is not');
        assert.equal(update.state.leases, 1);
        assert.equal(update.state.owners, 1);
        assert.equal(update.state.handoffs, 0);

        const signal = shutdownFixture();
        await signal.device.start();
        signal.listeners.get('SIGTERM')();
        await waitForFixture(() => signal.process.exitCode === 1);
        assert.deepEqual(signal.state.exits, [], 'Failed signal shutdown must retain the live owner instead of force-exiting');
        assert.equal(signal.state.leases, 0);
        assert.equal(signal.state.owners, 0);
        assert.equal(signal.state.handoffs, 0);
        signal.state.fail = false;
        signal.listeners.get('SIGTERM')();
        await waitForFixture(() => signal.state.exits.length > 0);
        assert.deepEqual(signal.state.exits, [0], 'A later signal may exit successfully only after cleanup succeeds');
        assert.equal(signal.state.closes, 2);
        assert.equal(signal.state.leases, 1);
        assert.equal(signal.state.owners, 1);

        assert.equal(spawnCount, 0, 'Remote startup and shutdown must spawn zero children');
        console.log('PASS: distinct per-start UUIDs, zero child spawns, repeated uninitialized shutdown, and cleanup ownership across update/signal failures');
    } finally {
        childProcess.spawn = originalSpawn;
        syncBuiltinESMExports();
    }
}

testRemoteStartupHasZeroChildren().catch(error => {
    console.error('FAIL:', error);
    process.exitCode = 1;
});
