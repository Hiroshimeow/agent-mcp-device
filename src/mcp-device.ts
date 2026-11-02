#!/usr/bin/env node
import './bootstrap.js';

// Context and P1 commands remain isolated local operations.
if (process.argv[2] === 'context') {
  const { runContextCli } = await import('./context/cli.js');
  const result = await runContextCli(process.argv.slice(3));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} else if (process.argv[2] === 'logs') {
  const { runLogPalaceCli } = await import('./log-palace/cli.js');
  const result = runLogPalaceCli(process.argv.slice(3));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} else if (['server', 'plugins', 'knowledge', 'admin', 'state', 'help', '--help', '-h'].includes(process.argv[2])) {
  const { runPlatformCli } = await import('./platform/cli.js');
  await runPlatformCli(['--help', '-h'].includes(process.argv[2]) ? 'help' : process.argv[2], process.argv.slice(3));
} else {
  if (process.argv[2] === 'device') process.argv[2] = 'remote';
  else if (process.argv[2] !== 'remote') process.argv.splice(2, 0, 'remote');
  const { runRemote } = await import('./npm-scripts/remote.js');
  await runRemote();
}
