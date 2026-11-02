import fs from 'node:fs/promises';
import path from 'node:path';

// shell_execute selects SHELL, then COMSPEC/cmd.exe on Windows, else /bin/sh.
// Supply native .cmd and POSIX shims instead of inferring shell from OS.
export async function writeCommandShims(bin, commands) {
  await fs.mkdir(bin, { recursive: true });
  const posixQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  for (const [name, target] of commands) {
    const executable = process.execPath.replaceAll('\\', '/');
    const module = target.replaceAll('\\', '/');
    const shim = path.join(bin, name);
    await fs.writeFile(shim, `#!/bin/sh\nexec ${posixQuote(executable)} ${posixQuote(module)} "$@"\n`);
    await fs.chmod(shim, 0o700);
    if (process.platform === 'win32') {
      await fs.writeFile(shim + '.cmd', `@echo off\r\n"${process.execPath}" "${target}" %*\r\n`);

    }
  }
}
