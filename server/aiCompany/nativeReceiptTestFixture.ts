import { RoleWorkQueue, type AttemptAuthority } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';

// Temporary advisory receipts only. Requires the actual caller-owned claim handle;
// never resolves, caches or fabricates a capability, provider effect or review.
export async function recordNativeFixture(queue: RoleWorkQueue, ledger: RoleEvidenceLedger, input: Parameters<RoleEvidenceLedger['record']>[0], authority: AttemptAuthority) {
  const work = (await queue.records()).find(row => row.work_id === input.work_id);
  if (!work) throw new Error('native fixture requires actual temporary work');
  if (!work.provider_dispatch) await queue.reserveProviderDispatch(work.work_id, input.provider_id, authority, work);
  return ledger.record(input, authority);
}
