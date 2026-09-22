import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { captureRemote } from '../utils/capture.js';
import { deviceStatePaths } from './device-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface McpConfig {
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
}

export class LocalExecutionEngine {
    private mcpClient: Client | null = null;
    private mcpTransport: StdioClientTransport | null = null;
    private isReady = false;
    private runtimeReason: string | null = 'LOCAL_EXECUTION_ENGINE_UNAVAILABLE';
    private runtimeGeneration: string | null = null;

    async initialize() {
        console.debug('[DEBUG] LocalExecutionEngine.initialize() called');
        this.isReady = false;
        this.runtimeReason = 'LOCAL_EXECUTION_ENGINE_UNAVAILABLE';
        this.runtimeGeneration = null;
        try {
            const config = await this.resolveMcpConfig();
            if (!config) throw new Error('Bundled local execution engine is unavailable. Reinstall MCP Device.');
            this.mcpTransport = new StdioClientTransport({
                ...config,
                env: {
                    ...getDefaultEnvironment(),
                    ...config.env,
                    MCP_DEVICE_REMOTE: 'true'
                }
            });
            this.mcpClient = new Client(
                { name: 'mcp-device-local-engine', version: '1.0.0' },
                { capabilities: {} }
            );
            await this.mcpClient.connect(this.mcpTransport);
            this.runtimeGeneration = randomUUID();
            this.isReady = true;
            this.runtimeReason = null;
            console.log(' - Local execution engine ready');
        } catch (error) {
            console.error(' - Failed to start local execution engine:', error);
            await captureRemote('local_engine_init_failed', { error });
            try { await this.mcpClient?.close(); } catch {}
            try { await this.mcpTransport?.close(); } catch {}
            this.mcpClient = null;
            this.mcpTransport = null;
            this.isReady = false;
            this.runtimeReason = 'LOCAL_EXECUTION_ENGINE_UNAVAILABLE';
            this.runtimeGeneration = null;
        }
    }

    async resolveMcpConfig(): Promise<McpConfig | null> {
        const localEngine = path.resolve(__dirname, '../../dist/index.js');
        try {
            await fs.access(localEngine);
        } catch {
            return null;
        }
        const runtimeDir = deviceStatePaths().runtime;
        await fs.mkdir(runtimeDir, { recursive: true, mode: 0o700 });
        return {
            command: process.execPath,
            args: [localEngine],
            cwd: runtimeDir
        };
    }

    getChildPid(): number | null {
        return this.mcpTransport?.pid ?? null;
    }

    getRuntimeState() {
        return {
            runtime_ready: this.isReady,
            runtime_reason: this.isReady ? null : this.runtimeReason,
            execution_runtime_generation: this.isReady ? this.runtimeGeneration : null
        };
    }

    assertReady(): void {
        if (this.isReady && this.mcpClient) return;
        const error: Error & { code?: string } = new Error('Local execution engine is unavailable.');
        error.code = 'DEVICE_NOT_READY';
        throw error;
    }

    async callClientTool(toolName: string, args: any, metadata?: any) {
        this.assertReady();
        try {
            return await this.mcpClient!.callTool({
                name: toolName,
                arguments: args,
                _meta: { remote: true, ...metadata || {} }
            } as any);
        } catch (error) {
            await captureRemote('local_engine_tool_call_failed', { error, toolName });
            throw error;
        }
    }

    async listClientTools() {
        if (!this.mcpClient) return { tools: [] };
        try {
            const mcpTools = await this.mcpClient.listTools();
            return { tools: mcpTools.tools || [] };
        } catch (error) {
            await captureRemote('local_engine_list_tools_failed', { error });
            return { tools: [] };
        }
    }

    async shutdown() {
        const closeWithTimeout = async (operation: () => Promise<void>, name: string, timeoutMs = 3000) => Promise.race([
            operation(),
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs))
        ]);

        if (this.mcpClient) {
            try { await closeWithTimeout(() => this.mcpClient!.close(), 'MCP client close'); }
            catch (error) { await captureRemote('local_engine_shutdown_error', { error, component: 'client' }); }
            this.mcpClient = null;
        }
        if (this.mcpTransport) {
            try { await closeWithTimeout(() => this.mcpTransport!.close(), 'MCP transport close'); }
            catch (error) { await captureRemote('local_engine_shutdown_error', { error, component: 'transport' }); }
            this.mcpTransport = null;
        }
        this.isReady = false;
        this.runtimeReason = 'LOCAL_EXECUTION_ENGINE_UNAVAILABLE';
        this.runtimeGeneration = null;
    }
}