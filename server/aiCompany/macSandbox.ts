import path from 'node:path';
import { realpathSync, statSync } from 'node:fs';

/** Optional macOS runner profile. Protects the control checkout outside the
 * assigned worktree; broad host reads and activation coverage remain open. */
export function macSandboxProfile(controlRoot: string, workspace: string): string {
  const directory = (value: string) => {
    const canonical = realpathSync(value);
    if (!statSync(canonical).isDirectory()) throw new Error('Sandbox roots must be existing directories');
    return canonical;
  };
  const control = directory(controlRoot);
  const assigned = directory(workspace);
  const relative = path.relative(assigned, control);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Sandbox workspace must not contain the control root');
  }
  const quote = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  // Keep the exception lexical: a dependency symlink cannot grant reads to an
  // unrelated protected directory through its canonical target.
  const dependencies = path.join(control, 'node_modules');
  return `(version 1)
(deny default)
(allow process-fork)
(allow process-exec*)
(allow signal (target self))
(allow sysctl-read)
(allow file-read*)
(deny file-read* (require-all (subpath ${quote(control)}) (require-not (subpath ${quote(assigned)})) (require-not (subpath ${quote(dependencies)}))))
(allow file-write* (subpath ${quote(assigned)}))
(deny file-write* (require-all (subpath ${quote(control)}) (require-not (subpath ${quote(assigned)}))))
`;
}
