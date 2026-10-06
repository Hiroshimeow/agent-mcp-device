import { runContextCli } from '../../../dist/context/cli.js';
const [root, token, owner, repo] = process.argv.slice(2);
for (const key of ['MCP_DEVICE_SESSION','MCP_RUNNER','MCP_DEVICE_REMOTE','PI_SESSION_ID','PI_AGENT','CODEX_THREAD_ID','CLAUDECODE']) delete process.env[key];
Object.defineProperty(process.stdin, 'isTTY', { value: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true });
process.stderr.write = text => {
  if (String(text).includes('Admin token:')) setImmediate(() => process.stdin.push(token + '\n'));
  if (String(text).includes('Type PURGE')) setImmediate(() => process.stdin.push(`PURGE ${repo}\n`));
  return true;
};
process.send('ready');
process.once('message', async () => {
  const result = await runContextCli(['clean','--owner',owner,'--repo',repo,'--before','1'], { stateRoot: root });
  process.send(result.exitCode === 0 ? 'consumed' : JSON.parse(result.stderr).error.code);
  process.disconnect();
  process.stdin.destroy();
});
