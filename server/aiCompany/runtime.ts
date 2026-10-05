import type { IEvidenceResolver } from './evidenceResolver';
import { createConfiguredCeoBriefPipeline } from './composition';
import type { CompanyHealth } from './healthMetrics';
import { resolve } from 'node:path';
import { BacklogLedger } from './backlogLedger';
import { CompanySupervisor } from './companySupervisor';
import { OutcomeLedger, evaluateVerifiedCycleValue } from './outcomeLedger';
import { runProductOperatingCycle } from './productOperatingCycle';
import { ProductCycleScheduler } from './productCycleScheduler';
import { planBacklogWork, planCadenceGovernanceWork, planIndependentReviews, planPreReleaseReviews, planResearchWork } from './backlogWorkPlanner';
import { RoleWorkQueue } from './roleWorkQueue';
import type { RoleWorkExecutor } from './roleWorkExecutor';
import { executeReadyRoleWork } from './roleWorkExecutor';
import { RoleWorkExecutionLedger } from './roleWorkExecutionLedger';
import { generateDiscoveryIdea, type DiscoveryEvidence, type DiscoveryWorkerConfig } from './localDiscoveryWorker';
import { discoverTelemetryOpportunity, materializeTelemetryOpportunityBacklog } from './productOpportunityProbe';
import { recordPostReleaseIncident } from './postReleaseMonitor';
import { CompetitiveEvidenceLedger } from './competitiveEvidenceLedger';
import { createCompetitiveReviewActions } from './competitiveAction';
import { CeoReviewLedger } from './ceoReviewLedger';
import { IdeaLedger, promoteAcceptedIdea } from './ideaLedger';
import { ResearchSignalLedger } from './researchSignalLedger';
import { synthesizeCompletedResearch } from './researchSynthesis';
import { createCeoEscalations, EscalationLedger } from './escalationLedger';
import { ProductCycleAttemptLedger } from './productCycleAttemptLedger';
import { DiscoveryAttemptLedger } from './discoveryAttemptLedger';
import { cadencePolicyFor } from './operatingCadence';
import { evaluateCadenceQuorum } from './cadenceQuorum';
import { RoleHandoffLedger } from './roleHandoffLedger';
import { getRoleContract, type CompanyRoleId } from './roleContracts';
import { CeoGuildDecisionLedger } from './ceoGuildDecision';
import { DurableSupervisorState } from './durableSupervisor';
import { WaitWakeLedger } from './waitWake';
import { readFile } from 'node:fs/promises';

async function canonicalSprintBacklog(projectId: string) {
  try {
    const payload = JSON.parse(await readFile(resolve('.ai-company/product-intelligence/CANONICAL_PRODUCT_BACKLOG.json'), 'utf8')) as { items?: Array<Record<string, unknown>> };
    return (payload.items ?? []).filter((item) => item.project_id === projectId && item.status === 'SPRINT_SELECTED' && item.pm_review_status === 'APPROVED' && typeof item.sprint_id === 'string');
  } catch { return []; }
}

async function materializeRoleHandoffs(projectId: string, queue: RoleWorkQueue, handoffs: RoleHandoffLedger) {
  const work = await queue.records(projectId);
  // The handoff ledger is JSONL-backed. Read its identity set once per
  // materialization pass; calling record() for every historical item would
  // otherwise rescan the entire ledger O(n²) on every supervisor tick.
  const existingHandoffs = new Set((await handoffs.records(projectId)).map((item) => item.handoff_id));
  for (const item of work) {
    const dependencies = item.depends_on?.length ? item.depends_on : [undefined];
    for (const dependencyId of dependencies) {
      const upstream = dependencyId ? work.find((candidate) => candidate.work_id === dependencyId) : undefined;
      const fromRole = upstream?.role && upstream.role !== item.role ? upstream.role : item.role === 'ceo' ? 'pm' : 'ceo';
      if (fromRole === item.role) continue;
      const handoffId = `HANDOFF:${item.work_id}:${fromRole}:${item.role}`;
      if (existingHandoffs.has(handoffId)) continue;
      const sourceContract = getRoleContract(fromRole as CompanyRoleId);
      const targetContract = getRoleContract(item.role);
      await handoffs.record({
        handoff_id: handoffId,
        project_id: projectId,
        work_id: item.work_id,
        from_role: fromRole as CompanyRoleId,
        to_role: item.role,
        actor: `${fromRole}-coordinator`,
        objective: `Coordinate ${item.title}`,
        context: [`upstream role: ${sourceContract.title}`, `receiving role: ${targetContract.title}`, `dependency: ${dependencyId ?? 'backlog contract'}`],
        evidence_ids: [dependencyId ?? `BACKLOG-CONTRACT:${item.backlog_id}`],
        acceptance_criteria: [`${targetContract.title} accepts the scoped work`, 'required evidence is attached before completion'],
      });
      existingHandoffs.add(handoffId);
    }
  }
}

export function startCeoBriefRuntime(input: { health: () => Promise<CompanyHealth>; env?: NodeJS.ProcessEnv; intervalMs?: number; transport?: ConstructorParameters<typeof import('./telegramApi').TelegramApi>[0] }) {
  const pipeline = createConfiguredCeoBriefPipeline({ health: input.health, env: input.env, transport: input.transport });
  if (!pipeline) return { enabled: false, stop: () => undefined };
  const timer = setInterval(() => { void pipeline.tick().catch(() => undefined); }, input.intervalMs ?? 60_000);
  timer.unref?.();
  return { enabled: true, stop: () => clearInterval(timer) };
}

export function createProductCompanyRuntime(input: { projectId: string; stateDir?: string; now?: () => Date; intervalMs?: number; taskId?: string; onCycle?: (period: Parameters<NonNullable<ConstructorParameters<typeof ProductCycleScheduler>[0]>['run']>[0]) => Promise<void> | void; readinessGate?: () => Promise<{ ready: boolean; blockers: string[] }>; health?: () => Promise<CompanyHealth>; roleWorkExecutor?: RoleWorkExecutor; evidenceResolver?: IEvidenceResolver; requireVerifiedCycleValue?: boolean; discovery?: { config: DiscoveryWorkerConfig; productGoal: string; evidence: () => Promise<DiscoveryEvidence[]> } }) {
  if (process.env.NODE_ENV === 'production' && !input.readinessGate) throw new Error('production product runtime requires readiness gate');
  const root = resolve(input.stateDir ?? '.ai-company/runtime', 'projects', input.projectId);
  const durableSupervisor = new DurableSupervisorState(root);
  const waitWake = new WaitWakeLedger(root);
  let readinessSnapshot = { ready: !input.readinessGate, blockers: input.readinessGate ? ['readiness has not been checked'] : [], checkedAt: null as string | null };
  const checkReadiness = async () => {
    try {
      const result = await input.readinessGate?.() ?? { ready: true, blockers: [] };
      readinessSnapshot = { ...result, checkedAt: new Date().toISOString() };
      return result;
    } catch (error: unknown) {
      const blocker = `readiness probe failed: ${error instanceof Error ? error.message : String(error)}`;
      const result = { ready: false, blockers: [blocker] };
      readinessSnapshot = { ...result, checkedAt: new Date().toISOString() };
      return result;
    }
  };
  const outcomes = new OutcomeLedger(root);
  const backlog = new BacklogLedger(root);
  const queue = new RoleWorkQueue(root, input.evidenceResolver);
  if (input.roleWorkExecutor) queue.assertEvidenceResolutionConfigured();
  const handoffs = new RoleHandoffLedger(root);
  const ceoGuild = new CeoGuildDecisionLedger(root);
  const requireVerifiedCycleValue = input.requireVerifiedCycleValue ?? process.env.AI_COMPANY_REQUIRE_VERIFIED_CYCLE_VALUE === 'true';
  const executions = new RoleWorkExecutionLedger(root);
  const cycleAttempts = new ProductCycleAttemptLedger(root);
  const discoveryAttempts = new DiscoveryAttemptLedger(root);
  const localOllama = (() => { try { return new URL(process.env.MACRO_LLM_ENDPOINT ?? '').pathname === '/api/chat'; } catch { return false; } })();
  const scheduler = new ProductCycleScheduler({
    projectId: input.projectId,
    now: input.now,
    reportDir: root,
    run: async (period) => {
      // Resolve due waits before doing new company work. This keeps the wait
      // ledger part of the supervisor's real execution path rather than a
      // passive audit log.
      for (const condition of await waitWake.due(new Date())) await waitWake.resume(condition.wait_id);
      const startedAt = new Date().toISOString();
      const cadencePolicy = cadencePolicyFor(period);
      const cadenceEvidence = { cadence: cadencePolicy.cadence, accountable_roles: cadencePolicy.accountable_roles, required_evidence: cadencePolicy.required_evidence };
      // Agenda creation is governance work, not a production-readiness claim.
      // Keep the company guild visible and actionable even when delivery is
      // blocked by storage, backup, provider, or release gates.
      await planCadenceGovernanceWork({ projectId: input.projectId, cadence: period, queue });
      const telemetryOpportunity = await discoverTelemetryOpportunity(resolve(input.stateDir ?? '.ai-company/runtime'));
      if (telemetryOpportunity) await materializeTelemetryOpportunityBacklog(backlog, telemetryOpportunity);
      const ideas = await new IdeaLedger(root).records(input.projectId);
      const guildDecisions = await ceoGuild.records(input.projectId);
      for (const idea of ideas.filter((candidate) => candidate.status === 'ACCEPTED' && guildDecisions.some((decision) => decision.subject_id === candidate.idea_id && decision.action === 'ACCEPT'))) await promoteAcceptedIdea(new IdeaLedger(root), backlog, idea.idea_id);
      await planBacklogWork({ projectId: input.projectId, items: [...await backlog.items(input.projectId), ...await canonicalSprintBacklog(input.projectId)] as any, queue });
      await materializeRoleHandoffs(input.projectId, queue, handoffs);
      const readiness = await checkReadiness();
      if (!readiness.ready) {
        const error = `product cycle blocked by readiness gate: ${readiness.blockers.join('; ')}`;
        await cycleAttempts.record({ project_id: input.projectId, period, started_at: startedAt, completed_at: new Date().toISOString(), status: 'BLOCKED', blockers: readiness.blockers, error, cadence_policy: cadenceEvidence });
        throw new Error(error);
      }
      try {
      await input.onCycle?.(period);
      const result = await runProductOperatingCycle({ projectId: input.projectId, taskId: input.taskId ?? `cycle-${period}`, outcomeLedger: outcomes, backlogLedger: backlog, period });
      if (requireVerifiedCycleValue) {
        const value = evaluateVerifiedCycleValue(await outcomes.records(input.projectId));
        if (!value.verified) throw new Error('cycle has no verified product improvement or evidence-backed learning');
      }
      await planIndependentReviews({ projectId: input.projectId, queue });
      await planPreReleaseReviews({ projectId: input.projectId, queue });
      if (input.health) await recordPostReleaseIncident({ projectId: input.projectId, health: await input.health(), ledger: backlog });
      await createCompetitiveReviewActions({ projectId: input.projectId, evidence: new CompetitiveEvidenceLedger(root), backlog });
      await planResearchWork({ projectId: input.projectId, ideas: await new IdeaLedger(root).records(input.projectId), queue });
      await materializeRoleHandoffs(input.projectId, queue, handoffs);
      if (input.roleWorkExecutor) {
        const execution = await executeReadyRoleWork({ projectId: input.projectId, queue, handoffs, execute: input.roleWorkExecutor, maxConcurrent: Number(process.env.AI_COMPANY_ROLE_MAX_CONCURRENCY ?? (localOllama ? 1 : 4)), maxDurationMs: Number(process.env.AI_COMPANY_ROLE_MAX_DURATION_MS ?? (localOllama ? 600_000 : 120_000)) });
        for (const item of execution.completed) await executions.record({ work_id: item.work_id, project_id: item.project_id, role: item.role, owner: item.owner, status: 'DONE', evidence_ids: item.evidence_ids });
        for (const item of execution.blocked) await executions.record({ work_id: item.work_id, project_id: item.project_id, role: item.role, owner: item.owner, status: 'BLOCKED', evidence_ids: [], error: item.blocked_reason });
        if (execution.blocked.length) throw new Error(`role execution blocked: ${execution.blocked.map((item) => `${item.role}: ${item.blocked_reason}`).join('; ')}`);
        const quorum = evaluateCadenceQuorum({ cadence: period, authority: await queue.currentAuthority(input.projectId) });
        if (!quorum.ok) throw new Error(`cadence quorum blocked: ${quorum.blockers.join('; ')}`);
      }
      if (input.discovery) {
        let evidenceCount = 0;
        try { const evidence = await input.discovery.evidence(); evidenceCount = evidence.length; const idea = await generateDiscoveryIdea(input.discovery.config, { projectId: input.projectId, productGoal: input.discovery.productGoal, evidence }); await new IdeaLedger(root).add(idea); await discoveryAttempts.record({ project_id: input.projectId, provider: new URL(input.discovery.config.endpoint).hostname, model: input.discovery.config.model, status: 'SUCCEEDED', evidence_count: evidenceCount, idea_id: idea.idea_id }); }
        catch (error: unknown) { await discoveryAttempts.record({ project_id: input.projectId, provider: new URL(input.discovery.config.endpoint).hostname, model: input.discovery.config.model, status: 'FAILED', evidence_count: evidenceCount, error: error instanceof Error ? error.message : String(error) }); throw error; }
      }
      const researchLedger = new ResearchSignalLedger(root);
      await synthesizeCompletedResearch({ projectId: input.projectId, authority: await queue.currentAuthority(input.projectId), ledger: researchLedger });
      const review = await new CeoReviewLedger(root).review({ projectId: input.projectId, period: `${period}:${new Date().toISOString().slice(0, 10)}`, ideas: await new IdeaLedger(root).records(input.projectId), researchSignals: await researchLedger.records(input.projectId), authority: await queue.currentAuthority(input.projectId) });
      await createCeoEscalations(review, new EscalationLedger(root));
      await cycleAttempts.record({ project_id: input.projectId, period, started_at: startedAt, completed_at: new Date().toISOString(), status: 'DONE', cadence_policy: cadenceEvidence });
      return result;
      } catch (error: unknown) {
        await cycleAttempts.record({ project_id: input.projectId, period, started_at: startedAt, completed_at: new Date().toISOString(), status: 'FAILED', error: error instanceof Error ? error.message : String(error), cadence_policy: cadenceEvidence });
        throw error;
      }
    },
  });
  const prepareProductWork = async () => {
    const telemetryOpportunity = await discoverTelemetryOpportunity(resolve(input.stateDir ?? '.ai-company/runtime'));
    if (telemetryOpportunity) await materializeTelemetryOpportunityBacklog(backlog, telemetryOpportunity);
    const currentWork = await queue.records(input.projectId);
    for (const item of currentWork.filter((candidate) => candidate.state === 'BLOCKED' && candidate.role === 'pm' && candidate.backlog_id?.startsWith('PM_REVIEW:') && (candidate.blocked_reason ?? '').toLowerCase().includes('structured output'))) {
      try { await queue.requeueBlocked(item.work_id); } catch { /* bounded retry marker prevents loops */ }
    }
    const planned = await planBacklogWork({ projectId: input.projectId, items: [...await backlog.items(input.projectId), ...await canonicalSprintBacklog(input.projectId)] as any, queue });
    await materializeRoleHandoffs(input.projectId, queue, handoffs);
    const currentAfterPlanning = await queue.records(input.projectId);
    const hasRunnableOrBlockedWork = currentAfterPlanning.some((item) => item.state === 'READY' || item.state === 'CLAIMED' || item.state === 'IN_REVIEW' || item.state === 'BLOCKED');
    if (!planned.created.length && !hasRunnableOrBlockedWork) {
      const workflowId = `product-runtime:${input.projectId}`;
      const activeWait = (await waitWake.records()).find((item) => item.workflow_id === workflowId && !item.resumed_at);
      if (!activeWait) {
        await waitWake.wait({
          project_id: input.projectId,
          workflow_id: workflowId,
          state: 'AWAITING_SCHEDULE',
          wake_type: 'TIMER',
          wake_condition: 're-evaluate product backlog and current evidence',
          earliest_time: new Date(Date.now() + 15 * 60_000).toISOString(),
          deadline: null,
          evidence_required: [],
          next_action: 're-read current evidence and PM-approved backlog before creating executable work',
        });
      }
    }
    for (const completed of currentAfterPlanning.filter((item) => item.backlog_id === 'BL-TELEMETRY-COMPARE-EXPLANATION' && item.state === 'DONE')) {
      const reviewBacklogId = `${completed.backlog_id}:review:quality-control`;
      if (!currentAfterPlanning.some((item) => item.backlog_id === reviewBacklogId && item.role === 'quality-control')) await queue.create({ project_id: input.projectId, backlog_id: reviewBacklogId, title: `Independent QC: ${completed.title}`, role: 'quality-control', depends_on: [completed.work_id] });
    }
    await materializeRoleHandoffs(input.projectId, queue, handoffs);
    return planned;
  };
  const executeReadyRuntimeWork = async () => {
    if (!input.roleWorkExecutor) return null;
    const execution = await executeReadyRoleWork({ projectId: input.projectId, queue, handoffs, execute: input.roleWorkExecutor, maxConcurrent: Number(process.env.AI_COMPANY_ROLE_MAX_CONCURRENCY ?? (localOllama ? 1 : 4)), maxDurationMs: Number(process.env.AI_COMPANY_ROLE_MAX_DURATION_MS ?? (localOllama ? 600_000 : 120_000)) });
    for (const item of execution.completed) await executions.record({ work_id: item.work_id, project_id: item.project_id, role: item.role, owner: item.owner, status: 'DONE', evidence_ids: item.evidence_ids });
    for (const item of execution.blocked) await executions.record({ work_id: item.work_id, project_id: item.project_id, role: item.role, owner: item.owner, status: 'BLOCKED', evidence_ids: [], error: item.blocked_reason });
    return execution;
  };
  const supervisor = new CompanySupervisor([{ id: `product-cycle:${input.projectId}`, tick: async () => ({ scheduled: await (async () => { await prepareProductWork(); return scheduler.tick(); })(), execution: await executeReadyRuntimeWork() }) }], input.intervalMs);
  const ownerId = `product-cycle:${input.projectId}:${process.pid}`;
  let readinessRetryTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  const attemptStart = async () => {
    const readiness = await checkReadiness();
    if (!readiness.ready) {
      await durableSupervisor.checkpoint({ run_id: null, namespace: null, status: 'WAITING_RESOURCE', next_action: 're-check readiness and resume product runtime when the configured LLM and role executor are available', payload: { blockers: readiness.blockers } });
      const activeWait = (await waitWake.records()).find((item) => item.workflow_id === `product-runtime:${input.projectId}:readiness` && !item.resumed_at);
      if (!activeWait) await waitWake.wait({ project_id: input.projectId, workflow_id: `product-runtime:${input.projectId}:readiness`, state: readiness.blockers.some((blocker) => blocker.toLowerCase().includes('credential')) ? 'AWAITING_CREDENTIAL' : 'AWAITING_PROVIDER', wake_type: 'TIMER', wake_condition: 're-check runtime readiness', earliest_time: new Date(Date.now() + 15 * 60_000).toISOString(), deadline: null, evidence_required: [], next_action: 're-run readiness probe; start the company supervisor when provider configuration is valid' });
      return false;
    }
    const readinessWait = (await waitWake.records()).find((item) => item.workflow_id === `product-runtime:${input.projectId}:readiness` && !item.resumed_at);
    if (readinessWait) await waitWake.resume(readinessWait.wait_id);
    if (started) return true;
    const reconciliation = await durableSupervisor.reconcile();
    if (reconciliation.lease === 'ACTIVE') return false;
    await durableSupervisor.acquire(ownerId);
    await durableSupervisor.checkpoint({ run_id: reconciliation.checkpoint?.run_id ?? null, namespace: reconciliation.checkpoint?.namespace ?? null, status: 'RUNNING', next_action: reconciliation.checkpoint?.next_action ?? 'schedule product cycle' });
    supervisor.start();
    started = true;
    if (readinessRetryTimer) clearInterval(readinessRetryTimer);
    return true;
  };
  const wake = async (event?: string) => {
    const due = await waitWake.due(new Date(), event);
    for (const condition of due) await waitWake.resume(condition.wait_id);
    return { resumed: due.map((condition) => condition.wait_id), results: due.length ? await supervisor.tick() : [] };
  };
  return { supervisor, scheduler, durableSupervisor, waitWake, outcomeLedger: outcomes, backlogLedger: backlog, workQueue: queue, handoffLedger: handoffs, ceoGuildDecisionLedger: ceoGuild, executionLedger: executions, cycleAttemptLedger: cycleAttempts, discoveryAttemptLedger: discoveryAttempts, readiness: () => readinessSnapshot, refreshReadiness: checkReadiness, wake, start: () => { void attemptStart().catch(() => undefined); if (!readinessRetryTimer) { readinessRetryTimer = setInterval(() => { void attemptStart().catch(() => undefined); }, 15 * 60_000); readinessRetryTimer.unref?.(); } }, stop: () => { if (readinessRetryTimer) clearInterval(readinessRetryTimer); supervisor.stop(); void durableSupervisor.release(ownerId); }, tick: () => supervisor.tick() };
}
