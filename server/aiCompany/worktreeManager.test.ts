import { mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { WorktreeManager } from './worktreeManager';

const exec = promisify(execFile);

describe('WorktreeManager', () => {
  it('creates an isolated workspace, captures changes, and refuses dirty cleanup', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-worktree-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    const manager = new WorktreeManager(root);
    const record = await manager.create('task-1');
    expect(record.worktree).not.toBe(root);
    await writeFile(path.join(record.worktree, 'README.md'), 'changed\n');
    expect((await manager.status('task-1')).clean).toBe(false);
    expect(await manager.diff('task-1')).toContain('changed');
    await expect(manager.cleanup('task-1')).rejects.toThrow('dirty worktree');
    await writeFile(path.join(record.worktree, 'README.md'), 'base\n');
    await manager.cleanup('task-1');
    expect((await manager.get('task-1'))?.status).toBe('CLEANED');
    expect(await readFile(path.join(root, '.ai-company/runtime/projects/macro-os/worktrees/task-1.json'), 'utf8')).toContain('CLEANED');
  });

  it('overlays the current tracked working-tree revision into a new worktree', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-current-revision-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'active working-tree revision\n');
    await writeFile(path.join(root, 'existing-untracked.txt'), 'pre-existing\n');

    const manager = new WorktreeManager(root);
    const record = await manager.create('current-revision');

    expect(await readFile(path.join(record.worktree, 'README.md'), 'utf8')).toBe('active working-tree revision\n');
    expect(await manager.changedFiles('current-revision', false)).toEqual([]);
  });

  it('detects and propagates a role change to a file that was already dirty at baseline', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-dirty-baseline-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'pre-existing dirty baseline\n');

    const manager = new WorktreeManager(root);
    const source = await manager.create('dirty-source');
    const target = await manager.create('dirty-target');
    await writeFile(path.join(source.worktree, 'README.md'), 'new role change\n');

    expect(await manager.changedFiles('dirty-source', false)).toEqual(['README.md']);
    expect(await manager.propagateProductChanges('dirty-source', 'dirty-target', ['README.md'])).toEqual(['README.md']);
    expect(await readFile(path.join(target.worktree, 'README.md'), 'utf8')).toBe('new role change\n');
  });

  it('propagates only product changes and ignores harness/report overlays', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-propagate-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    const manager = new WorktreeManager(root);
    const source = await manager.create('source');
    const target = await manager.create('target');
    await writeFile(path.join(source.worktree, 'README.md'), 'product change\n');
    await writeFile(path.join(source.worktree, 'OUT_OF_SCOPE.md'), 'blocked\n');
    await symlink('/tmp', path.join(source.worktree, 'ESCAPE_LINK'));
    await writeFile(path.join(source.worktree, 'vitest.config.ts'), 'overlay\n');
    await mkdir(path.join(source.worktree, '.ai-company/reports'), { recursive: true });
    await writeFile(path.join(source.worktree, '.ai-company/reports/role-output-source.md'), 'artifact\n');
    await expect(manager.propagateProductChanges('source', 'target', ['README.md'])).rejects.toThrow('outside downstream scope');
    await unlink(path.join(source.worktree, 'OUT_OF_SCOPE.md'));
    await expect(manager.propagateProductChanges('source', 'target', ['README.md', 'ESCAPE_LINK'])).rejects.toThrow('symlink');
    await unlink(path.join(source.worktree, 'ESCAPE_LINK'));
    expect(await manager.propagateProductChanges('source', 'target', ['README.md'])).toEqual(['README.md']);
    expect(await readFile(path.join(target.worktree, 'README.md'), 'utf8')).toBe('product change\n');
    // The disposable temp repository is left for the OS to reclaim; the
    // manager correctly refuses cleanup while harness overlays are dirty.
  });

  it('rejects oversized durable role artifacts while retaining raw logs separately', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-artifact-limit-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    const manager = new WorktreeManager(root);
    const record = await manager.create('artifact-limit');
    const reportDir = path.join(record.worktree, '.ai-company/reports');
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, 'role-output-artifact-limit.md'), 'x'.repeat(32));
    const previous = process.env.AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES;
    process.env.AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES = '16';
    try { await expect(manager.collectArtifacts('artifact-limit')).rejects.toThrow('exceeds bounded size'); }
    finally { if (previous === undefined) delete process.env.AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES; else process.env.AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES = previous; }
  });

  it('inventories active, dirty, completed and missing worktrees without deleting them', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-inventory-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n'); await exec('git', ['add', 'README.md'], { cwd: root }); await exec('git', ['commit', '-qm', 'base'], { cwd: root });
    const manager = new WorktreeManager(root); const active = await manager.create('active'); const missing = await manager.create('missing');
    await writeFile(path.join(active.worktree, 'README.md'), 'dirty\n');
    await exec('git', ['worktree', 'remove', '--force', missing.worktree], { cwd: root });
    await expect(manager.inventory()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ task_id: 'active', state: 'DIRTY' }),
      expect.objectContaining({ task_id: 'missing', state: 'ORPHANED' }),
    ]));
  });

  it('merges verified product changes into main git history and marks worktree MERGED', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-merge-to-main-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });

    const manager = new WorktreeManager(root);
    const record = await manager.create('merge-task');
    await mkdir(path.join(record.worktree, 'server'), { recursive: true });
    await writeFile(path.join(record.worktree, 'server', 'feature.ts'), 'export const active = true;\n');

    const mergeResult = await manager.mergeToMain('merge-task', ['server/feature.ts'], 'feat: add feature');
    expect(mergeResult.task_id).toBe('merge-task');
    expect(mergeResult.merged_files).toEqual(['server/feature.ts']);
    expect(mergeResult.commit_sha).toHaveLength(40);

    // Verify main root contains the file and git log has the commit
    expect(await readFile(path.join(root, 'server', 'feature.ts'), 'utf8')).toBe('export const active = true;\n');
    const { stdout: logOut } = await exec('git', ['log', '-1', '--pretty=%B'], { cwd: root });
    expect(logOut.trim()).toBe('feat: add feature');

    // Verify worktree record status is MERGED
    const updatedRecord = await manager.get('merge-task');
    expect(updatedRecord?.status).toBe('MERGED');
  });

  it('rejects mergeToMain when worktree has out of scope or forbidden changes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-merge-forbidden-'));
    await exec('git', ['init', '-q'], { cwd: root });
    await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await exec('git', ['config', 'user.name', 'AI Company Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), 'base\n');
    await exec('git', ['add', 'README.md'], { cwd: root });
    await exec('git', ['commit', '-qm', 'base'], { cwd: root });

    const manager = new WorktreeManager(root);
    const record = await manager.create('forbidden-task');
    await writeFile(path.join(record.worktree, 'server-secret.ts'), 'secret\n');

    await expect(manager.mergeToMain('forbidden-task', ['server/feature.ts'])).rejects.toThrow('outside scope');
  });
});
