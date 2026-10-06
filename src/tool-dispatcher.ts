import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { ServerResult } from './types.js';
import * as handlers from './handlers/index.js';
import { getConfig, setConfigValue } from './tools/config.js';
import { getUsageStats } from './tools/usage.js';
import { getPrompts } from './tools/prompts.js';
import { trackToolCall } from './utils/trackTools.js';
import { usageTracker } from './utils/usageTracker.js';
import { toolHistory } from './utils/toolHistory.js';
import { observePublicInvocation, isCapturingInvocation } from './context/capture.js';
import { capture } from './utils/capture.js';
import {
    currentCallIsRemote,
    setCurrentCallIsRemote,
    setCurrentRemoteClient,
} from './server.js';

export interface DispatchToolOptions {
    isRemote?: boolean;
    clientInfo?: { name?: string; version?: string };
    origin?: string;
    metadata?: any;
}

export async function dispatchToolCall(
    name: string,
    args: any,
    options: DispatchToolOptions = {}
): Promise<ServerResult> {
    return observePublicInvocation({ tool: name, args }, () => executeToolCall(name, args, options));
}

async function executeToolCall(name: string, args: any, options: DispatchToolOptions): Promise<ServerResult> {
    const startTime = Date.now();
    let telemetryData: any = { tool_name: name };
    let result: ServerResult;
    let isError = false;

    try {
        const isRemoteCall = Boolean(options.isRemote);
        setCurrentCallIsRemote(isRemoteCall);
        if (isRemoteCall) {
            telemetryData.remote = String(options.isRemote);
            const remoteClient = options.clientInfo && (options.clientInfo.name || options.clientInfo.version)
                ? options.clientInfo
                : { name: 'remote-unknown', version: 'unknown' };
            setCurrentRemoteClient(remoteClient);
            telemetryData.client_name = remoteClient.name;
            telemetryData.client_version = remoteClient.version;
        } else {
            setCurrentRemoteClient(null);
        }

        if (name === 'set_config_value' && args && typeof args === 'object' && 'key' in args) {
            telemetryData.set_config_value_key_name = (args as any).key;
        }
        if (name === 'get_prompts' && args && typeof args === 'object') {
            const promptArgs = args as any;
            telemetryData.action = promptArgs.action;
            if (promptArgs.category) {
                telemetryData.category = promptArgs.category;
                telemetryData.has_category_filter = true;
            }
            if (promptArgs.promptId) {
                telemetryData.prompt_id = promptArgs.promptId;
            }
        }

        trackToolCall(name, args);

        switch (name) {
            case 'get_config':
                try {
                    result = await getConfig();
                } catch (error) {
                    capture('server_request_error', { message: `Error in get_config handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to get configuration' }],
                        isError: true,
                    };
                }
                break;
            case 'set_config_value':
                try {
                    result = await setConfigValue(args);
                } catch (error) {
                    capture('server_request_error', { message: `Error in set_config_value handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to set configuration value' }],
                        isError: true,
                    };
                }
                break;
            case 'get_usage_stats':
                try {
                    result = await getUsageStats();
                } catch (error) {
                    capture('server_request_error', { message: `Error in get_usage_stats handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to get usage statistics' }],
                        isError: true,
                    };
                }
                break;
            case 'get_prompts':
                try {
                    result = await getPrompts(args || {});
                    if (args && typeof args === 'object' && !result.isError) {
                        const action = (args as any).action;
                        try {
                            if (action === 'get_prompt' && (args as any).promptId) {
                                const { loadPromptsData } = await import('./tools/prompts.js');
                                const promptsData = await loadPromptsData();
                                const prompt = promptsData.prompts.find(p => p.id === (args as any).promptId);
                                if (prompt) {
                                    await capture('server_get_prompt', {
                                        prompt_id: prompt.id,
                                        prompt_title: prompt.title,
                                        category: prompt.categories[0] || 'uncategorized',
                                        author: prompt.author,
                                        verified: prompt.verified,
                                    });
                                }
                            }
                        } catch (error) {}
                    }
                    const onboardingState = await usageTracker.getOnboardingState();
                    if (onboardingState.attemptsShown > 0 && !onboardingState.promptsUsed) {
                        await usageTracker.markOnboardingPromptsUsed();
                    }
                } catch (error) {
                    capture('server_request_error', { message: `Error in get_prompts handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to retrieve prompts' }],
                        isError: true,
                    };
                }
                break;
            case 'get_recent_tool_calls':
                try {
                    result = await handlers.handleGetRecentToolCalls(args);
                } catch (error) {
                    capture('server_request_error', { message: `Error in get_recent_tool_calls handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to get tool call history' }],
                        isError: true,
                    };
                }
                break;
            case 'track_ui_event':
                try {
                    result = await handlers.handleTrackUiEvent(args);
                } catch (error) {
                    capture('server_request_error', { message: `Error in track_ui_event handler: ${error}` });
                    result = {
                        content: [{ type: 'text', text: 'Error: Failed to track UI event' }],
                        isError: true,
                    };
                }
                break;
            case 'start_process':
                result = await handlers.handleStartProcess(args);
                break;
            case 'read_process_output':
                result = await handlers.handleReadProcessOutput(args);
                break;
            case 'interact_with_process':
                result = await handlers.handleInteractWithProcess(args);
                break;
            case 'force_terminate':
                result = await handlers.handleForceTerminate(args);
                break;
            case 'list_sessions':
                result = await handlers.handleListSessions();
                break;
            case 'list_processes':
                result = await handlers.handleListProcesses();
                break;
            case 'kill_process':
                result = await handlers.handleKillProcess(args);
                break;
            case 'read_file':
                result = await handlers.handleReadFile(args);
                break;
            case 'read_multiple_files':
                result = await handlers.handleReadMultipleFiles(args);
                break;
            case 'write_file':
                result = await handlers.handleWriteFile(args);
                break;
            case 'write_pdf':
                result = await handlers.handleWritePdf(args);
                break;
            case 'create_directory':
                result = await handlers.handleCreateDirectory(args);
                break;
            case 'list_directory':
                result = await handlers.handleListDirectory(args);
                break;
            case 'move_file':
                result = await handlers.handleMoveFile(args);
                break;
            case 'start_search':
                result = await handlers.handleStartSearch(args);
                break;
            case 'get_more_search_results':
                result = await handlers.handleGetMoreSearchResults(args);
                break;
            case 'stop_search':
                result = await handlers.handleStopSearch(args);
                break;
            case 'list_searches':
                result = await handlers.handleListSearches();
                break;
            case 'get_file_info':
                result = await handlers.handleGetFileInfo(args);
                break;
            case 'edit_block':
                result = await handlers.handleEditBlock(args);
                break;
            default:
                capture('server_unknown_tool', { name });
                result = {
                    content: [{ type: 'text', text: `Error: Unknown tool: ${name}` }],
                    isError: true,
                };
        }

        const duration = Date.now() - startTime;
        isError = !!result.isError;
        const EXCLUDED_TOOLS = ['get_recent_tool_calls', 'track_ui_event'];

        if (!isCapturingInvocation() && !currentCallIsRemote && process.env.MCP_DEVICE_REMOTE !== 'true' && !EXCLUDED_TOOLS.includes(name)) {
            toolHistory.addCall(name, args, result, duration);
        }

        return result;
    } catch (error: any) {
        capture('server_unhandled_tool_error', { name, error: error?.message || String(error) });
        return {
            content: [{ type: 'text', text: `Error executing ${name}: ${error?.message || String(error)}` }],
            isError: true,
        };
    }
}
