import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateReviewEvidenceRecord, type ReviewEvidenceRecord } from './reviewEvidenceContract';

describe('Changed File Verification (Phase 3)', () => {
  async function setupWorkspace() {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'verify-files-'));
    await mkdir(path.join(dir, 'server'), { recursive: true });
    await writeFile(path.join(dir, 'server', 'api.ts'), 'export const v = 1;\n', 'utf8');
    return dir;
  }

  function makeRecord(files: string[]): ReviewEvidenceRecord {
    return {
      review_id: 'REV-FILE-1',
      work_id: 'WORK-FILE-1',
      role: 'functional-qa',
      cycle_round: 1,
      verdict: 'PASS',
      commands_run: [{ command: 'npm test', exit_code: 0 }],
      test_results: [{ test_framework: 'vitest', test_file: 'api.test.ts', test_name: 't1', status: 'PASS' }],
      changed_files_verified: files,
      evidence_ids: ['EV-FILE-1'],
      created_at: new Date().toISOString(),
    };
  }

  it('rejects changed file that does not exist on disk', async () => {
    const dir = await setupWorkspace();
    const record = makeRecord(['server/non_existent.ts']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
    });
    expect(errors.some((e) => e.includes('does not exist on disk'))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects changed file outside allowed_paths', async () => {
    const dir = await setupWorkspace();
    await mkdir(path.join(dir, 'secret'), { recursive: true });
    await writeFile(path.join(dir, 'secret', 'pass.ts'), 'export const p = 1;\n', 'utf8');

    const record = makeRecord(['secret/pass.ts']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
    });
    expect(errors.some((e) => e.includes('outside allowed_paths'))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects path traversal attacks attempting to escape workspace', async () => {
    const dir = await setupWorkspace();
    const record = makeRecord(['../../etc/passwd', 'server/../../../etc/shadow']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
    });
    expect(errors.some((e) => e.includes('symlink/path traversal forbidden'))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('blocks symlink pointing outside workspace root', async () => {
    const dir = await setupWorkspace();
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'outside-target-'));
    await writeFile(path.join(outsideDir, 'external.ts'), 'external\n', 'utf8');

    const linkPath = path.join(dir, 'server', 'symlink_out.ts');
    try {
      await symlink(path.join(outsideDir, 'external.ts'), linkPath);
      const record = makeRecord(['server/symlink_out.ts']);
      const errors = validateReviewEvidenceRecord(record, {
        workspace_root: dir,
        allowed_paths: ['server'],
      });
      expect(errors.some((e) => e.includes('symlink escape detected'))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('rejects mutation when task mutation_policy is read_only', async () => {
    const dir = await setupWorkspace();
    const record = makeRecord(['server/api.ts']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
      mutation_policy: 'read_only',
    });
    expect(errors.some((e) => e.includes('read-only task cannot have verified changed files'))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects declared changed file when there is no actual diff (before === after)', async () => {
    const dir = await setupWorkspace();
    const record = makeRecord(['server/api.ts']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
      before_contents: {
        'server/api.ts': 'export const v = 1;\n', // same as current on disk
      },
    });
    expect(errors.some((e) => e.includes('declared changed but has no diff'))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts valid changed file with genuine diff, records diff hash and line counts', async () => {
    const dir = await setupWorkspace();
    // Update api.ts with a real diff
    await writeFile(path.join(dir, 'server', 'api.ts'), 'export const v = 2;\nexport const v2 = 3;\n', 'utf8');

    const record = makeRecord(['server/api.ts']);
    const errors = validateReviewEvidenceRecord(record, {
      workspace_root: dir,
      allowed_paths: ['server'],
      before_contents: {
        'server/api.ts': 'export const v = 1;\n',
      },
    });

    expect(errors).toHaveLength(0);
    expect(record.diff_records).toBeDefined();
    expect(record.diff_records).toHaveLength(1);
    expect(record.diff_records![0].file).toBe('server/api.ts');
    expect(record.diff_records![0].diff_hash).toBeDefined();
    expect(record.diff_records![0].lines_added).toBeGreaterThan(0);

    await rm(dir, { recursive: true, force: true });
  });
});
