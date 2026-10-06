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
  // Metadata traversal is distinct from reading contents. Tools canonicalize
  // nested worktree paths by statting each exact parent; private siblings and
  // directory enumeration remain denied.
  const traversal = new Set([control]);
  let parent = path.dirname(assigned);
  while (parent.startsWith(`${control}${path.sep}`)) {
    traversal.add(parent);
    parent = path.dirname(parent);
  }
  const metadataExclusions = [...traversal].map(value => `(require-not (literal ${quote(value)}))`).join(' ');
  return `(version 1)
(deny default)
(allow process-fork)
(allow process-exec*)
(allow signal (target self))
(allow signal (target children))
(allow sysctl-read)
(allow file-read*)
(deny file-read-data (require-all (subpath ${quote(control)}) (require-not (subpath ${quote(assigned)})) (require-not (subpath ${quote(dependencies)}))))
(deny file-read-metadata (require-all (subpath ${quote(control)}) (require-not (subpath ${quote(assigned)})) (require-not (subpath ${quote(dependencies)})) ${metadataExclusions}))
(allow file-write* (subpath ${quote(assigned)}))
(deny file-write* (require-all (subpath ${quote(control)}) (require-not (subpath ${quote(assigned)}))))
`;
}
