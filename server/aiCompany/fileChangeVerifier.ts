import { createHash } from 'node:crypto';
import { existsSync, lstatSync, realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ChangedFileDiffRecord {
  file: string;
  before_hash?: string;
  after_hash: string;
  diff_hash: string;
  lines_added: number;
  lines_deleted: number;
}

export interface FileChangeVerificationOptions {
  workspace_root: string;
  allowed_paths?: string[];
  mutation_policy?: 'read_only' | 'isolated_workspace' | 'in_place';
  before_contents?: Record<string, string>; // baseline file contents for diff verification
}

export interface FileChangeVerificationResult {
  valid: boolean;
  errors: string[];
  diff_records: ChangedFileDiffRecord[];
}

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function verifyChangedFiles(
  changedFiles: string[],
  options: FileChangeVerificationOptions
): FileChangeVerificationResult {
  const errors: string[] = [];
  const diff_records: ChangedFileDiffRecord[] = [];
  const root = path.resolve(options.workspace_root);

  // 1. Read-only task mutation check
  if (options.mutation_policy === 'read_only') {
    if (changedFiles.length > 0) {
      errors.push(
        `read-only task cannot have verified changed files (found ${changedFiles.length}: ${changedFiles.join(', ')})`
      );
      return { valid: false, errors, diff_records };
    }
    return { valid: true, errors: [], diff_records: [] };
  }

  for (const relFile of changedFiles) {
    if (!relFile || typeof relFile !== 'string' || !relFile.trim()) {
      errors.push('empty or invalid file path in changed_files');
      continue;
    }

    // 2. Path traversal & symlink prevention
    const normalized = path.normalize(relFile).replace(/\\/g, '/');
    if (normalized.startsWith('../') || normalized === '..' || path.isAbsolute(relFile)) {
      errors.push(`symlink/path traversal forbidden: '${relFile}'`);
      continue;
    }

    const fullPath = path.resolve(root, normalized);
    if (!fullPath.startsWith(root)) {
      errors.push(`symlink/path traversal forbidden: '${relFile}' escapes workspace root`);
      continue;
    }

    // 3. Allowed paths check
    if (options.allowed_paths && options.allowed_paths.length > 0) {
      const isDefault = options.allowed_paths.includes('assigned workspace');
      if (!isDefault) {
        const isAllowed = options.allowed_paths.some((allowed) => {
          const normAllowed = path.normalize(allowed).replace(/\\/g, '/');
          return (
            normalized === normAllowed ||
            normalized.startsWith(`${normAllowed}/`) ||
            normalized.includes(normAllowed)
          );
        });
        if (!isAllowed) {
          errors.push(
            `scope drift: changed file '${relFile}' is outside allowed_paths (${options.allowed_paths.join(', ')})`
          );
          continue;
        }
      }
    }

    // 4. File existence check
    if (!existsSync(fullPath)) {
      errors.push(`changed file '${relFile}' does not exist on disk at '${fullPath}'`);
      continue;
    }

    // Check symlink realpath
    try {
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        const real = realpathSync(fullPath);
        if (!real.startsWith(root)) {
          errors.push(`symlink escape detected: '${relFile}' points to '${real}' outside workspace`);
          continue;
        }
      }
    } catch (statErr: any) {
      errors.push(`failed to inspect file '${relFile}': ${statErr?.message}`);
      continue;
    }

    // 5. Diff & Hash verification
    try {
      const currentContent = readFileSync(fullPath, 'utf8');
      const after_hash = computeSha256(currentContent);

      const beforeContent = options.before_contents?.[relFile];
      let before_hash: string | undefined;
      let lines_added = 0;
      let lines_deleted = 0;
      let diff_hash = after_hash;

      if (beforeContent !== undefined) {
        before_hash = computeSha256(beforeContent);
        if (before_hash === after_hash) {
          errors.push(`file '${relFile}' declared changed but has no diff (before_hash === after_hash)`);
          continue;
        }
        // Compute line diff metrics
        const beforeLines = beforeContent.split('\n');
        const afterLines = currentContent.split('\n');
        lines_added = Math.max(0, afterLines.length - beforeLines.length);
        lines_deleted = Math.max(0, beforeLines.length - afterLines.length);
        diff_hash = computeSha256(`${before_hash}->${after_hash}:${lines_added}+${lines_deleted}-`);
      } else {
        const lines = currentContent.split('\n');
        lines_added = lines.length;
        diff_hash = computeSha256(`init->${after_hash}`);
      }

      diff_records.push({
        file: relFile,
        before_hash,
        after_hash,
        diff_hash,
        lines_added,
        lines_deleted,
      });
    } catch (readErr: any) {
      errors.push(`failed to read changed file '${relFile}': ${readErr?.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    diff_records,
  };
}
