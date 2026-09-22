import path from 'path';
import os from 'os';

// MCP Device owns one canonical per-user state/config root.
export const USER_HOME = os.homedir();
export const CONFIG_DIR = path.resolve(
  process.env.MCP_DEVICE_CONFIG_DIR || path.join(USER_HOME, '.mcp-device')
);

// Paths relative to the config directory.
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const TOOL_CALL_FILE = path.join(CONFIG_DIR, 'logs', 'tool-calls.log');
export const TOOL_CALL_FILE_MAX_SIZE = 1024 * 1024 * 10; // 10 MB

export const DEFAULT_COMMAND_TIMEOUT = 1000; // milliseconds
