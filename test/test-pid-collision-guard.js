import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { readFile } from 'node:fs/promises';
import { TerminalManager } from '../dist/terminal-manager.js';
import { observePublicInvocation } from '../dist/context/capture.js';

async function testPidCollisionGuard() {
    console.log('Testing PID collision cleanup and numeric/string session IDs...');
    const originalSpawn = childProcess.spawn;
    const originalError = console.error;
    const manager = new TerminalManager();
    const pid = 43210;
    const existingSession = { pid, process: { kill() { throw new Error('Must not kill existing session'); } } };
    manager.sessions.set(pid, existingSession);
    const errors = [];
    console.error = (...args) => errors.push(args);
    try {
        for (const killThrows of [false, true]) {
            const child = new EventEmitter();
            child.pid = pid;
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            let killCount = 0;
            child.kill = () => {
                killCount++;
                if (killThrows) throw new Error('simulated kill failure');
                return true;
            };
            childProcess.spawn = () => child;
            syncBuiltinESMExports();
            await assert.rejects(manager.executeCommand('collision-test', 10, true), {
                message: `PID collision detected: process ${pid} is already running under an active session.`
            });
            assert.equal(child.stdout.listenerCount('data'), 0, 'Collision check must precede stdout listeners');
            assert.equal(child.stderr.listenerCount('data'), 0, 'Collision check must precede stderr listeners');
            assert.equal(child.listenerCount('exit'), 0, 'Collision check must precede exit listeners');
            assert.equal(child.listenerCount('close'), 0, 'Rejected child must not finalize a session');
            assert.equal(killCount, 1, 'New conflicting child must be killed before rejecting');
            assert.equal(manager.sessions.get(pid), existingSession, 'Existing session must remain untouched');
        }
        assert.equal(errors.length, 1);
        assert.equal(errors[0][0], `Failed to kill conflicting child process ${pid}:`);
        assert.equal(errors[0][1].message, 'simulated kill failure');
    } finally {
        childProcess.spawn = originalSpawn;
        syncBuiltinESMExports();
        console.error = originalError;
    }
    console.log('PASS: colliding child killed; kill failure logged without replacing collision error');

    // Run the compiled adapter class with only its dispatch boundary replaced,
    // allowing exact assertions on the PID forwarded to each local tool.
    const source = await readFile(new URL('../dist/device/gateway-tool-adapter.js', import.meta.url), 'utf8');
    const classSource = source.slice(source.indexOf('export class GatewayToolAdapter'))
        .replace('export class GatewayToolAdapter', 'class GatewayToolAdapter');
    const calls = [];
    const Adapter = new Function('configuredGatewayRoots', 'validatePath', 'dispatchToolCall', 'assertSuccess', 'observePublicInvocation',
        `${classSource}\nreturn GatewayToolAdapter;`)(
        () => [], async value => value,
        async (tool, args) => { calls.push({ tool, args }); return { content: [] }; },
        value => value, observePublicInvocation
    );
    const adapter = new Adapter();
    for (const [tool, dispatchedTool] of [
        ['read_process_output', 'read_process_output'],
        ['interact_with_process', 'interact_with_process'],
        ['terminate_process', 'force_terminate']
    ]) {
        for (const session_id of [pid, String(pid), Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)]) {
            await adapter.call(tool, { session_id, input: 'test' });
            assert.equal(calls.at(-1).tool, dispatchedTool);
            assert.equal(calls.at(-1).args.pid, Number(session_id));
        }
        for (const session_id of [undefined, null, '', ' ', ' 12 ', '1e3', '0x10', '-1', '12.5', '0', '012', '12\n', 0, -1, 1.5, 'no-pid', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, String(Number.MAX_SAFE_INTEGER + 1), true, [pid], { toString: () => String(pid) }]) {
            const count = calls.length;
            await assert.rejects(adapter.call(tool, { session_id }), {
                message: `Invalid session_id provided for ${tool}: must be a positive integer`
            });
            assert.equal(calls.length, count, 'Invalid session IDs must never dispatch');
        }
    }
    console.log('PASS: all session tools accept numeric/string IDs and reject invalid IDs before dispatch');
}

testPidCollisionGuard().catch(error => {
    console.error('FAIL:', error);
    process.exitCode = 1;
});
