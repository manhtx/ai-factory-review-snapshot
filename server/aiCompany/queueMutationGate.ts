import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, fsyncSync, fchmodSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function assertSingleFile(file: string): void {
  let stat;
  try { stat = lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`queue authority file must be a regular unaliased file: ${file}`);
}

/** SQLite holds no work state: it only supplies crash-released OS exclusion. */
export async function withQueueMutationGate<T>(root: string, mutate: (bytes: Buffer, queueBytes: Buffer) => { value: T; append?: string }, authorityFile: 'role-work-queue.jsonl' | 'role-evidence.jsonl' | 'role-dispatch-evidence.jsonl' = 'role-work-queue.jsonl'): Promise<T> {
  if (!['role-work-queue.jsonl', 'role-evidence.jsonl', 'role-dispatch-evidence.jsonl'].includes(authorityFile)) throw new Error('unsupported authority publication file');
  await mkdir(root, { recursive: true });
  const canonical = await realpath(root);
  const file = path.join(canonical, authorityFile);
  const gate = path.join(canonical, 'role-work-queue.write-gate.sqlite');
  const deadline = Date.now() + 5000;
  while (true) {
    assertSingleFile(gate);
    const db = new DatabaseSync(gate, { timeout: 0 });
    let acquired = false;
    let committed = false;
    let value: T | undefined;
    let operationError: unknown;
    let operationFailed = false;
    let releaseError: unknown;
    try {
      try { db.exec('BEGIN IMMEDIATE'); acquired = true; }
      catch (error) {
        // SQLite error codes are numeric extended codes in node:sqlite.
        if ((error as { errcode?: number }).errcode !== 5) throw error;
      }
      if (acquired) {
        assertSingleFile(file);
        const bytes = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const queueFile = path.join(canonical, 'role-work-queue.jsonl');
        if (authorityFile !== 'role-work-queue.jsonl') assertSingleFile(queueFile);
        const queueBytes = authorityFile === 'role-work-queue.jsonl' ? bytes : existsSync(queueFile) ? readFileSync(queueFile) : Buffer.alloc(0);
        new TextDecoder('utf-8', { fatal: true }).decode(queueBytes);
        const result = mutate(bytes, queueBytes);
        if (result.append === undefined) {
          value = result.value;
        } else {
          const mode = existsSync(file) ? lstatSync(file).mode & 0o777 : 0o600;
          const temporary = path.join(canonical, `.${authorityFile.slice(0, -6)}-${randomUUID()}.tmp`);
          let published = false;
          try {
            const fd = openSync(temporary, 'wx', mode);
            try {
              fchmodSync(fd, mode);
              writeFileSync(fd, Buffer.concat([bytes, Buffer.from(result.append, 'utf8')]));
              fsyncSync(fd);
            } finally { closeSync(fd); }
            renameSync(temporary, file);
            published = true;
            committed = true;
            const directory = openSync(canonical, 'r');
            try { fsyncSync(directory); } finally { closeSync(directory); }
          } catch (error) {
            if (published) throw new Error('QUEUE_COMMIT_UNCERTAIN: queue published but durability confirmation failed', { cause: error });
            throw error;
          } finally {
            if (!published && existsSync(temporary)) unlinkSync(temporary);
          }
          value = result.value;
        }
      }
    } catch (error) { operationFailed = true; operationError = error; } finally {
      try { if (acquired) db.exec('ROLLBACK'); } catch (error) { releaseError = error; }
      try { db.close(); } catch (error) { releaseError ??= error; }
    }
    if (releaseError) throw new Error(committed ? 'QUEUE_COMMITTED_GATE_RELEASE_FAILURE: inspect committed state before retry' : 'queue gate release failed', { cause: releaseError });
    if (operationFailed) throw operationError;
    if (acquired) return value as T;
    if (Date.now() >= deadline) throw new Error('queue mutation gate timeout; no queue commit performed');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
