import { describe, expect, it } from 'vitest';
import { validateLineage } from './lineage';
describe('lineage', () => {
  it('requires the product-to-evidence chain', () => expect(validateLineage({cycle_id:'c',workflow_id:'w',task_id:'t',agent_run_id:'a',provider_call_ids:[],tool_call_ids:[],evidence_ids:[],test_ids:[]})).toContain('evidence_ids must not be empty'));
});
