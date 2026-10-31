#!/usr/bin/env node
import './bootstrap.js';

// Package installation, runtime startup, and explicit Skill commands own full
// reconciliation. Help, status, plugin listing and other read commands never
// create or update an agent home. Scripts-disabled installs get an explicit
// `palace skill install` remediation from the Palace metadata-only probe.
const requested=process.argv[2],nested=process.argv[3];
const startsRuntime=!process.argv.some(arg=>arg==='--help'||arg==='-h')&&(['start','restart','server'].includes(requested??'')||(['device','remote'].includes(requested??'')&&['start','restart'].includes(nested??'')));
if(startsRuntime){
  try { const { reconcilePalaceSkill } = await import('./plugins/palace/skill-manager.js'); await reconcilePalaceSkill({nonBlocking:true,repair:true}); }
  catch (error) { if (process.env.DEBUG_MODE === 'true') process.stderr.write('[palace-skill] '+String((error as Error).message??error)+'\n'); }
}

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
