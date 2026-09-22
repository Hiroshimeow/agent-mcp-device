/**
 * Regression test for legacy pending welcome onboarding.
 *
 * A config created before welcome onboarding was enabled for Claude Code can
 * still contain pendingWelcomeOnboarding: true. When the server is later
 * initialized by Claude Code, that pending state must be consumed rather than
 * causing a retroactive welcome page when eligibility changes in a release.
 */

import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.js');
const TIMEOUT_MS = 30_000;

class ExistingConfigClaudeCodeMigrationTest {
  constructor() {
    this.home = mkdtempSync(path.join(os.tmpdir(), 'dc-welcome-legacy-'));
    this.configPath = path.join(this.home, '.claude-server-commander', 'config.json');
  }

  seedConfig(config, featureFlags) {
    mkdirSync(path.dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(config));
    if (featureFlags) {
      writeFileSync(
        path.join(path.dirname(this.configPath), 'feature-flags.json'),
        JSON.stringify({ version: 'test', flags: featureFlags })
      );
    }
  }

  async initializeAsClaudeCode() {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [DIST_INDEX],
      cwd: path.resolve(__dirname, '..'),
      stderr: 'pipe',
      env: {
        ...process.env,
        HOME: this.home,
        USERPROFILE: this.home,
        DESKTOP_COMMANDER_CONFIG_DIR: path.dirname(this.configPath),
        DESKTOP_COMMANDER_DISABLE_TELEMETRY: 'true',
        MCP_DEVICE_REMOTE: 'false',
        DC_FLAG_URL: 'http://127.0.0.1:9/',
      },
    });
    const client = new Client(
      { name: 'claude-code', version: 'test' },
      { capabilities: {} }
    );
    try {
      await client.connect(transport, { timeout: TIMEOUT_MS });
      // Initialization-side config writes can land just after the initialize
      // response on Windows. Preserve the original test's short grace period.
      await new Promise(resolve => setTimeout(resolve, 250));
    } finally {
      await client.close().catch(() => {});
    }
  }

  readConfig() {
    return JSON.parse(readFileSync(this.configPath, 'utf8'));
  }

  cleanup() {
    rmSync(this.home, { recursive: true, force: true });
  }
}

async function runScenario(name, config, featureFlags) {
  const test = new ExistingConfigClaudeCodeMigrationTest();
  try {
    test.seedConfig(config, featureFlags);
    await test.initializeAsClaudeCode();
    const resultConfig = test.readConfig();
    assert.equal(
      resultConfig.pendingWelcomeOnboarding,
      false,
      `${name} must consume pending welcome onboarding`
    );
    // The A/B control path also consumes pending but records sawOnboardingPage:
    // false. Skip paths must resolve before the A/B decision and never touch it.
    assert.equal(
      resultConfig.sawOnboardingPage,
      undefined,
      `${name} must skip before the A/B decision, not via control assignment`
    );
    console.log(`✓ ${name}`);
  } finally {
    test.cleanup();
  }
}

await runScenario(
  'Legacy Claude Code config does not retain pending welcome onboarding',
  { telemetryEnabled: false, pendingWelcomeOnboarding: true },
);
await runScenario(
  'Disabled welcome-page feature flag consumes pending onboarding',
  { telemetryEnabled: false, welcomeOnboardingEligible: true, pendingWelcomeOnboarding: true },
  { welcome_page_enabled: false },
);
await runScenario(
  'Configured Claude Code exclusion matches case-insensitively',
  { telemetryEnabled: false, welcomeOnboardingEligible: true, pendingWelcomeOnboarding: true },
  { welcome_page_enabled: true, welcome_page_excluded_clients: ['CLAUDE-CODE'] },
);
