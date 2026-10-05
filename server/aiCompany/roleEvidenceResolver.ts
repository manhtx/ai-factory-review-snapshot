import path from 'node:path';
import { JsonlEvidenceResolver, type IEvidenceResolver, type StoredEvidence, type EvidenceSnapshot } from './evidenceResolver';
import { RoleEvidenceLedger } from './roleEvidenceLedger';

/** Original provider receipts stay in their producer stores. This read-only
 * adapter neither copies lineage nor treats corruption as absent evidence. */
export class RoleEvidenceResolver implements IEvidenceResolver {
  private readonly native: RoleEvidenceLedger;
  private readonly cli: JsonlEvidenceResolver;
  constructor(root: string) {
    this.native = new RoleEvidenceLedger(root);
    this.cli = new JsonlEvidenceResolver(path.join(root, 'role-dispatch-evidence.jsonl'), 'PROVIDER_OUTPUT');
  }
  async snapshot(): Promise<EvidenceSnapshot> {
    const [native,cli] = await Promise.all([this.native.snapshot(),this.cli.snapshot()]);
    const assertCurrent = (ids?: readonly string[]) => { native.assertCurrent(ids); cli.assertCurrent(ids); };
    // Validate complete original stores without invalidating unrelated identities.
    // Callers choose a full-view or bounded selected-identity decision guard.
    assertCurrent([]);
    return { assertCurrent, resolve: id => {
      const n = native.inspectIdentity!(id), c = cli.inspectIdentity!(id);
      if (n.exists && c.exists) throw new Error(`ambiguous provider evidence identity '${id}' exists in both stores`);
      return n.evidence ?? c.evidence;
    } };
  }
  async resolve(evidenceId: string): Promise<StoredEvidence | null> {
    const snapshot = await this.snapshot();
    snapshot.assertCurrent([evidenceId]);
    return snapshot.resolve(evidenceId);
  }
}
