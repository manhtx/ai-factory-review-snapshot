export interface LineageRecord { cycle_id: string; workflow_id: string; task_id: string; agent_run_id: string; provider_call_ids: string[]; tool_call_ids: string[]; evidence_ids: string[]; test_ids: string[]; outcome_id?: string; learning_id?: string; }

export function validateLineage(record: LineageRecord): string[] {
  const errors: string[] = [];
  for (const key of ['cycle_id','workflow_id','task_id','agent_run_id'] as const) if (!record[key]?.trim()) errors.push(`${key} is required`);
  for (const key of ['provider_call_ids','tool_call_ids','evidence_ids','test_ids'] as const) if (!Array.isArray(record[key])) errors.push(`${key} must be an array`);
  if (!record.evidence_ids.length) errors.push('evidence_ids must not be empty');
  return errors;
}
