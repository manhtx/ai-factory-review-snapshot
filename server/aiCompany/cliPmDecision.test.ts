import { it, expect } from 'vitest';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { readinessAuthorityFixture } from './readinessAuthorityTestFixture';
import { roleAttemptArtifactName } from './roleAttemptArtifact';
import type { RoleWorkItem, RoleWorkQueue } from './roleWorkQueue';

// Execute the exact isolated source function. This does not certify run-ready's full process loop.
async function decisionReader(queue: RoleWorkQueue) {
  const source = await readFile(path.join(process.cwd(), 'scripts/ai-company-run-ready.mjs'), 'utf8');
  const start = source.indexOf('const upstreamPmDecision =');
  const end = source.indexOf('// The coordinator needs', start);
  if (start < 0 || end < 0) throw new Error('CLI PM function source boundary missing');
  return new Function('queue', `${source.slice(start, end)}\nreturn upstreamPmDecision;`)(queue) as (item: RoleWorkItem, rows: Map<string, RoleWorkItem>) => Promise<string | null>;
}
async function fixture() {
  const f = await readinessAuthorityFixture(['pm']);
  const pm = f.rows.find(row => row.role === 'pm')!;
  const child = await f.queue.create({ project_id: 'unit', backlog_id: 'CHILD', title: 'Unit only', role: 'ux-research', namespace: 'N', run_id: 'R', depends_on: [pm.work_id] });
  const directory = path.join(f.root, 'worker-artifacts', pm.work_id);
  await mkdir(directory, { recursive: true });
  const artifact = path.join(directory, roleAttemptArtifactName(pm.work_id, pm.attempt_id!));
  await writeFile(artifact, 'ROLE_STRUCTURED_OUTPUT_JSON {"recommendation":"HOLD"}\n');
  return { ...f, pm, child, artifact, decide: await decisionReader(f.queue), rows: new Map((await f.queue.records()).map(row => [row.work_id, row])) };
}
it('CLI PM decision uses selected admitted contract despite contradictory worker artifact text', async () => {
  const f = await fixture();
  expect(await f.decide(f.child, f.rows)).toBe('PROCEED');
  await unlink(f.artifact);
  expect(await f.decide(f.child, f.rows)).toBe('PROCEED');
});
it('CLI PM decision cannot use artifact when original receipts disappear', async () => {
  const f = await fixture();
  await writeFile(f.artifact, 'ROLE_STRUCTURED_OUTPUT_JSON {"recommendation":"PROCEED"}\n');
  await unlink(path.join(f.root, 'role-evidence.jsonl'));
  expect(await f.decide(f.child, f.rows)).toBeNull();
});
it('CLI PM decision cannot use a stale selected PM row after quarantine', async () => {
  const f = await fixture();
  await f.queue.quarantine(f.pm.work_id, 'Unit withdrawal');
  expect(await f.decide(f.child, f.rows)).toBeNull();
});
