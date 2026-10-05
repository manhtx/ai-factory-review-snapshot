import type { CompanyTask, Worker, WorkerResult } from './orchestrator';

export interface ModelUsage { input_tokens: number; output_tokens: number; estimated_cost_usd: number }
export interface ModelResponse { ok: boolean; evidence_ids: string[]; text?: string; usage: ModelUsage; notes?: string }
export interface ModelAdapter { id: string; complete(input: { task: CompanyTask; worker_id: string }): Promise<ModelResponse> }

export function modelWorker(adapter: ModelAdapter, workerId = adapter.id): Worker {
  return {
    id: workerId,
    async run(task): Promise<WorkerResult> {
      const response = await adapter.complete({ task, worker_id: workerId });
      return {
        worker_id: workerId,
        ok: response.ok,
        evidence_ids: response.evidence_ids,
        notes: response.notes,
        estimated_cost_usd: response.usage.estimated_cost_usd,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      } as WorkerResult & { input_tokens: number; output_tokens: number };
    },
  };
}
