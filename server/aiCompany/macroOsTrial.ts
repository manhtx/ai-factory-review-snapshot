import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BoundedOrchestrator, type OrchestratorResult } from './orchestrator';
import { CompanyStateStore } from './stateStore';
import { UsageLedger } from './usageLedger';
import { computeCompanyHealth, type CompanyHealth } from './healthMetrics';
import { FeedbackLedger, runIndependentCouncil } from './council';
import { BacklogLedger } from './backlogLedger';
import { runPmCeoBacklogPipeline } from './backlogPipeline';
import { proposeOptimizations, type OptimizationProposal } from './optimizationPlanner';
import { AgentPrinciplesLedger, updatePrinciplesFromHealth } from './agentPrinciples';
import { withAgentPrinciples } from './principledWorker';
import { computeTrialQuality, type TrialQualityMetrics } from './trialMetrics';

export interface MacroOsWorkerBehavior {
  /** Explicit experiment hook; production workers must not depend on this. */
  (input: { agent_id: string; round: number; failing: boolean; has_principles: boolean; scenario_id: string }): { ok?: boolean; evidence_ids?: string[]; notes?: string };
}

export interface MacroOsTrialReport { rounds: number; scenario_id: string; results: OrchestratorResult[]; health: CompanyHealth; quality: TrialQualityMetrics; proposals: OptimizationProposal[]; backlog_decisions: number; principle_updates: number; }

/** Local, repeatable Macro OS trial used to validate the company loop before live deployment. */
export async function runMacroOsTrials(input: { rounds: number; scenarioId?: string; injectFailureRound?: number; principlesImproveBehavior?: boolean; workerBehavior?: MacroOsWorkerBehavior }): Promise<MacroOsTrialReport> {
  const scenarioId = input.scenarioId ?? 'generic';
  const root = await mkdtemp(path.join(os.tmpdir(), 'macro-os-trials-'));
  const store = new CompanyStateStore(root); const usage = new UsageLedger(root); const feedback = new FeedbackLedger(root); const backlog = new BacklogLedger(root); const results: OrchestratorResult[] = []; const allFeedback = [];
  const principlesLedger = new AgentPrinciplesLedger(root);
  for (let round = 1; round <= input.rounds; round += 1) {
    const taskId = `macro-os:trial-${round}`;
    const priorPrinciples = Object.fromEntries((await principlesLedger.records()).map((item) => [item.agent_id, item.principles]));
    const workers = ['coder', 'functional-qa', 'ux-research', 'domain-expert'].map((id) => {
      const failing = input.injectFailureRound === round && id === 'functional-qa';
      const defaultResult = { worker_id: id, ok: failing ? false : true, evidence_ids: failing ? [] : (input.principlesImproveBehavior && priorPrinciples[id] ? [`E-${scenarioId}-${round}-${id}-principled`] : [`E-${scenarioId}-${round}-${id}`]), notes: failing ? 'injected trial failure' : undefined };
      const worker = { id, run: async () => ({ ...defaultResult, ...(input.workerBehavior?.({ agent_id: id, round, failing, has_principles: Boolean(priorPrinciples[id]), scenario_id: scenarioId }) ?? {}) }) };
      return priorPrinciples[id] ? withAgentPrinciples(worker, priorPrinciples[id]) : worker;
    });
    const result = await new BoundedOrchestrator(store, workers, usage, undefined, undefined, async () => ({ ready: true, blockers: [] })).run({ task_id: taskId, project_id: 'macro-os', risk_level: 'P2', acceptance_criteria: ['trial outcome recorded'], budget: { max_attempts: 1, timeout_seconds: 1 }, agent_principles: priorPrinciples });
    results.push(result);
    const councilFeedback = await runIndependentCouncil({ task_id: taskId, project_id: 'macro-os', artifact_ids: result.workers.flatMap((worker) => worker.evidence_ids), question: 'is this trial outcome usable?' }, [{ council_id: 'macro-user', review: async (brief) => ({ task_id: brief.task_id, project_id: brief.project_id, verdict: result.status === 'RELEASED' ? 'ACCEPT' : 'REVISE', findings: result.status === 'RELEASED' ? [] : ['investigate trial failure'], confidence: .9, evidence_ids: brief.artifact_ids }) }], feedback);
    allFeedback.push(...councilFeedback);
    if (councilFeedback.length) await runPmCeoBacklogPipeline({ projectId: 'macro-os', taskId, feedback: councilFeedback, ledger: backlog });
  }
  const health = computeCompanyHealth(await store.events(), await usage.records());
  const principleUpdates = await updatePrinciplesFromHealth(principlesLedger, health);
  return { rounds: input.rounds, scenario_id: scenarioId, results, health, quality: computeTrialQuality(allFeedback), proposals: proposeOptimizations(health), backlog_decisions: (await backlog.decisions('macro-os')).length, principle_updates: principleUpdates.length };
}
