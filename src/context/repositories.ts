import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export interface RepositoryResolution { root: string; identity: string; worktree: string; commonDir: string }
export type PathGuard = (path: string) => string | Promise<string>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Explicit trusted guard is mandatory; denial never falls back to a lexical path. */
export async function resolveRepository(cwd: unknown, guard: PathGuard): Promise<RepositoryResolution | null> {
  if (Array.isArray(cwd)) throw new Error('SCOPE_AMBIGUOUS');
  if (typeof cwd !== 'string' || !cwd) throw new Error('SCOPE_REQUIRED');
  if (!isAbsolute(cwd) || cwd.split(/[\\/]/).includes('..')) throw new Error('ACCESS_DENIED');
  const approved = await guard(cwd);
  let canonical: string;
  try { canonical = realpathSync(approved); if (!statSync(canonical).isDirectory()) throw new Error(); }
  catch { throw new Error('REPOSITORY_NOT_FOUND'); }
  // Guard the real target too if a symlink was resolved.
  if (resolve(canonical) !== resolve(approved)) await guard(canonical);
  const git = (...args: string[]) => execFileSync('git', ['-C', canonical, ...args], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined },
  }).trim();
  try {
    const root = realpathSync(git('rev-parse', '--show-toplevel'));
    const commonDir = realpathSync(resolve(canonical, git('rev-parse', '--git-common-dir')));
    await guard(root); await guard(commonDir);
    return { root, commonDir, identity: hash(commonDir), worktree: hash(root) };
  } catch (error) {
    // A confirmed non-repository is unscoped. Permission and subprocess failures are not.
    const failure = error as { stderr?: Buffer | string };
    if (String(failure.stderr ?? '').includes('not a git repository')) return null;
    throw new Error('ACCESS_DENIED');
  }
}
