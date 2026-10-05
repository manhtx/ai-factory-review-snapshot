import { roleAttemptArtifactName } from './roleAttemptArtifact';
import { access, cp, lstat, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProductMutationJournal } from './productMutationJournal';

const defaultExec = promisify(execFile);
const exec = (file: string, args: string[], options: Record<string, any> = {}) =>
  defaultExec(file, args, { maxBuffer: 64 * 1024 * 1024, ...options });

export type WorktreeRecord = {
  task_id: string;
  project_id: string;
  root: string;
  worktree: string;
  created_at: string;
  base_ref: string;
  status: 'ACTIVE' | 'MERGED' | 'CLEANED' | 'ORPHANED';
  baseline_paths?: string[];
  baseline_hashes?: Record<string, string | null>;
};

export type WorktreeInventory = { task_id: string; state: 'ACTIVE' | 'COMPLETED' | 'DIRTY' | 'ORPHANED' | 'CORRUPT'; worktree: string; reason: string };

/** Owns the filesystem boundary for engineering work. It never deletes an
 * unrecognised directory and never merges without an explicit caller action. */
export class WorktreeManager {
  private readonly recordsDir: string;
  private readonly worktreesDir: string;
  private readonly mutationJournal: ProductMutationJournal;

  constructor(private readonly root: string, private readonly projectId = 'macro-os') {
    this.worktreesDir = path.join(root, '.ai-company', 'worktrees', projectId);
    this.recordsDir = path.join(root, '.ai-company', 'runtime', 'projects', projectId, 'worktrees');
    this.mutationJournal = new ProductMutationJournal(this.root, path.join(this.recordsDir, 'product-mutations.jsonl'));
  }

  private filesystemId(taskId: string) {
    if (!taskId || taskId.includes('\0') || taskId.includes('/') || taskId.includes('\\')) throw new Error(`invalid worktree task id: ${taskId}`);
    if (/^[A-Za-z0-9._-]+$/.test(taskId)) return taskId;
    const slug = taskId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '_');
    const hash = createHash('sha256').update(taskId).digest('hex').slice(0, 12);
    return `${slug.slice(0, 180)}-${hash}`;
  }
  private recordPath(taskId: string) { return path.join(this.recordsDir, `${this.filesystemId(taskId)}.json`); }
  private worktreePath(taskId: string) { return path.join(this.worktreesDir, this.filesystemId(taskId)); }
  private validateTaskId(taskId: string) {
    this.filesystemId(taskId);
  }
  private async save(record: WorktreeRecord) {
    await mkdir(this.recordsDir, { recursive: true });
    await writeFile(this.recordPath(record.task_id), `${JSON.stringify(record, null, 2)}\n`);
  }
  async get(taskId: string): Promise<WorktreeRecord | null> {
    this.validateTaskId(taskId);
    try { return JSON.parse(await readFile(this.recordPath(taskId), 'utf8')) as WorktreeRecord; }
    catch (error: any) { if (error?.code === 'ENOENT') return null; throw error; }
  }
  async create(taskId: string, baseRef = 'HEAD'): Promise<WorktreeRecord> {
    this.validateTaskId(taskId);
    if (await this.get(taskId)) throw new Error(`worktree already registered: ${taskId}`);
    await mkdir(this.worktreesDir, { recursive: true });
    const worktree = this.worktreePath(taskId);

    // If an aborted attempt left an unregistered worktree or orphan folder, prune or remove it
    try {
      await exec('git', ['worktree', 'remove', '--force', worktree], { cwd: this.root });
    } catch {
      await rm(worktree, { recursive: true, force: true }).catch(() => undefined);
      await exec('git', ['worktree', 'prune'], { cwd: this.root }).catch(() => undefined);
    }

    try {
      await exec('git', ['worktree', 'add', '--detach', worktree, baseRef], { cwd: this.root });
      // A detached worktree starts from a commit and otherwise silently loses
      // the coordinator's approved tracked working-tree changes. Overlay both
      // staged and unstaged tracked changes so every role evaluates the same
      // active revision as the coordinator. Untracked runtime artifacts remain
      // intentionally excluded; durable source/docs must be committed or
      // propagated explicitly by the caller.
      const { stdout: workingTreePatch } = await exec('git', ['diff', '--binary', baseRef], { cwd: this.root });
      const { stdout: stagedPatch } = await exec('git', ['diff', '--binary', '--cached', baseRef], { cwd: this.root });
      const patch = `${stagedPatch}${workingTreePatch}`;
      const { stdout: baselineNames } = await exec('git', ['diff', '--name-only', baseRef], { cwd: this.root });
      const { stdout: stagedNames } = await exec('git', ['diff', '--name-only', '--cached', baseRef], { cwd: this.root });
      const { stdout: baselineStatus } = await exec('git', ['status', '--porcelain=v1'], { cwd: this.root });
      if (patch.trim()) {
        const patchPath = path.join(this.worktreesDir, `.${this.filesystemId(taskId)}-working-tree.patch`);
        await writeFile(patchPath, patch);
        try { await exec('git', ['apply', '--binary', '--whitespace=nowarn', patchPath], { cwd: worktree }); }
        finally { await unlink(patchPath).catch(() => undefined); }
      }
      // Role workers must execute the same uncommitted control-plane harness that
      // the coordinator just validated. Copy the remaining harness overlays into
      // the disposable worker after the product patch is applied.
      for (const relative of ['.ai-company/PRODUCT_GOAL_MASTER.md', '.ai-company/MASTER_BUILD_PLAN.md', '.ai-company/AGENT_REGISTRY.md', '.ai-company/handoff.md', 'AGENTS.md', 'vitest.config.ts', 'scripts/ai-company-role-dispatch.mjs', 'scripts/ai-company-run-ready.mjs', 'server/aiCompany/roleWorkQueue.ts', 'server/aiCompany/productMutationJournal.ts', 'server/observationReadContract.ts', 'server/observationReadContract.test.ts', 'server/observationParity.test.ts', 'src/app/config/quarantinedProviderIds.ts', 'server/quarantinedProviderIds.ts']) {
        const source = path.join(this.root, relative); const destination = path.join(worktree, relative);
        try { await cp(source, destination, { force: true }); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
      }
      const statusNames = baselineStatus.split('\n').filter(Boolean).flatMap((line) => {
        const value = line.slice(3).trim().replace(/^"|"$/g, '');
        return value.includes(' -> ') ? value.split(' -> ').map((entry) => entry.trim()) : [value];
      });
      const baseline_paths = [...new Set(`${stagedNames}\n${baselineNames}\n${statusNames.join('\n')}`.split('\n').map((entry) => entry.trim()).filter(Boolean))] as string[];
      const baseline_hashes: Record<string, string | null> = {};
      for (const relative of baseline_paths) {
        if (!relative || relative.startsWith('/') || relative.includes('..')) continue;
        try {
          const bytes = await readFile(path.join(this.root, relative));
          baseline_hashes[relative] = createHash('sha256').update(bytes).digest('hex');
        } catch (error: any) {
          if (error?.code === 'ENOENT') baseline_hashes[relative] = null;
        }
      }
      const record: WorktreeRecord = { task_id: taskId, project_id: this.projectId, root: this.root, worktree, created_at: new Date().toISOString(), base_ref: baseRef, baseline_paths, baseline_hashes, status: 'ACTIVE' };
      await this.save(record);
      return record;
    } catch (createErr) {
      try {
        await exec('git', ['worktree', 'remove', '--force', worktree], { cwd: this.root });
      } catch {
        await rm(worktree, { recursive: true, force: true }).catch(() => undefined);
        await exec('git', ['worktree', 'prune'], { cwd: this.root }).catch(() => undefined);
      }
      throw createErr;
    }
  }
  async status(taskId: string) {
    const record = await this.get(taskId);
    if (!record) return { record: null, exists: false, clean: false, diff: '' };
    try {
      await access(record.worktree);
      const { stdout } = await exec('git', ['status', '--porcelain'], { cwd: record.worktree });
      const { stdout: diff } = await exec('git', ['diff', '--stat'], { cwd: record.worktree });
      return { record, exists: true, clean: !stdout.trim(), diff };
    } catch { return { record: { ...record, status: 'ORPHANED' as const }, exists: false, clean: false, diff: '' }; }
  }
  async diff(taskId: string) {
    const record = await this.get(taskId);
    if (!record) throw new Error(`unknown worktree: ${taskId}`);
    const { stdout } = await exec('git', ['diff', '--binary', record.base_ref], { cwd: record.worktree });
    return stdout;
  }
  async changedFiles(taskId: string, includeBaseline = true): Promise<string[]> {
    const record = await this.get(taskId); if (!record) throw new Error(`unknown worktree: ${taskId}`);
    const { stdout } = await exec('git', ['status', '--porcelain', '-uall'], { cwd: record.worktree });
    const changed = stdout.split('\n').filter(Boolean).map((line) => line.slice(3).trim().replace(/^"|"$/g, ''));
    if (includeBaseline) return changed;
    const normalize = (value: string) => value.replaceAll('\\', '/').replace(/\/+$/, '');
    const result: string[] = [];
    for (const file of changed) {
      const normalizedFile = normalize(file);
      const baselineEntry = Object.keys(record.baseline_hashes ?? {}).find((baseline) => normalize(baseline) === normalizedFile);
      if (baselineEntry) {
        try {
          const bytes = await readFile(path.join(record.worktree, file));
          if (createHash('sha256').update(bytes).digest('hex') !== record.baseline_hashes?.[baselineEntry]) result.push(file);
        } catch (error: any) {
          if (error?.code === 'ENOENT' && record.baseline_hashes?.[baselineEntry] !== null) result.push(file);
        }
        continue;
      }
      if (!(record.baseline_paths ?? []).some((baseline) => {
        const normalizedBaseline = normalize(baseline);
        return normalizedFile === normalizedBaseline
          || normalizedFile.startsWith(`${normalizedBaseline}/`)
          || normalizedBaseline.startsWith(`${normalizedFile}/`);
      })) result.push(file);
    }
    return result;
  }
  /** Overlay bounded product changes from a completed dependency into a
   * downstream disposable worktree. Role artifacts remain ledger-only; source
   * changes must be executable by the next role for independent verification. */
  async propagateProductChanges(sourceTaskId: string, targetTaskId: string, allowedPaths: string[] = []) {
    const source = await this.get(sourceTaskId);
    const target = await this.get(targetTaskId);
    if (!source || !target) throw new Error('cannot propagate changes from an unknown worktree');
    // The source worktree already contains the coordinator baseline overlay.
    // Propagate only files mutated by that role, otherwise every unrelated
    // dirty root file is mistaken for a dependency product change.
    const changed = await this.changedFiles(sourceTaskId, false);
    const harnessOverlay = new Set([
      '.ai-company/AGENT_REGISTRY.md', 'AGENTS.md', 'vitest.config.ts',
      'scripts/ai-company-role-dispatch.mjs', 'scripts/ai-company-run-ready.mjs',
      '.ai-company/PRODUCT_GOAL_MASTER.md', '.ai-company/MASTER_BUILD_PLAN.md',
      '.ai-company/handoff.md',
    ]);
    const productChanges = changed.filter((file) => file !== '.ai-company' && file !== 'node_modules' && !file.startsWith('node_modules/') && !file.startsWith('.ai-company/') && !harnessOverlay.has(file));
    const forbidden = productChanges.filter((file) => file.startsWith('.ai-company/') || file === '.env' || file.startsWith('.env.'));
    if (forbidden.length) throw new Error(`dependency changed forbidden control-plane paths: ${forbidden.join(', ')}`);
    const allowed = new Set(allowedPaths);
    const outOfScope = allowed.size ? productChanges.filter((file) => !allowed.has(file)) : [];
    if (outOfScope.length) throw new Error(`dependency changed paths outside downstream scope: ${outOfScope.join(', ')}`);
    for (const relative of productChanges) {
      if (!relative || relative.startsWith('/') || relative.includes('..')) throw new Error(`unsafe dependency change path: ${relative}`);
      const from = path.resolve(source.worktree, relative);
      const to = path.resolve(target.worktree, relative);
      if (!to.startsWith(`${path.resolve(target.worktree)}${path.sep}`)) throw new Error(`dependency path escapes target worktree: ${relative}`);
      if ((await lstat(from)).isSymbolicLink()) throw new Error(`dependency change is a symlink: ${relative}`);
      const content = await readFile(from);
      const targetKey = path.relative(this.root, to);
      await this.mutationJournal.apply({ operation_id: `PROPAGATE:${sourceTaskId}:${targetTaskId}:${relative}`, target: targetKey, content });
    }
    return productChanges;
  }
  async collectArtifacts(taskId: string, relativeDir = '.ai-company/reports', attemptId?: string) {
    const record = await this.get(taskId); if (!record) throw new Error(`unknown worktree: ${taskId}`);
    const source = path.join(record.worktree, relativeDir); const destination = path.join(this.root, '.ai-company', 'runtime', 'projects', this.projectId, 'worker-artifacts', taskId);
    try {
      await access(source); await mkdir(destination, { recursive: true });
      const outputName = attemptId ? roleAttemptArtifactName(taskId, attemptId) : `role-output-${taskId}.md`;
      const outputPath = path.join(source, outputName);
      await access(outputPath);
      const artifactBytes = (await stat(outputPath)).size;
      const maxArtifactBytes = Number(process.env.AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES || 16_384);
      if (!Number.isFinite(maxArtifactBytes) || maxArtifactBytes <= 0) throw new Error('invalid AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES');
      if (artifactBytes > maxArtifactBytes) throw new Error(`role artifact exceeds bounded size: ${artifactBytes} > ${maxArtifactBytes} bytes`);
      // Copy exactly the bounded role artifact. A recursive copy with a
      // filter still traverses the historical report tree and can stall the
      // coordinator after a worker has already completed.
      await cp(outputPath, path.join(destination, outputName), { force: true });
      return destination;
    }
    catch (error: any) { if (error?.code === 'ENOENT') return null; throw error; }
  }
  async merge(taskId: string, targetRef = 'HEAD') {
    const record = await this.get(taskId);
    if (!record) throw new Error(`unknown worktree: ${taskId}`);
    if ((await this.status(taskId)).record?.status === 'ORPHANED') throw new Error(`cannot merge orphaned worktree: ${taskId}`);
    const { stdout } = await exec('git', ['diff', '--binary', record.base_ref], { cwd: record.worktree });
    return { task_id: taskId, target_ref: targetRef, diff: stdout, requires_human_merge: true };
  }
  async mergeToMain(taskId: string, allowedPaths: string[] = [], commitMessage?: string): Promise<{ task_id: string; commit_sha: string; merged_files: string[] }> {
    const record = await this.get(taskId);
    if (!record) throw new Error(`unknown worktree: ${taskId}`);
    if ((await this.status(taskId)).record?.status === 'ORPHANED') throw new Error(`cannot merge orphaned worktree: ${taskId}`);

    const changed = await this.changedFiles(taskId, false);
    const harnessOverlay = new Set([
      '.ai-company/AGENT_REGISTRY.md', 'AGENTS.md', 'vitest.config.ts',
      'scripts/ai-company-role-dispatch.mjs', 'scripts/ai-company-run-ready.mjs',
      '.ai-company/PRODUCT_GOAL_MASTER.md', '.ai-company/MASTER_BUILD_PLAN.md',
      '.ai-company/handoff.md',
    ]);
    const productChanges = changed.filter((file) => file !== '.ai-company' && file !== 'node_modules' && !file.startsWith('node_modules/') && !file.startsWith('.ai-company/') && !harnessOverlay.has(file));
    const forbidden = productChanges.filter((file) => file.startsWith('.ai-company/') || file === '.env' || file.startsWith('.env.'));
    if (forbidden.length) throw new Error(`worktree changed forbidden control-plane paths: ${forbidden.join(', ')}`);

    const allowed = new Set(allowedPaths);
    const isAllowed = (file: string) => {
      if (!allowed.size) return true;
      if (allowed.has(file)) return true;
      return Array.from(allowed).some((p) => file.startsWith(p.endsWith('/') ? p : `${p}/`));
    };
    const outOfScope = allowed.size ? productChanges.filter((file) => !isAllowed(file)) : [];
    if (outOfScope.length) throw new Error(`worktree changed paths outside scope: ${outOfScope.join(', ')}`);

    if (!productChanges.length) {
      throw new Error(`no product changes to merge for worktree: ${taskId}`);
    }

    for (const relative of productChanges) {
      if (!relative || relative.startsWith('/') || relative.includes('..')) throw new Error(`unsafe merge path: ${relative}`);
      const from = path.resolve(record.worktree, relative);
      const to = path.resolve(this.root, relative);
      if (!to.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error(`merge path escapes repository root: ${relative}`);
      try {
        const fromStat = await lstat(from);
        if (fromStat.isSymbolicLink()) throw new Error(`merge change is a symlink: ${relative}`);
        const content = await readFile(from);
        await mkdir(path.dirname(to), { recursive: true });
        await writeFile(to, content);
        await this.mutationJournal.apply({ operation_id: `MERGE:${taskId}:${relative}`, target: relative, content });
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          await unlink(to).catch(() => undefined);
          await this.mutationJournal.apply({ operation_id: `MERGE_DELETE:${taskId}:${relative}`, target: relative, content: Buffer.from('') });
        } else {
          throw err;
        }
      }
    }

    await exec('git', ['add', ...productChanges], { cwd: this.root });
    const message = commitMessage || `feat(macro-os): integrate verified product outcome from ${taskId}`;
    await exec('git', ['commit', '-m', message], { cwd: this.root });
    const { stdout: commitShaOut } = await exec('git', ['rev-parse', 'HEAD'], { cwd: this.root });
    const commit_sha = commitShaOut.trim();

    await this.save({ ...record, status: 'MERGED' });
    return { task_id: taskId, commit_sha, merged_files: productChanges };
  }
  async cleanup(taskId: string) {
    const record = await this.get(taskId);
    if (!record) throw new Error(`unknown worktree: ${taskId}`);
    const state = await this.status(taskId);
    if (!state.exists) { await this.save({ ...record, status: 'ORPHANED' }); return state; }
    if (!state.clean) throw new Error(`refusing to cleanup dirty worktree: ${taskId}`);
    await exec('git', ['worktree', 'remove', record.worktree], { cwd: this.root });
    await this.save({ ...record, status: 'CLEANED' });
    return { ...state, cleaned: true };
  }
  async recover(taskId: string) {
    const record = await this.get(taskId);
    if (!record) throw new Error(`unknown worktree: ${taskId}`);
    await exec('git', ['worktree', 'prune'], { cwd: this.root });
    const state = await this.status(taskId);
    if (!state.exists) await this.save({ ...record, status: 'ORPHANED' });
    return state;
  }
  async findOrphans() {
    let ids: string[] = [];
    try { ids = await readdir(this.recordsDir).then(items => items.filter(item => item.endsWith('.json')).map(item => item.slice(0, -5))); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    return (await Promise.all(ids.map(async id => (await this.status(id)).record))).filter((record): record is WorktreeRecord => record?.status === 'ORPHANED');
  }

  /** Read-only startup inventory. It never deletes or force-removes a worker
   * checkout; unsafe or corrupt entries are explicitly quarantined in the
   * returned inventory and may be handled by a human-gated cleanup policy. */
  async inventory(): Promise<WorktreeInventory[]> {
    let ids: string[] = [];
    try { ids = (await readdir(this.recordsDir)).filter((item) => item.endsWith('.json')).map((item) => item.slice(0, -5)); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    return Promise.all(ids.map(async (id) => {
      let record: WorktreeRecord;
      try { record = JSON.parse(await readFile(path.join(this.recordsDir, `${id}.json`), 'utf8')) as WorktreeRecord; }
      catch { return { task_id: id, state: 'CORRUPT' as const, worktree: '', reason: 'worktree record is not valid JSON' }; }
      try { await access(record.worktree); }
      catch { return { task_id: record.task_id, state: 'ORPHANED' as const, worktree: record.worktree, reason: 'registered worktree path is missing' }; }
      try {
        const { stdout } = await exec('git', ['status', '--porcelain'], { cwd: record.worktree });
        return { task_id: record.task_id, state: stdout.trim() ? 'DIRTY' as const : record.status === 'CLEANED' || record.status === 'MERGED' ? 'COMPLETED' as const : 'ACTIVE' as const, worktree: record.worktree, reason: stdout.trim() ? 'uncommitted worker changes require explicit review' : 'worktree is reachable' };
      } catch { return { task_id: record.task_id, state: 'CORRUPT' as const, worktree: record.worktree, reason: 'path exists but is not a usable git worktree' }; }
    }));
  }
}
