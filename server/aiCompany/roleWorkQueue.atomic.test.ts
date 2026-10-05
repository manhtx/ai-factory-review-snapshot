import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';

const spec = (work_id: string, depends_on: string[] = []) => ({ work_id, project_id: 'macro-os', backlog_id: 'RUN-1', title: work_id, role: 'pm' as const, depends_on });
describe('RoleWorkQueue atomic DAG creation', () => {
  it('writes zero rows when role, dependency or cycle validation fails', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'dag-')));
    await expect(queue.createBatch([spec('a'), { ...spec('b'), role: 'not-a-role' as never }])).rejects.toThrow('unknown company role');
    await expect(queue.records()).resolves.toEqual([]);
    await expect(queue.createBatch([spec('a', ['missing'])])).rejects.toThrow('unknown DAG dependency');
    await expect(queue.records()).resolves.toEqual([]);
    await expect(queue.createBatch([spec('a', ['b']), spec('b', ['a'])])).rejects.toThrow('DAG cycle');
    await expect(queue.records()).resolves.toEqual([]);
  });
  it('commits a valid DAG as one batch', async () => { const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'dag-'))); await queue.createBatch([spec('a'), spec('b', ['a'])]); expect((await queue.records()).map((x) => x.work_id)).toEqual(['a', 'b']); });
});
