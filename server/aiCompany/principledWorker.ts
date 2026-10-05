import type { CompanyTask, Worker, WorkerResult } from './orchestrator';

export function withAgentPrinciples(worker: Worker, principles: string[]): Worker {
  return {
    id: worker.id,
    run: async (task: CompanyTask): Promise<WorkerResult> => {
      const result = await worker.run(task);
      const requiresEvidence = principles.some((principle) => /evidence IDs|provenance evidence/i.test(principle));
      if (result.ok && requiresEvidence && result.evidence_ids.length === 0) return { ...result, ok: false, notes: `${result.notes ?? ''} principle violation: evidence required`.trim() };
      return result;
    },
  };
}
