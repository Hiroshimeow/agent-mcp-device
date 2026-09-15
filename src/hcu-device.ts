#!/usr/bin/env node

// HCU's published device surface is the remote execution agent, not the
// upstream Desktop Commander stdio server. Reuse the existing remote command
// dispatcher without duplicating its lifecycle logic.
if (process.argv[2] !== 'remote') process.argv.splice(2, 0, 'remote');
await import('./index.js');
