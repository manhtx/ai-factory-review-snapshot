import path from 'node:path';
import { lstatSync, realpathSync, statSync } from 'node:fs';

/** Named Codex tool policy; never combine with legacy --sandbox overrides.
 * This is not trusted provider authentication or controller enrollment. */
export function codexWorkerPermissionArgs(controlRoot: string, workspace: string, mode: string, writablePaths: string[] = []): string[] {
  if (!['read-only', 'workspace-write'].includes(mode)) throw new Error('Unsupported factory Codex permission mode');
  const control = realpathSync(controlRoot), assigned = realpathSync(workspace);
  if (!statSync(control).isDirectory() || !statSync(assigned).isDirectory()) throw new Error('Permission roots must be directories');
  const relative = path.relative(assigned, control);
  if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error('Worker workspace must not contain the control root');
  const filesystem: Record<string, string> = { ':root': 'deny', ':minimal': 'read', ':tmpdir': 'deny', ':slash_tmp': 'deny', [control]: 'deny', [assigned]: mode === 'read-only' ? 'read' : 'write' };
  if (process.platform === 'darwin') filesystem['/System/Library/OpenSSL'] = 'read';
  const dependencies = path.join(control, 'node_modules');
  try {
    if (lstatSync(dependencies).isSymbolicLink()) throw new Error('Control dependency root must not be an alias');
    const canonical = realpathSync(dependencies);
    if (!statSync(canonical).isDirectory() || canonical === control || canonical === assigned) throw new Error('Unsafe dependency read root');
    filesystem[canonical] = 'read';
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const value of writablePaths) {
    const canonical = realpathSync(value), inside = path.relative(assigned, canonical);
    if (!inside || inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) throw new Error('Writable permission path must stay inside workspace');
    filesystem[canonical] = 'write';
  }
  const key = 'factory-worker';
  const scoped = `":workspace_roots" = { "." = ${JSON.stringify(mode === 'read-only' ? 'read' : 'write')} }`;
  const table = [...Object.entries(filesystem).map(([name, access]) => `${JSON.stringify(name)} = ${JSON.stringify(access)}`), scoped].join(', ');
  return ['-c', `default_permissions=${JSON.stringify(key)}`, '-c', `permissions.${key}.extends=":workspace"`, '-c', `permissions.${key}.filesystem={ ${table} }`, '-c', `permissions.${key}.network.enabled=false`, '-c', 'agents.enabled=false'];
}

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
