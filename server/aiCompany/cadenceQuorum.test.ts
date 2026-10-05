import { describe, expect, it } from 'vitest';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { evaluateCadenceQuorum } from './cadenceQuorum';
import { faultReadinessWork, readinessAuthorityFixture } from './readinessAuthorityTestFixture';
import type { CurrentRoleAuthority } from './roleWorkQueue';
const roles = ['ceo', 'ceo-guild', 'pm', 'data-engineer', 'sre'] as const;
const fixture = (selected: readonly typeof roles[number][] = roles) => readinessAuthorityFixture(selected, 'CADENCE:daily');

describe('cadence quorum', () => {
  it('fails when an accountable role is missing or unevidenced', async () => {
    const f = await fixture(['ceo']);
    const authority = await faultReadinessWork(f, 'ceo', { evidence_ids: [] });
    const result = evaluateCadenceQuorum({ cadence: 'daily', authority });
    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining(['governance work ceo has no evidence', 'missing governance work: ceo-guild', 'missing governance work: pm']));
  });
  it('passes only when every daily accountable role is done with evidence', async () => {
    const f = await fixture();
    expect(evaluateCadenceQuorum({ cadence: 'daily', authority: f.authority })).toMatchObject({ ok: true, completed_roles: roles });
  });
});
it.each(['withdrawn', 'missing'])('denies %s governance inputs despite historical DONE', async kind => {
  const f = await fixture();
  if (kind === 'withdrawn') await f.queue.quarantine(f.source.work_id, 'Unit withdrawal');
  else for (const role of roles) await faultReadinessWork(f, role, { depends_on: ['MISSING-SOURCE'] });
  const result = evaluateCadenceQuorum({ cadence: 'daily', authority: await f.queue.currentAuthority('unit') });
  expect(result.ok).toBe(false); expect(result.completed_roles).toEqual([]); expect(result.blockers).toHaveLength(5);
});
it('reads healthy dependencies outside cadence selection', async () => {
  const f = await fixture();
  expect(f.source.backlog_id).toBe('SOURCE');
  expect(evaluateCadenceQuorum({ cadence: 'daily', authority: f.authority }).ok).toBe(true);
});
it('revokes receiptless cadence and rejects stale views', async () => {
  const f = await fixture(); await unlink(path.join(f.root, 'role-evidence.jsonl'));
  expect(() => evaluateCadenceQuorum({ cadence: 'daily', authority: f.authority })).toThrow('snapshot changed');
  expect(evaluateCadenceQuorum({ cadence: 'daily', authority: await f.queue.currentAuthority('unit') })).toMatchObject({ ok: false, completed_roles: [] });
});
it('plain rows and copied views cannot certify cadence', async () => {
  const f = await fixture();
  for (const fake of [undefined, f.rows, { ...f.authority }]) expect(evaluateCadenceQuorum({ cadence: 'daily', authority: fake as CurrentRoleAuthority })).toMatchObject({ ok: false, completed_roles: [] });
});
it('cannot approve target cadence using another project governance', async () => {
  const f = await fixture();
  expect(evaluateCadenceQuorum({ cadence: 'daily', authority: await f.queue.currentAuthority('EMPTY-TARGET') })).toMatchObject({ ok: false, completed_roles: [] });
});
