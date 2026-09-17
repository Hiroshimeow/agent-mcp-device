#!/usr/bin/env node

// MCP Device publishes only the authenticated device runtime surface.
if (process.argv[2] !== 'remote') process.argv.splice(2, 0, 'remote');
const { runRemote } = await import('./npm-scripts/remote.js');
await runRemote();
