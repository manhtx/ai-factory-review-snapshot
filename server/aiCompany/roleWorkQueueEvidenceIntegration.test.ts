import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonlEvidenceResolver } from './evidenceResolver';
import { RoleWorkQueue } from './roleWorkQueue';

describe('RoleWorkQueue evidence resolver integration', () => {
  it('requires explicit resolution before completion and preserves queue bytes on rejection', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-no-resolver-'));
    const queue = new RoleWorkQueue(root);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    const claimAuthority1 = await queue.claim(item.work_id, 'test:pm');
    await queue.submitForReview(item.work_id, claimAuthority1.attempt_authority);
    const before = await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8');
    await expect(queue.complete(item.work_id, ['UNRESOLVED:EVIDENCE'], undefined, undefined, {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g', evidence_ids: ['UNRESOLVED:EVIDENCE'], facts: ['f'], assumptions: [], scope: ['s'], non_goals: [], recommendation: 'HOLD', confidence: 0.5, unknowns: [],
    }, undefined, undefined, claimAuthority1.attempt_authority)).rejects.toThrow('completion requires an explicitly configured evidence resolver');
    expect(await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8')).toBe(before);
    expect((await queue.records())[0].state).toBe('IN_REVIEW');
  });

  it('preserves reader and intake capability without granting completion authority', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-reader-'));
    const queue = new RoleWorkQueue(root);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    expect(await new RoleWorkQueue(root).records()).toEqual([item]);
    expect(item.state).toBe('READY');
  });

  it('propagates resolver inspection failure without recording DONE', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-resolver-error-'));
    const queue = new RoleWorkQueue(root, { snapshot() { throw new Error('evidence inspection unavailable'); }, resolve() { throw new Error('evidence inspection unavailable'); } });
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    const claimAuthority2 = await queue.claim(item.work_id, 'test:pm');
    await queue.submitForReview(item.work_id, claimAuthority2.attempt_authority);
    const before = await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8');
    await expect(queue.complete(item.work_id, ['EVIDENCE'], undefined, undefined, {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g', evidence_ids: ['EVIDENCE'], facts: ['f'], assumptions: [], scope: ['s'], non_goals: [], recommendation: 'HOLD', confidence: 0.5, unknowns: [],
    }, undefined, undefined, claimAuthority2.attempt_authority)).rejects.toThrow('evidence inspection unavailable');
    expect(await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8')).toBe(before);
  });

  it('refuses an evidence-only completion when the ID cannot resolve', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-evidence-'));
    const queue = new RoleWorkQueue(root, new JsonlEvidenceResolver(path.join(root, 'role-dispatch-evidence.jsonl')));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    const claimAuthority3 = await queue.claim(item.work_id, 'test:pm');
    await queue.submitForReview(item.work_id, claimAuthority3.attempt_authority);
    await expect(queue.complete(item.work_id, ['FAKE:EVIDENCE'], undefined, undefined, {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g', evidence_ids: ['FAKE:EVIDENCE'], facts: ['f'], assumptions: [], scope: ['s'], non_goals: [], recommendation: 'HOLD', confidence: 0.5, unknowns: [],
    }, undefined, undefined, claimAuthority3.attempt_authority)).rejects.toThrow('cannot be resolved');
  });

  it('accepts a resolved, hashed evidence record in the same run and namespace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-evidence-valid-'));
    const evidencePath = path.join(root, 'role-dispatch-evidence.jsonl');
    const queue = new RoleWorkQueue(root, new JsonlEvidenceResolver(evidencePath));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    const content = 'authoritative bounded output';
    const { createHash } = await import('node:crypto');
    await writeFile(evidencePath, JSON.stringify({ evidence_id: 'GOOD:EVIDENCE', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: 'backend-engineer', work_id: item.work_id, content, content_hash: createHash('sha256').update(content).digest('hex'), source_artifact: 'role.log', created_at: new Date().toISOString() }) + '\n');
    const claimAuthority4 = await queue.claim(item.work_id, 'test:pm');
    await queue.submitForReview(item.work_id, claimAuthority4.attempt_authority);
    const done = await queue.complete(item.work_id, ['GOOD:EVIDENCE'], undefined, undefined, {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g', evidence_ids: ['GOOD:EVIDENCE'], facts: ['f'], assumptions: [], scope: ['s'], non_goals: [], recommendation: 'HOLD', confidence: 0.5, unknowns: [],
    }, undefined, undefined, claimAuthority4.attempt_authority);
    expect(done.state).toBe('DONE');
  });

  it('rejects a structured output that declares unresolved evidence not used for completion', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-evidence-declared-'));
    const evidencePath = path.join(root, 'role-dispatch-evidence.jsonl');
    const queue = new RoleWorkQueue(root, new JsonlEvidenceResolver(evidencePath));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded PM task', role: 'pm' });
    const content = 'authoritative bounded output';
    const { createHash } = await import('node:crypto');
    await writeFile(evidencePath, JSON.stringify({ evidence_id: 'GOOD:EVIDENCE', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: 'backend-engineer', work_id: item.work_id, content, content_hash: createHash('sha256').update(content).digest('hex'), source_artifact: 'role.log', created_at: new Date().toISOString() }) + '\n');
    const claimAuthority5 = await queue.claim(item.work_id, 'test:pm');
    await queue.submitForReview(item.work_id, claimAuthority5.attempt_authority);
    await expect(queue.complete(item.work_id, ['GOOD:EVIDENCE'], undefined, undefined, {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g', evidence_ids: ['FAKE:EVIDENCE'], facts: ['f'], assumptions: [], scope: ['s'], non_goals: [], recommendation: 'HOLD', confidence: 0.5, unknowns: [],
    }, undefined, undefined, claimAuthority5.attempt_authority)).rejects.toThrow('cannot be resolved');
  });

  it('accepts engineering prose even when it contains a copied role-shaped example', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-role-identity-'));
    const evidencePath = path.join(root, 'role-dispatch-evidence.jsonl');
    const queue = new RoleWorkQueue(root, new JsonlEvidenceResolver(evidencePath));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded backend task', role: 'backend-engineer' });
    const content = 'backend output';
    const { createHash } = await import('node:crypto');
    await writeFile(evidencePath, JSON.stringify({ evidence_id: 'GOOD:EVIDENCE', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: 'backend-engineer', work_id: item.work_id, content, content_hash: createHash('sha256').update(content).digest('hex'), source_artifact: 'role.log', created_at: new Date().toISOString() }) + '\n');
    const claimAuthority6 = await queue.claim(item.work_id, 'test:backend-engineer');
    await queue.submitForReview(item.work_id, claimAuthority6.attempt_authority);
    await expect(queue.complete(item.work_id, ['GOOD:EVIDENCE'], undefined, undefined, {
      role: 'backend-engineer', files_changed: [], files_not_changed: [], implementation_summary: '{"role":"pm","problem":"wrong worker"}', tests_run: [], tests_failed: [], known_limitations: [], rollback_instruction: 'none', evidence_ids: ['GOOD:EVIDENCE'],
    }, undefined, undefined, claimAuthority6.attempt_authority)).resolves.toMatchObject({ state: 'DONE' });
  });

  it('quarantines a precommitted terminal record instead of leaving it as DONE', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'queue-quarantine-'));
    const queue = new RoleWorkQueue(root);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded task', role: 'pm' });
    const quarantined = await queue.quarantine(item.work_id, 'untrusted worker terminal state');
    expect(quarantined.state).toBe('QUARANTINED');
    expect((await queue.records()).find((candidate) => candidate.work_id === item.work_id)?.state).toBe('QUARANTINED');
  });
});
