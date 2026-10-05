import type { CompanyTask, WorkerResult } from './orchestrator';

export function validateWorkerResults(task: CompanyTask, results: WorkerResult[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (results.length === 0) errors.push('no worker results');
  for (const result of results) {
    if (ids.has(result.worker_id)) errors.push(`duplicate worker result: ${result.worker_id}`);
    ids.add(result.worker_id);
    if (!result.ok) errors.push(`worker failed: ${result.worker_id}`);
    if (result.ok && result.evidence_ids.length === 0) errors.push(`evidence missing: ${result.worker_id}`);
    if ((result.input_tokens ?? 0) < 0 || (result.output_tokens ?? 0) < 0) errors.push(`negative token count: ${result.worker_id}`);
    if ((result.estimated_cost_usd ?? 0) < 0) errors.push(`negative cost: ${result.worker_id}`);
  }
  if (task.budget.max_cost_usd !== undefined && results.reduce((sum, item) => sum + (item.estimated_cost_usd ?? 0), 0) > task.budget.max_cost_usd) errors.push('aggregate cost exceeds task budget');
  return errors;
}
