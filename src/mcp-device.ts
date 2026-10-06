#!/usr/bin/env node
import './bootstrap.js';

// Context commands are isolated local operations; do not initialize the remote runtime.
if (process.argv[2] === 'context') {
  const { runContextCli } = await import('./context/cli.js');
  const result = await runContextCli(process.argv.slice(3));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} else {
  if (process.argv[2] !== 'remote') process.argv.splice(2, 0, 'remote');
  const { runRemote } = await import('./npm-scripts/remote.js');
  await runRemote();
}
