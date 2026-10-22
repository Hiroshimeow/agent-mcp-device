import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import express from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { createMcpHandler, getOAuthProtectedResourceMetadataUrl, isInitializeRequest, isLegacyRequest, Server } from '@modelcontextprotocol/server';
import { getRuntimeProfile } from './runtime-profile.mjs';
import { applyToolRisk, assertToolAllowedForProfile, shouldExposeToolForProfile } from './tool-risk.mjs';
import { listRepoResources, listRepoResourceTemplates, readRepoResource } from './resources/index.mjs';
import { getRepoPrompt, listRepoPrompts } from './prompts/index.mjs';
import { loadSurfaceConfig } from './surface-config.mjs';
import { LOCAL_COLLISION_TOOL_NAMES, workspaceCatalogChanges } from './tool-surface-stability.mjs';
import { createSkillRegistry } from './skills/index.mjs';
import { registerSkillsExtension } from './skills/mcp-adapter.mjs';
import { createExternalToolBroker } from './external-tool-broker.mjs';
import { createExternalMcpManager } from './upstreams/manager.mjs';
import { normalizeExternalMcpConfig } from './upstreams/config.mjs';
import { isExternalResourceUri } from './upstreams/resource-uri.mjs';
import { FILESYSTEM_TOOL_DEFINITIONS, filesystemToolMeta, listProcessTools, shellExecuteToolMeta } from './device-execution-tool-definitions.mjs';
import { callCustomTool, isLocalCustomTool, listCustomTools } from './custom-tools/index.mjs';
import {
  AUTH_SUPPORTED_SCOPES,
  AccountAuthProvider,
  SQLiteAuthState,
  installAuthorizationGateRoutes,
  isStaticBearerAuthorization,
  shouldCreateTransportForRequest,
  shouldUseStatefulSessionTransport
} from './auth-session.mjs';
import { createOAuthAuthorizationServerRouter } from './oauth-authorization-server.mjs';
import { buildToolMetric, createToolMetricsRecorder } from './tool-metrics.mjs';
import { createRemoteProcessSessionRegistry } from './remote-process-sessions.mjs';
import { normalizeRemoteFilesystemResult } from './remote-tool-result.mjs';
import { createDeviceBroker } from './device-broker.mjs';
import { createDeviceReleaseProvider } from './device-release.mjs';
import { loadDeviceInnerTlsConfig } from './device-secure-transport.mjs';
import { listDevicesToolDefinition, paginateDeviceInventory } from './device-inventory.mjs';
import { installDevicePairingRoutes } from './device-pairing-http.mjs';
import { createDevicePairingStore } from './device-pairing-store.mjs';
import { createDeviceStore } from './device-store.mjs';
import { createDeviceUsageStore } from './device-usage.mjs';
import { callerAuditId, createDeviceAccessPolicy } from './device-access-policy.mjs';
import { createDeviceAuditRecorder } from './device-audit.mjs';
import { createAccountStore } from './account-store.mjs';
import { installAccountRoutes } from './account-http.mjs';
import { installDashboardRoutes } from './dashboard-http.mjs';
import { installOperatorDashboardRoutes } from './operator-dashboard-http.mjs';
import { createEmbeddedDeviceController } from './embedded-device.mjs';
import { findUnifiedMcpConfigPath } from './projects/trusted-roots-projects.mjs';
import {
  classifyWorkspaceChange,
  createWorkspaceRegistry
} from './workspace-registry.mjs';

export function resolveServerConfigPath({ configPath, assetRoot, packageRoot, env = {} }) {
  return path.resolve(configPath || findUnifiedMcpConfigPath(env, packageRoot) || path.join(assetRoot, 'config', 'mcp-servers.toml'));
}

/**
 * One account/control plane plus one mandatory shared Device Core.
 * All operational paths and environment are explicit; importing this module has no startup side effects.
 */
export async function startServerRuntime(options = {}) {
const env = { ...(options.env || {}) };
const core = options.core;
const identity = options.identity;
if (!core || typeof core.invoke !== 'function' || !Array.isArray(core.capabilities)) {
  throw new Error('Server mode requires an embedded shared Device Core.');
}
if (!identity || typeof identity.loadOrCreate !== 'function' || typeof identity.signChallenge !== 'function') {
  throw new Error('Server mode requires the normal Device identity and proof signer.');
}
if (!options.stateRoot) throw new Error('Server stateRoot must be explicit.');
const startupCleanups = [];
let resourcesClosed = false;
let coreClosed = false;
async function closeOwnedCore() {
  if (options.closeCore === false || coreClosed) return;
  await core.close();
  coreClosed = true;
}
try {
const assetRoot = path.resolve(options.assetRoot || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const packageRoot = path.resolve(options.packageRoot || path.join(assetRoot, '..'));
const validatorProvider = new AjvJsonSchemaValidator();
const contextDefinitions = options.contextTools ?? (await import(pathToFileURL(path.join(packageRoot, 'dist', 'context', 'tool-contract.js')).href)).buildContextCatalog();
const contextTools = new Map(contextDefinitions.map(definition => {
  const inputSchema = definition.name === 'local_wiki'
    ? { ...definition.inputSchema, properties: { ...definition.inputSchema.properties, device_id: { type: 'string', minLength: 1 } }, required: [...(definition.inputSchema.required || []), 'device_id'] }
    : definition.inputSchema;
  const tool = { name: definition.name, description: definition.description, inputSchema, annotations: definition.annotations };
  return [tool.name, { tool, validate: validatorProvider.getValidator(inputSchema) }];
}));
const extraTools = new Map();
for (const extension of options.extraTools || []) {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(String(extension.name || '')) || typeof extension.handler !== 'function') {
    throw new Error('Extension tools require a valid name, schema and handler.');
  }
  if (LOCAL_COLLISION_TOOL_NAMES.has(extension.name) || contextTools.has(extension.name) || extraTools.has(extension.name)) {
    throw new Error('Duplicate platform tool: ' + extension.name);
  }
  const { handler, ...tool } = extension;
  extraTools.set(tool.name, { tool, handler, validate: validatorProvider.getValidator(tool.inputSchema || { type: 'object' }) });
}

const gatewayPackageVersion = (() => {
  try { return String(JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))?.version || 'unknown'); }
  catch { return 'unknown'; }
})();
const gatewayBuildSha = String(env.MCP_GATEWAY_BUILD_SHA || '').trim() || (() => {
  try { return String(execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: packageRoot, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })).trim(); }
  catch { return ''; }
})();
const gatewayServerVersion = String(env.MCP_GATEWAY_SERVER_VERSION || '').trim() || [gatewayPackageVersion, gatewayBuildSha].filter(Boolean).join(' · ');
const releaseLookupEnabled = !['0', 'false', 'no', 'off'].includes(String(env.MCP_DEVICE_RELEASE_LOOKUP ?? 'true').trim().toLowerCase());
const deviceReleaseProvider = options.deviceReleaseProvider || createDeviceReleaseProvider({
  fallbackVersion: env.MCP_DEVICE_LATEST_VERSION || null,
  enabled: releaseLookupEnabled
});
const runtimeDirectory = path.resolve(options.stateRoot);
const repoRoot = options.repoRoot || packageRoot;
const gatewayPort = Number(options.port ?? 8104);
if (!Number.isInteger(gatewayPort) || gatewayPort < 1 || gatewayPort > 65535) throw new Error('Invalid server port.');
const gatewayHost = String(options.host || '127.0.0.1').trim();
const advertisedHost = String(env.MCP_ADVERTISE_HOST || '').trim() || (gatewayHost === '0.0.0.0' ? '127.0.0.1' : gatewayHost);
const advertisedUrl = String(options.publicUrl || env.MCP_ADVERTISE_URL || '').trim();
const allowHttpLan = options.allowHttpLan === true;
if (allowHttpLan) {
  const explicitUrl = normalizeBaseUrl(advertisedUrl);
  if (!explicitUrl || new URL(explicitUrl).protocol !== 'http:') {
    throw new Error('allowHttpLan requires an explicit http:// publicUrl.');
  }
}
const fallbackBaseUrl = `http://${advertisedHost}:${gatewayPort}`;
// The operator dashboard is mounted on this same authenticated application.
const staticBearerToken = env.MCP_BEARER_TOKEN;
const runtimeProfile = getRuntimeProfile(env);
const useStatefulMcpSessions = shouldUseStatefulSessionTransport(env.MCP_STATEFUL_SESSIONS);
const enableFilesystem = String(env.ENABLE_FILESYSTEM || 'true').toLowerCase() === 'true';
const enableShell = String(env.ENABLE_SHELL || 'true').toLowerCase() === 'true';
const debugAuth = envFlag(env.MCP_DEBUG_AUTH, false);
const slowToolThresholdMs = normalizeDurationMs(env.MCP_SLOW_TOOL_MS, 5000);
const toolMetrics = createToolMetricsRecorder({
  metricsPath: path.resolve(env.MCP_METRICS_PATH || path.join(runtimeDirectory, 'mcp-calls.ndjson')),
  enabled: envFlag(env.MCP_METRICS_ENABLED, false)
});
startupCleanups.push(() => toolMetrics.close());
const FILESYSTEM_TOOL_NAMES = new Set(['read_text_file', 'write_file', 'edit_file']);
const PROCESS_TOOL_NAMES = new Set(['start_process', 'read_process_output', 'interact_with_process', 'terminate_process']);
const activeProxyServers = new Set();

if (!repoRoot) throw new Error('REPO_ROOT is required');
if (!enableFilesystem && !enableShell) throw new Error('At least one execution tool family must be enabled');

function envFlag(value, defaultValue = false) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return defaultValue;
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
  return defaultValue;
}

function normalizeDurationMs(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

const configPath = resolveServerConfigPath({ configPath: options.configPath, assetRoot, packageRoot, env });
if (!configPath) throw new Error('config/mcp-servers.toml is required');
const workspaceRegistry = createWorkspaceRegistry({
  configPath,
  repoRoot: packageRoot,
  env: env
});
startupCleanups.push(() => workspaceRegistry.close());

function workspaceSnapshot() {
  return workspaceRegistry.snapshot();
}

function currentSurfaceConfig(snapshot = workspaceSnapshot()) {
  return loadSurfaceConfig(snapshot.rawConfig, env);
}

const remoteProcessSessions = createRemoteProcessSessionRegistry();
const gatewayDbPath = path.join(runtimeDirectory, 'gateway.sqlite');
const accountStore = createAccountStore({ dbPath: gatewayDbPath });
startupCleanups.push(() => accountStore.close());
const deviceStore = createDeviceStore({ dbPath: gatewayDbPath });
startupCleanups.push(() => deviceStore.close());
const devicePairingStore = createDevicePairingStore({ dbPath: gatewayDbPath });
startupCleanups.push(() => devicePairingStore.close());
const deviceUsageStore = createDeviceUsageStore({ dbPath: gatewayDbPath });
startupCleanups.push(() => deviceUsageStore.close());
const deviceAudit = createDeviceAuditRecorder({
  auditPath: path.join(runtimeDirectory, 'device-audit.jsonl'),
  enabled: envFlag(env.MCP_DEVICE_AUDIT_ENABLED, false)
});
startupCleanups.push(() => deviceAudit.close());
const deviceBroker = createDeviceBroker({
  enrollmentToken: env.MCP_DEVICE_ENROLLMENT_TOKEN,
  deviceStore,
  pairingStore: devicePairingStore,
  usageStore: deviceUsageStore,
  auditRecorder: deviceAudit,
  onDeviceForgotten: ({ deviceId }) => remoteProcessSessions.removeByDevice(deviceId),
  innerTls: options.innerTls || loadDeviceInnerTlsConfig(env)
});
startupCleanups.push(() => deviceBroker.shutdown());
const deviceAccessPolicy = createDeviceAccessPolicy({
  raw: env.MCP_DEVICE_ACCESS_POLICY || '',
  profile: runtimeProfile.name
});

const skillRegistry = createSkillRegistry({ directory: options.skillRoot || path.join(assetRoot, 'scripts', 'skills') });

async function broadcastCatalogChanges(changes = {}) {
  const tasks = [];
  for (const server of activeProxyServers) {
    if (changes.toolsChanged) tasks.push(server.sendToolListChanged().catch(() => {}));
    if (changes.resourcesChanged) tasks.push(server.sendResourceListChanged().catch(() => {}));
    if (changes.promptsChanged) tasks.push(server.sendPromptListChanged().catch(() => {}));
  }
  await Promise.all(tasks);
}

function localToolNamesForCollisionCheck() {
  return [...LOCAL_COLLISION_TOOL_NAMES, ...contextTools.keys(), ...extraTools.keys()];
}

const externalMcpManager = await createExternalMcpManager({
  // Startup and hot reload must read the same explicit unified configuration.
  env: { ...env, MCP_UPSTREAM_CONFIG: configPath },
  repoRoot: packageRoot,
  localToolNames: localToolNamesForCollisionCheck(),
  localPromptNames: listRepoPrompts({ runtimeProfile }).map(prompt => prompt.name),
  onCatalogChanged: async changes => {
    await broadcastCatalogChanges(changes);
  }
});
startupCleanups.push(() => externalMcpManager.shutdown());
const externalToolBroker = createExternalToolBroker({
  getTools: () => externalMcpManager.getCachedTools(),
  invokeTool: (name, args) => externalMcpManager.callTool(name, args)
});

workspaceRegistry.subscribe(async (next, previous) => {
  const { rootsChanged, upstreamChanged } = classifyWorkspaceChange(next, previous);
  if (rootsChanged) {
    await broadcastCatalogChanges(workspaceCatalogChanges({ rootsChanged }, currentSurfaceConfig(next)));
  }
  if (upstreamChanged) {
    const nextExternalConfig = normalizeExternalMcpConfig(next.rawConfig, {
      configPath,
      repoRoot: packageRoot,
      env: env
    });
    try {
      await externalMcpManager.reconcile(nextExternalConfig);
    } catch (error) {
      console.error(`[external-mcp] reconcile failed; keeping committed topology: ${error.message}`);
    }
  }
});

function customToolContext(callerContext = {}) {
  const snapshot = workspaceSnapshot();
  return {
    resolvedRepoRoots: snapshot.roots,
    resolvedRepoRoot: snapshot.roots[0],
    projectRegistry: snapshot.projectRegistry,
    accountId: callerContext.accountId || null,
    listVisibleDevices: () => deviceAccessPolicy.filterDevices(
      deviceBroker.listDevices({ accountId: callerContext.accountId || null }),
      {
        callerSubject: callerContext.callerSubject || callerContext.callerCategory || 'anonymous',
        callerCategory: callerContext.callerCategory || 'anonymous'
      }
    ),
    callDeviceTool: async (tool, args = {}) => {
      const { deviceId, toolArguments } = requireDeviceId(args);
      return await callRemoteDevice({ context: callerContext, deviceId, tool, arguments: toolArguments });
    },
    externalToolBroker,
    skillRegistry,
    runtimeProfile,
    packageRoot,
    env: env
  };
}

async function listMergedTools() {
  const tools = [];
  if (enableFilesystem) {
    tools.push(...FILESYSTEM_TOOL_DEFINITIONS.map(filesystemToolMeta));
  }
  tools.push(...listCustomTools(customToolContext()));
  tools.push(applyToolRisk(listDevicesToolDefinition()));
  if (enableShell) {
    tools.push(shellExecuteToolMeta());
    tools.push(...listProcessTools());
  }
  tools.push(...[...contextTools.values()].map(entry => entry.tool));
  tools.push(...[...extraTools.values()].map(entry => entry.tool));
  tools.push(...await externalMcpManager.listAllToolsUnfiltered());
  return tools.filter(tool => shouldExposeToolForProfile(tool, runtimeProfile));
}

function persistSchemaSnapshot(tools) {
  const toolSchemaBytes = Buffer.byteLength(JSON.stringify({ tools }), 'utf8');
  const estimatedTokens = Math.ceil(toolSchemaBytes / 4);
  const estimationMethod = 'utf8_bytes_div_4_estimate';
  deviceUsageStore.setSchemaSnapshot({
    toolCount: tools.length,
    schemaBytes: toolSchemaBytes,
    estimatedTokens,
    estimationMethod
  });
  deviceBroker.setSchemaSnapshot({
    toolCount: tools.length,
    toolSchemaBytes,
    toolSchemaTokenEstimate: estimatedTokens,
    tokenEstimateMethod: estimationMethod
  });
  return { toolSchemaBytes, estimatedTokens, estimationMethod };
}

async function refreshDeviceSchemaSnapshot() {
  const tools = await listMergedTools();
  return persistSchemaSnapshot(tools);
}

function structuredToolText(value, { includeStructured = false } = {}) {
  const result = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
  return includeStructured ? { ...result, structuredContent: value } : result;
}

const SHELL_RESPONSE_BUDGET_BYTES = 128 * 1024;
const SHELL_TOOL_RESULT_BUDGET_BYTES = SHELL_RESPONSE_BUDGET_BYTES - (8 * 1024);

function boundedShellToolText(value) {
  const response = structuredToolText(value, { includeStructured: true });
  if (Buffer.byteLength(JSON.stringify(response)) <= SHELL_TOOL_RESULT_BUDGET_BYTES) return response;
  throw new Error(`shell_execute response exceeds ${SHELL_RESPONSE_BUDGET_BYTES} byte budget`);
}

function splitDeviceArguments(args = {}) {
  const { device_id: deviceId, ...toolArguments } = args;
  return { deviceId: String(deviceId || '').trim(), toolArguments };
}

function requireDeviceId(args = {}) {
  const routed = splitDeviceArguments(args);
  if (routed.deviceId) return routed;
  const error = new Error('DEVICE_ID_REQUIRED: device_id is required for execution tools.');
  error.code = 'DEVICE_ID_REQUIRED';
  throw error;
}

function metricDeviceId(toolName, args = {}, context = {}) {
  const explicit = String(args.device_id || '').trim();
  if (explicit) return explicit;
  if (!PROCESS_TOOL_NAMES.has(toolName) || toolName === 'start_process' || !args.session_id) return null;
  try {
    return remoteProcessSessions.resolve({ sessionId: args.session_id, ownerKey: context.callerKey || 'anonymous' }).deviceId;
  } catch {
    return null;
  }
}

function metricSkillName(toolName, args = {}) {
  if (toolName !== 'load_skill') return null;
  return String(args.name || '').trim() || null;
}

async function callRemoteDevice({
  context = {},
  deviceId,
  tool,
  arguments: args = {},
  timeoutMs,
  expectedConnectionEpoch,
  expectedExecutionRuntimeGeneration,
  includeDispatchContext = false
}) {
  const callerSubject = context.callerSubject || context.callerCategory || 'anonymous';
  const callerCategory = context.callerCategory || 'anonymous';
  const requestId = randomUUID();
  const startedAt = Date.now();
  let grant = null;
  try {
    grant = deviceAccessPolicy.authorize({
      callerSubject,
      callerCategory,
      deviceId,
      tool,
      arguments: args
    });
    const brokerResult = await deviceBroker.callDevice({
      requestId,
      accountId: context.accountId || null,
      deviceId,
      tool,
      arguments: args,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(expectedConnectionEpoch === undefined ? {} : { expectedConnectionEpoch }),
      ...(expectedExecutionRuntimeGeneration === undefined ? {} : { expectedExecutionRuntimeGeneration }),
      ...(includeDispatchContext ? { includeDispatchContext: true } : {})
    });
    const result = includeDispatchContext ? brokerResult?.result : brokerResult;
    const outputBytes = deviceAccessPolicy.assertOutput(grant, result);
    deviceAudit.record({
      requestId,
      callerId: callerAuditId(callerSubject),
      callerCategory,
      deviceId,
      tool,
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      inputBytes: grant.inputBytes,
      outputBytes
    });
    return includeDispatchContext
      ? { result, dispatchContext: brokerResult.dispatchContext }
      : result;
  } catch (error) {
    const inputBytes = grant?.inputBytes ?? Buffer.byteLength(JSON.stringify(args ?? {}), 'utf8');
    deviceAudit.record({
      requestId,
      callerId: callerAuditId(callerSubject),
      callerCategory,
      deviceId,
      tool,
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      inputBytes,
      errorCode: String(error?.code || 'REMOTE_DEVICE_ERROR').slice(0, 64)
    });
    throw error;
  }
}

async function routeToolCall(request, context = {}) {
  const { callerKey } = context;
  const toolName = request.params.name;
  assertToolAllowedForProfile(toolName, runtimeProfile);
  const extension = extraTools.get(toolName);
  if (extension) {
    if (!context.accountId) throw new Error('ACCOUNT_ID_REQUIRED: an authenticated account is required.');
    const args = request.params.arguments || {};
    const validation = extension.validate(args);
    if (!validation.valid) throw new Error('Invalid arguments for ' + toolName + ': ' + validation.errorMessage);
    const trustedContext = Object.freeze({
      ...context,
      sessionId: context.activitySessionId || context.callerKey,
      listDevices: () => deviceBroker.listDevices({ accountId: context.accountId }),
      callDevice: ({ deviceId, tool, arguments: toolArguments = {}, timeoutMs }) =>
        callRemoteDevice({ context, deviceId, tool, arguments: toolArguments, timeoutMs })
    });
    const result = await extension.handler(args, trustedContext);
    return result && Array.isArray(result.content) ? result : structuredToolText(result, { includeStructured: true });
  }
  const contextEntry = contextTools.get(toolName);
  if (contextEntry) {
    const args = request.params.arguments || {};
    const validation = contextEntry.validate(args);
    if (!validation.valid) throw new Error('Invalid arguments for ' + toolName + ': ' + validation.errorMessage);
    const { deviceId, toolArguments } = requireDeviceId(args);
    // Context's published schema owns device_id; preserve it for every scoped action.
    const forwarded = toolName === 'local_wiki' ? toolArguments : { ...toolArguments, device_id: deviceId };
    const result = await callRemoteDevice({ context, deviceId, tool: toolName, arguments: forwarded });
    return result && Array.isArray(result.content) ? result : structuredToolText(result, { includeStructured: true });
  }

  if (toolName === 'shell_execute' && enableShell) {
    const { deviceId, toolArguments } = requireDeviceId(request.params.arguments || {});
    const remoteTimeoutMs = Number(toolArguments.timeout_ms || 28000);
    if (!Number.isInteger(remoteTimeoutMs) || remoteTimeoutMs < 1 || remoteTimeoutMs > 28000) {
      throw new Error('Remote shell_execute timeout_ms must be between 1 and 28000; use start_process for longer commands.');
    }
    const result = await callRemoteDevice({
      context,
      deviceId,
      tool: 'shell_execute',
      arguments: { ...toolArguments, timeout_ms: remoteTimeoutMs },
      timeoutMs: remoteTimeoutMs + 2000
    });
    return boundedShellToolText(result);
  }

  if (toolName === 'list_devices') {
    const devices = deviceAccessPolicy.filterDevices(deviceBroker.listDevices({ accountId: context.accountId || null }), {
      callerSubject: context.callerSubject || context.callerCategory || 'anonymous',
      callerCategory: context.callerCategory || 'anonymous'
    });
    return structuredToolText({ ok: true, ...paginateDeviceInventory(devices, request.params.arguments || {}) }, { includeStructured: true });
  }

  if (PROCESS_TOOL_NAMES.has(toolName) && enableShell) {
    const args = request.params.arguments || {};
    const ownerKey = callerKey || 'anonymous';
    if (toolName === 'start_process') {
      const { deviceId, toolArguments } = requireDeviceId(args);
      const dispatch = await callRemoteDevice({
        context,
        deviceId,
        tool: 'start_process',
        arguments: toolArguments,
        timeoutMs: Math.min(Number(toolArguments.timeout_ms || 10000) + 2000, 30000),
        includeDispatchContext: true
      });
      const remote = dispatch.result;
      const remoteSessionId = remote?.sessionId ?? remote?.session_id;
      if (!remoteSessionId) throw new Error('Remote start_process did not return a session identifier.');
      const sessionId = remoteProcessSessions.register({
        ownerKey,
        deviceId: dispatch.dispatchContext.deviceId,
        connectionEpoch: dispatch.dispatchContext.connectionEpoch,
        executionRuntimeGeneration: dispatch.dispatchContext.executionRuntimeGeneration,
        remoteSessionId
      });
      return structuredToolText({ ...remote, sessionId, session_id: sessionId }, { includeStructured: true });
    }
    const remoteSession = remoteProcessSessions.resolve({ sessionId: args.session_id, ownerKey });
    const remoteArgs = { ...args, session_id: remoteSession.remoteSessionId };
    const remoteTimeoutMs = toolName === 'read_process_output'
      ? 12000
      : Math.min(Number(args.timeout_ms || 10000) + 2000, 30000);
    const remote = await callRemoteDevice({
      context,
      deviceId: remoteSession.deviceId,
      tool: toolName,
      arguments: remoteArgs,
      timeoutMs: remoteTimeoutMs,
      expectedConnectionEpoch: remoteSession.connectionEpoch,
      expectedExecutionRuntimeGeneration: remoteSession.executionRuntimeGeneration
    });
    if (toolName === 'terminate_process') {
      remoteProcessSessions.remove({ sessionId: args.session_id, ownerKey });
    } else {
      remoteProcessSessions.touch({ sessionId: args.session_id, ownerKey });
    }
    return structuredToolText({ ...remote, sessionId: args.session_id, session_id: args.session_id }, { includeStructured: true });
  }

  if (FILESYSTEM_TOOL_NAMES.has(toolName)) {
    const { deviceId, toolArguments } = requireDeviceId(request.params.arguments || {});
    const result = await callRemoteDevice({ context, deviceId, tool: toolName, arguments: toolArguments });
    return result && Array.isArray(result.content)
      ? normalizeRemoteFilesystemResult(result)
      : structuredToolText(result, { includeStructured: true });
  }

  if (isLocalCustomTool(toolName)) {
    return await callCustomTool(toolName, request.params.arguments || {}, customToolContext(context));
  }

  if (externalMcpManager.isEagerToolName(toolName)) {
    return await externalMcpManager.callTool(toolName, request.params.arguments || {}, runtimeProfile);
  }
  if (externalMcpManager.isExternalToolName(toolName)) {
    throw new Error(`External MCP tool ${toolName} is deferred; use external_tool_search and the appropriate external_tool_call_* lane.`);
  }

  throw new Error(`Unknown or disabled tool: ${toolName}`);
}

function metricBelongsToCurrentDeviceEnrollment(metric, startedAt) {
  const deviceId = String(metric?.deviceId || '').trim();
  return !deviceId || deviceStore.containsEnrollmentAt(deviceId, startedAt);
}

function recordToolUsage(metric, startedAt) {
  try {
    if (metricBelongsToCurrentDeviceEnrollment(metric, startedAt)) {
      deviceUsageStore.recordToolCall(metric);
    }
  } catch (error) {
    console.error(`[usage-store] tool event persist failed: ${error.message}`);
  }
  toolMetrics.record(metric);
}

async function routeObservedToolCall(request, context) {
  const toolName = request.params?.name || 'unknown';
  const args = request.params?.arguments || {};
  const deviceId = metricDeviceId(toolName, args, context);
  const skillName = metricSkillName(toolName, args);
  const startedAt = Date.now();
  console.log(`[tool-call:start] ${toolName}`);
  try {
    const result = await routeToolCall(request, context);
    const durationMs = Date.now() - startedAt;
    console.log(`[tool-call:finish] ${toolName} durationMs=${durationMs}`);
    if (durationMs > slowToolThresholdMs) console.log(`[tool-call:slow] ${toolName} durationMs=${durationMs}`);
    const metric = buildToolMetric({
      toolName,
      args,
      result,
      durationMs,
      callerCategory: context?.callerCategory,
      accountId: context?.accountId,
      activitySessionId: context?.activitySessionId,
      deviceId,
      skillName,
      upstream: externalMcpManager.isExternalToolName(toolName) ? 'external-mcp' : null
    });
    recordToolUsage(metric, startedAt);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.log(`[tool-call:error] ${toolName} durationMs=${durationMs}`);
    const metric = buildToolMetric({
      toolName,
      args,
      durationMs,
      callerCategory: context?.callerCategory,
      accountId: context?.accountId,
      activitySessionId: context?.activitySessionId,
      deviceId,
      skillName,
      upstream: externalMcpManager.isExternalToolName(toolName) ? 'external-mcp' : null,
      error
    });
    recordToolUsage(metric, startedAt);
    throw error;
  }
}

function currentResourceContext(callerContext = {}) {
  const snapshot = workspaceSnapshot();
  return {
    resolvedRepoRoots: snapshot.roots,
    resolvedRepoRoot: snapshot.roots[0],
    projectRegistry: snapshot.projectRegistry,
    surfaceConfig: currentSurfaceConfig(snapshot),
    accountId: callerContext.accountId || null,
    listVisibleDevices: () => deviceAccessPolicy.filterDevices(
      deviceBroker.listDevices({ accountId: callerContext.accountId || null }),
      {
        callerSubject: callerContext.callerSubject || callerContext.callerCategory || 'anonymous',
        callerCategory: callerContext.callerCategory || 'anonymous'
      }
    ),
    callDeviceTool: async (tool, args = {}) => {
      const { deviceId, toolArguments } = requireDeviceId(args);
      return await callRemoteDevice({ context: callerContext, deviceId, tool, arguments: toolArguments });
    },
    packageRoot,
    env: env,
    skillRegistry,
    listTools: listMergedTools
  };
}

function createProxyServer({ era = 'legacy', accountId, activitySessionId, callerKey, callerCategory, callerSubject }) {
  const metadata = workspaceSnapshot().server;
  const server = new Server(
    {
      name: metadata.name,
      title: metadata.title,
      version: gatewayPackageVersion,
      description: metadata.description
    },
    {
      instructions: [metadata.instructions, 'Native Skills clients use the MCP Skills extension. Other clients may discover and load reusable skills with skill_catalog and load_skill.'].filter(Boolean).join(' '),
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: true }
      }
    }
  );

  server.setRequestHandler('tools/list', async () => {
    const tools = await listMergedTools();
    const { toolSchemaBytes, estimatedTokens, estimationMethod } = persistSchemaSnapshot(tools);
    deviceUsageStore.recordCatalogList({
      accountId,
      activitySessionId,
      toolCount: tools.length,
      schemaBytes: toolSchemaBytes,
      estimatedTokens,
      estimationMethod
    });
    return { tools };
  });
  server.setRequestHandler('tools/call', request => routeObservedToolCall(request, { accountId, activitySessionId, callerKey, callerCategory, callerSubject }));
  const callerContext = { accountId, activitySessionId, callerKey, callerCategory, callerSubject };
  server.setRequestHandler('resources/list', async () => {
    const context = currentResourceContext(callerContext);
    return { resources: [...listRepoResources(context), ...await externalMcpManager.listResources()] };
  });
  server.setRequestHandler('resources/templates/list', async () => {
    const context = currentResourceContext(callerContext);
    return { resourceTemplates: [...listRepoResourceTemplates(context), ...await externalMcpManager.listResourceTemplates()] };
  });
  server.setRequestHandler('resources/read', async request => {
    if (isExternalResourceUri(request.params.uri)) return await externalMcpManager.readResource(request.params.uri);
    return await readRepoResource(request.params.uri, currentResourceContext(callerContext));
  });
  server.setRequestHandler('prompts/list', async () => ({
    prompts: [...listRepoPrompts({ runtimeProfile }), ...await externalMcpManager.listPrompts()]
  }));
  server.setRequestHandler('prompts/get', async request => {
    if (externalMcpManager.isExternalPromptName(request.params.name)) {
      return await externalMcpManager.getPrompt(request.params.name, request.params.arguments || {});
    }
    return getRepoPrompt(request.params.name, request.params.arguments || {}, { runtimeProfile });
  });
  if (era === 'legacy') activeProxyServers.add(server);
  if (era === 'modern') registerSkillsExtension(server, skillRegistry);
  return server;
}

function summarizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return 'no-body';
  }

  const method = typeof body.method === 'string' ? body.method : 'unknown';
  const toolName = body.params && typeof body.params.name === 'string' ? body.params.name : '';
  return toolName ? `${method}:${toolName}` : method;
}

function setIncomingHeader(req, name, value) {
  req.headers[name.toLowerCase()] = value;
  if (!Array.isArray(req.rawHeaders)) {
    return;
  }

  const index = req.rawHeaders.findIndex(header => header.toLowerCase() === name.toLowerCase());
  if (index >= 0) {
    req.rawHeaders[index + 1] = value;
    return;
  }

  req.rawHeaders.push(name, value);
}

function fingerprint(value) {
  const text = String(value || '');
  return `${text.length}:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
}

function callerKeyFromParts({ accountId = '', oauthClientId = '', staticBearer = false, sessionId = '' } = {}) {
  const identity = accountId ? `account:${accountId}` : oauthClientId ? `oauth:${oauthClientId}` : staticBearer ? 'static-bearer' : 'anonymous';
  const digest = createHash('sha256')
    .update(sessionId ? `${identity}\nsession:${sessionId}` : identity)
    .digest('hex')
    .slice(0, 24);
  return `caller:${digest}`;
}

function callerKeyFromRequest(req) {
  return callerKeyFromParts({
    accountId: req.auth?.accountId || '',
    oauthClientId: req.auth?.clientId || '',
    staticBearer: isStaticBearerAuthorization(req.headers.authorization, staticBearerToken),
    sessionId: useStatefulMcpSessions ? req.headers['mcp-session-id'] || '' : ''
  });
}

function callerCategoryFromRequest(req) {
  if (isStaticBearerAuthorization(req.headers.authorization, staticBearerToken)) return 'static-bearer';
  if (req.auth?.clientId) return 'oauth';
  return 'anonymous';
}

function callerSubjectFromRequest(req) {
  if (isStaticBearerAuthorization(req.headers.authorization, staticBearerToken)) return 'static-bearer';
  if (req.auth?.accountId) return `account:${req.auth.accountId}`;
  return 'anonymous';
}

function getProvidedAuthorizationToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return '';
  }

  const header = authorizationHeader.trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return (match ? match[1] : header).trim();
}

await refreshDeviceSchemaSnapshot();
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
const accountHttp = installAccountRoutes(app, {
  accountStore,
  allowAdminLogin: true,
  needInvite: () => workspaceSnapshot().rawConfig?.auth?.need_invite !== false
});
installOperatorDashboardRoutes(app, {
  accountStore, usageStore: deviceUsageStore, deviceBroker,
  accountFromRequest: accountHttp.sessionAccountFromRequest
});
const oauthStateStore = new SQLiteAuthState(gatewayDbPath);
startupCleanups.push(() => oauthStateStore.close());
installDashboardRoutes(app, {
  accountFromRequest: accountHttp.accountFromRequest,
  usageStore: deviceUsageStore,
  deviceBroker,
  baseUrlFromRequest: requestBaseUrl,
  oauthClientLookup: clientId => oauthStateStore.getClient(clientId),
  listTools: listMergedTools,
  serverVersion: gatewayServerVersion,
  deviceReleaseProvider
});
const provider = new AccountAuthProvider({
  stateStore: oauthStateStore,
  accountStore,
  accountFromRequest: accountHttp.accountFromRequest,
  sessionBindingFromRequest: accountHttp.sessionBindingFromRequest,
  activityStore: deviceUsageStore
});
installAuthorizationGateRoutes(app, {
  provider,
  clearSession: accountHttp.clearSession,
  loginLocation: accountHttp.loginLocation
});
app.use((req, res, next) => {
  if (req.path !== '/mcp') {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, content-type, accept, mcp-session-id, mcp-protocol-version'
  );
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});
app.use((req, _res, next) => {
  if (req.path === '/mcp') {
    const sessionId = req.headers['mcp-session-id'];
    const authHeader = req.headers.authorization ? 'yes' : 'no';
    console.log(`[mcp-http] ${req.method} /mcp auth=${authHeader} session=${sessionId || 'none'}`);
  }
  next();
});

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function requestBaseUrl(req) {
  const explicitBaseUrl = normalizeBaseUrl(advertisedUrl);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.headers.host;
  if (!host) {
    return fallbackBaseUrl;
  }

  let hostname = String(host).toLowerCase();
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    hostname = hostname.split(':')[0];
  }
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const proto = forwardedProto || (isLocalHost ? req.protocol || (req.secure ? 'https' : 'http') : 'https');
  return normalizeBaseUrl(`${proto}://${host}`);
}

installDevicePairingRoutes(app, {
  pairingStore: devicePairingStore,
  accountFromRequest: accountHttp.accountFromRequest,
  baseUrlFromRequest: requestBaseUrl
});

function buildAuthUrls(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl) || fallbackBaseUrl;
  const issuerUrl = new URL(normalizedBaseUrl);
  const resourceServerUrl = new URL('/mcp', `${normalizedBaseUrl}/`);
  return { issuerUrl, resourceServerUrl };
}

const authRouters = new Map();

function getAuthRouterForBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl) || fallbackBaseUrl;
  const cached = authRouters.get(normalizedBaseUrl);
  if (cached) {
    return cached;
  }

  const { issuerUrl, resourceServerUrl } = buildAuthUrls(normalizedBaseUrl);
  const router = createOAuthAuthorizationServerRouter({
    provider,
    issuerUrl,
    resourceServerUrl,
    dangerouslyAllowInsecureIssuerUrl: allowHttpLan,
    authorizationOptions: {
      rateLimit: {
        validate: { creationStack: false }
      }
    },
    tokenOptions: {
      rateLimit: {
        validate: { creationStack: false }
      }
    },
    clientRegistrationOptions: {
      rateLimit: {
        validate: { creationStack: false }
      }
    },
    revocationOptions: {
      rateLimit: {
        validate: { creationStack: false }
      }
    },
    scopesSupported: AUTH_SUPPORTED_SCOPES,
    resourceName: 'Local Dev MCP'
  });
  authRouters.set(normalizedBaseUrl, router);
  return router;
}

app.use((req, res, next) => {
  getAuthRouterForBaseUrl(requestBaseUrl(req))(req, res, next);
});

const oauthAuthMiddlewares = new Map();

function getOAuthAuthMiddlewareForBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl) || fallbackBaseUrl;
  const cached = oauthAuthMiddlewares.get(normalizedBaseUrl);
  if (cached) {
    return cached;
  }

  const { resourceServerUrl } = buildAuthUrls(normalizedBaseUrl);
  const middleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl)
  });
  oauthAuthMiddlewares.set(normalizedBaseUrl, middleware);
  return middleware;
}

function mcpAuthMiddleware(req, res, next) {
  if (isStaticBearerAuthorization(req.headers.authorization, staticBearerToken)) {
    console.log('[auth] static-bearer accepted');
    setIncomingHeader(req, 'accept', 'application/json, text/event-stream');
    next();
    return;
  }

  if (debugAuth && req.headers.authorization && staticBearerToken) {
    const providedToken = getProvidedAuthorizationToken(req.headers.authorization);
    console.log(
      `[auth] static-bearer not matched; trying OAuth provided=${fingerprint(providedToken)} expected=${fingerprint(staticBearerToken)}`
    );
  }

  getOAuthAuthMiddlewareForBaseUrl(requestBaseUrl(req))(req, res, next);
}

function modernCallerContext(ctx = {}) {
  const authorization = ctx.requestInfo?.headers?.get?.('authorization') || '';
  const staticBearer = isStaticBearerAuthorization(authorization, staticBearerToken);
  const accountId = ctx.authInfo?.accountId || null;
  const oauthClientId = ctx.authInfo?.clientId || '';
  const callerCategory = staticBearer ? 'static-bearer' : oauthClientId ? 'oauth' : 'anonymous';
  const callerSubject = staticBearer ? 'static-bearer' : accountId ? `account:${accountId}` : 'anonymous';
  return {
    era: ctx.era,
    accountId,
    activitySessionId: ctx.authInfo?.activitySessionId || null,
    callerKey: callerKeyFromParts({ accountId: accountId || '', oauthClientId, staticBearer }),
    callerCategory,
    callerSubject
  };
}

const modernMcpHandler = createMcpHandler(
  ctx => createProxyServer(modernCallerContext(ctx)),
  {
    legacy: useStatefulMcpSessions ? 'reject' : 'stateless',
    responseMode: 'auto',
    onerror: error => console.error('[mcp-v2]', error)
  }
);
const modernNodeHandler = toNodeHandler(modernMcpHandler, {
  onerror: error => console.error('[mcp-v2-node]', error)
});

const transports = {};

async function createTransport(req) {
  let transport;
  const server = createProxyServer({
    accountId: req.auth?.accountId || null,
    activitySessionId: req.auth?.activitySessionId || null,
    callerKey: callerKeyFromRequest(req),
    callerCategory: callerCategoryFromRequest(req),
    callerSubject: callerSubjectFromRequest(req)
  });

  if (!useStatefulMcpSessions) {
    transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    transport.onclose = () => activeProxyServers.delete(server);
    await server.connect(transport);
    return transport;
  }

  transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: id => {
      transports[id] = transport;
    }
  });

  transport.onclose = () => {
    activeProxyServers.delete(server);
    const sid = transport.sessionId;
    if (sid && transports[sid]) delete transports[sid];
  };

  await server.connect(transport);
  return transport;
}

const mcpPostHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const requestSummary = summarizeRequestBody(req.body);
  console.log(`[mcp-post:start] ${requestSummary} session=${sessionId || 'none'}`);

  try {
    let transport;
    if (useStatefulMcpSessions && sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (
      !useStatefulMcpSessions ||
      shouldCreateTransportForRequest(sessionId, req.body, transports) ||
      (!sessionId && isInitializeRequest(req.body))
    ) {
      transport = await createTransport(req);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      console.log(`[mcp-post:reject] ${requestSummary} reason=invalid-session session=${sessionId || 'none'}`);
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
    console.log(`[mcp-post:finish] ${requestSummary} session=${sessionId || 'none'}`);
  } catch (error) {
    console.error('Error handling MCP POST request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
};

const mcpGetHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  console.log(`[mcp-get:start] session=${sessionId || 'none'}`);
  if (!sessionId || !transports[sessionId]) {
    console.log(`[mcp-get:reject] reason=invalid-session session=${sessionId || 'none'}`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  await transports[sessionId].handleRequest(req, res);
  console.log(`[mcp-get:finish] session=${sessionId || 'none'}`);
};

const mcpDeleteHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  console.log(`[mcp-delete:start] session=${sessionId || 'none'}`);
  if (!sessionId || !transports[sessionId]) {
    console.log(`[mcp-delete:reject] reason=invalid-session session=${sessionId || 'none'}`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  await transports[sessionId].handleRequest(req, res);
  console.log(`[mcp-delete:finish] session=${sessionId || 'none'}`);
};

app.get('/healthz', (_req, res) => {
  const skills = skillRegistry.health();
  res.json({
    ok: skills.status === 'healthy',
    enableFilesystem,
    enableShell,
    skills
  });
});

async function unifiedMcpHandler(req, res) {
  if (!useStatefulMcpSessions) {
    await modernNodeHandler(req, res, req.body);
    return;
  }

  const probe = await toWebRequest(req, req.body);
  if (!(await isLegacyRequest(probe))) {
    await modernNodeHandler(req, res, req.body);
    return;
  }

  if (req.method === 'POST') {
    await mcpPostHandler(req, res);
    return;
  }
  if (req.method === 'GET') {
    await mcpGetHandler(req, res);
    return;
  }
  if (req.method === 'DELETE') {
    await mcpDeleteHandler(req, res);
    return;
  }
  res.status(405).end();
}

app.all('/mcp', mcpAuthMiddleware, unifiedMcpHandler);

let localDevice = null;
let shutdownPromise = null;
const serverInstance = app.listen(gatewayPort, gatewayHost);

function shutdown() {
  // Keep the same failed result for every caller. A previous failed cleanup must
  // never look like a stopped runtime and allow its state lease to be released.
  shutdownPromise ??= (async () => {
    const failures = [];
    async function attempt(resource, cleanup) {
      try { await cleanup(); }
      catch (error) { failures.push({ resource, error }); }
    }

    await attempt('embedded-device', () => localDevice?.close());
    const serverClosed = new Promise(resolve => {
      try {
        serverInstance.close(error => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') failures.push({ resource: 'http-server', error });
          resolve();
        });
      } catch (error) {
        failures.push({ resource: 'http-server', error });
        resolve();
      }
    });
    await attempt('http-idle-connections', () => serverInstance.closeIdleConnections?.());
    await attempt('workspace-registry', () => workspaceRegistry.close());
    await attempt('tool-metrics', () => toolMetrics.close());
    await attempt('device-audit', () => deviceAudit.close());
    await attempt('device-broker', () => deviceBroker.shutdown());
    for (const transport of Object.values(transports)) {
      await attempt('mcp-transport', () => transport.close());
    }
    for (const proxy of activeProxyServers) {
      await attempt('mcp-proxy', async () => {
        await proxy.close();
        activeProxyServers.delete(proxy);
      });
    }
    await attempt('http-connections', () => serverInstance.closeAllConnections?.());
    await serverClosed;
    await attempt('oauth-state', () => oauthStateStore.close());
    await attempt('accounts', () => accountStore.close());
    await attempt('device-usage', () => deviceUsageStore.close());
    await attempt('device-pairings', () => devicePairingStore.close());
    await attempt('device-store', () => deviceStore.close());
    await attempt('upstreams', () => externalMcpManager.shutdown());
    await attempt('device-core', () => closeOwnedCore());
    resourcesClosed = failures.length === 0;
    if (failures.length === 1) throw failures[0].error;
    if (failures.length > 1) {
      const error = new AggregateError(failures.map(failure => failure.error),
        'Server cleanup failed for: ' + failures.map(failure => failure.resource).join(', '));
      error.code = 'SERVER_CLEANUP_FAILED';
      throw error;
    }
  })();
  return shutdownPromise;
}

try {
  await new Promise((resolve, reject) => {
    serverInstance.once('listening', resolve);
    serverInstance.once('error', reject);
  });
  deviceBroker.attach(serverInstance);
  localDevice = await createEmbeddedDeviceController({
    broker: deviceBroker, deviceStore, pairingStore: devicePairingStore,
    identity, core, deviceName: options.deviceName,
    baseUrl: normalizeBaseUrl(advertisedUrl) || fallbackBaseUrl,
    onPairing: options.onPairing,
    pollIntervalMs: options.pairingPollIntervalMs
  });
} catch (error) {
  try { await shutdown(); } catch { /* preserve the startup error */ }
  throw error;
}
return {
  app, server: serverInstance,
  baseUrl: normalizeBaseUrl(advertisedUrl) || fallbackBaseUrl,
  broker: deviceBroker, accounts: accountStore, pairings: devicePairingStore,
  localDevice, dbPath: gatewayDbPath,
  refreshCapabilities: () => localDevice.refreshCapabilities(),
  listTools: listMergedTools,
  close: shutdown
};
} catch (error) {
  if (!resourcesClosed) {
    for (const cleanup of startupCleanups.reverse()) {
      try { await cleanup(); } catch { /* preserve the startup error */ }
    }
    try { await closeOwnedCore(); } catch { /* preserve the startup error */ }
  }
  throw error;
}
}
