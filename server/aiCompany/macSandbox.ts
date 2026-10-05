import path from 'node:path';

/** Conservative macOS profile for a runner: read the checkout and system
 * libraries, write only the assigned worktree, and deny network by default. */
export function macSandboxProfile(controlRoot: string, workspace: string): string {
  const quote = (value: string) => `"${path.resolve(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  return `(version 1)\n(deny default)\n(allow process-fork)\n(allow process-exec*)\n(allow signal)\n(allow sysctl-read)\n(allow file-read*)\n(allow file-write* (subpath ${quote(workspace)}))\n(allow file-write* (subpath "/tmp"))\n(allow file-write* (subpath "/private/tmp"))\n(allow file-read* (subpath ${quote(controlRoot)}))\n`;
}
