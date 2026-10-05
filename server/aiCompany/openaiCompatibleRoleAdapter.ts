import type { ModelAdapter, ModelResponse } from './modelAdapter';
import type { ProviderAttemptLedger } from './providerAttemptLedger';
import { ProviderCircuitBreaker } from './providerCircuitBreaker';
import { getRoleContract } from './roleContracts';
import { classifyProviderFailure, ProviderDeadLetterLedger, retryDelayMs } from './providerResilience';

export interface RoleProviderConfig { providerId: string; endpoint: string; model: string; apiKey?: string; timeoutMs: number; maxRetries: number; maxTokens: number; costPer1kInputUsd: number; costPer1kOutputUsd: number; fetchImpl?: typeof fetch; }

function parseConfig(env: Record<string, string | undefined>): RoleProviderConfig | null {
  const endpoint = env.MACRO_LLM_ENDPOINT?.trim(); const model = env.MACRO_LLM_MODEL?.trim();
  if (!endpoint || !model) return null;
  let url: URL; try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
  const numberOr = (key: string, fallback: number) => { const value = Number(env[key] ?? fallback); return Number.isFinite(value) ? value : fallback; };
  const nativeOllama = url.pathname === '/api/chat';
  return { providerId: env.MACRO_LLM_PROVIDER_ID?.trim() || (nativeOllama ? 'ollama-local' : 'openai-compatible'), endpoint: url.toString(), model, apiKey: env.MACRO_LLM_API_KEY, timeoutMs: Math.min(120_000, Math.max(1_000, numberOr('AI_COMPANY_ROLE_TIMEOUT_MS', nativeOllama ? 90_000 : 30_000))), maxRetries: Math.min(3, Math.max(0, Math.floor(numberOr('AI_COMPANY_ROLE_MAX_RETRIES', 1)))), maxTokens: Math.min(2_048, Math.max(32, Math.floor(numberOr('AI_COMPANY_ROLE_MAX_TOKENS', nativeOllama ? 1_024 : 256)))), costPer1kInputUsd: Math.max(0, numberOr('AI_COMPANY_ROLE_INPUT_COST_PER_1K_USD', 0)), costPer1kOutputUsd: Math.max(0, numberOr('AI_COMPANY_ROLE_OUTPUT_COST_PER_1K_USD', 0)) };
}

export function createConfiguredRoleModelAdapter(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch, attemptLedger?: ProviderAttemptLedger, deadLetterLedger?: ProviderDeadLetterLedger): ModelAdapter | null {
  const config = parseConfig(env); if (!config) return null;
  const circuit = new ProviderCircuitBreaker(Math.max(1, Math.floor(Number(env.AI_COMPANY_PROVIDER_FAILURE_THRESHOLD ?? 3))), Math.max(1_000, Number(env.AI_COMPANY_PROVIDER_COOLDOWN_MS ?? 60_000)));
  const circuitThreshold = Math.max(1, Math.floor(Number(env.AI_COMPANY_PROVIDER_FAILURE_THRESHOLD ?? 3)));
  const circuitCooldownMs = Math.max(1_000, Number(env.AI_COMPANY_PROVIDER_COOLDOWN_MS ?? 60_000));
  const complete = async (input: Parameters<ModelAdapter['complete']>[0]): Promise<ModelResponse> => {
    const budget = input.task.budget;
    if (!budget || !Number.isInteger(budget.max_attempts) || budget.max_attempts < 1 || !Number.isFinite(budget.timeout_seconds) || budget.timeout_seconds <= 0) throw new Error('invalid provider task budget');
    const maxRetries = Math.min(config.maxRetries, budget.max_attempts - 1);
    const deadline = Date.now() + budget.timeout_seconds * 1000;
    const tokenBudget = input.task.role_execution?.assignment.token_budget;
    if (tokenBudget !== undefined && (!Number.isFinite(tokenBudget) || tokenBudget < 1)) throw new Error('invalid provider output token budget');
    const maxTokens = Math.min(config.maxTokens, tokenBudget === undefined ? config.maxTokens : Math.floor(tokenBudget));
    const contract = getRoleContract(input.worker_id);
    let roleInstruction = `You are the Macro OS ${contract.title}. Accountable for: ${contract.accountable_for.join('; ')}. Required inputs: ${contract.required_inputs.join('; ')}. Required outputs: ${contract.required_outputs.join('; ')}. You must not self-approve or claim release approval. Return only bounded, evidence-aware work output and state limitations. For PM work, return ONLY compact valid JSON with exactly these fields: role="pm", problem, target_user, product_goal_objective, evidence_ids, facts, assumptions, scope, non_goals, recommendation, confidence, unknowns. PM recommendation MUST be exactly one of PROCEED, REVISE, HOLD, REJECT; never use descriptive prose. Keep every string under 160 characters, every list to at most 2 items, use [] for unknown evidence, and never invent user facts or metrics.`;
    const assignment = input.task.role_execution?.assignment;
    const reviewTask = ['functional-qa', 'quality-control', 'critic', 'security', 'adversarial-reviewer', 'release-security-gate'].includes(input.worker_id) || input.task.task_id.endsWith('-REVIEW') || assignment?.task_type === 'code_review';
    if (reviewTask) roleInstruction += ' For this review task return ONLY valid ReviewVerdict JSON with verdict, gate, summary, evidence (original ID array), failure_class, root_cause, recovery_required (boolean), recovery_actions (array), accountable_role, unblock_evidence (array), retry_budget (nonnegative integer), next_review_trigger and confidence (number from 0 to 1). verdict must be PASS, REVISE, QUALITY_FAIL, HOLD or BLOCKED; PASS cannot require recovery. Cite original supplied evidence IDs; do not create or relabel evidence.';
    else if (['user-persona', 'ux-research', 'stakeholder-panel', 'domain-expert'].includes(input.worker_id)) roleInstruction += ' For this research task return ONLY JSON with research_question, source_reference, finding (nonempty strings) and confidence (explicit number from 0 to 1). Preserve actual source IDs; never invent facts, sources, users or observations.';
    if (input.task.role_execution) roleInstruction += ' Follow the complete role_execution.assignment exactly, including scope, paths, tools, inputs, dependencies and acceptance criteria. receipt_evidence_id, if supplied, identifies only this advisory provider transcript; it is not independent verification. This text-only request supplies no repository input bytes or tool access beyond the actual message. Report missing inputs and uncertainty in your finding/unknowns; never claim unperformed effects or observations.';
    if (attemptLedger) { const persisted = await attemptLedger.circuitState({ projectId: input.task.project_id, providerId: config.providerId, threshold: circuitThreshold, cooldownMs: circuitCooldownMs }); if (persisted.state === 'OPEN') return { ok: false, evidence_ids: [], notes: `provider circuit open: ${JSON.stringify(persisted)}`, usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }; }
    if (!circuit.allow()) return { ok: false, evidence_ids: [], notes: `provider circuit open: ${JSON.stringify(circuit.snapshot())}`, usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } };
    const nativeOllama = new URL(config.endpoint).pathname === '/api/chat';
    let requestCount = 0;
    let lastError = 'provider call failed';
    let lastFailure = classifyProviderFailure({ message: lastError });
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (!circuit.allow()) { lastError = `provider circuit open: ${JSON.stringify(circuit.snapshot())}`; break; }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) { lastError = 'provider task deadline exceeded'; lastFailure = classifyProviderFailure({ message: lastError, timeout: true }); break; }
      const startedAt = Date.now();
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort('role-provider-timeout'), Math.min(config.timeoutMs, remainingMs));
      try {
        requestCount += 1;
        const response = await fetchImpl(config.endpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, signal: controller.signal, body: JSON.stringify(nativeOllama ? { model: config.model, stream: false, think: false, options: { temperature: 0, num_predict: maxTokens }, format: 'json', messages: [{ role: 'system', content: roleInstruction }, { role: 'user', content: JSON.stringify(input.task) }] } : { model: config.model, stream: false, think: false, chat_template_kwargs: { thinking: false }, temperature: 0, max_tokens: maxTokens, messages: [{ role: 'system', content: roleInstruction }, { role: 'user', content: JSON.stringify(input.task) }], response_format: { type: 'json_object' } }) });
        if (!response.ok) { lastError = `provider returned ${response.status}`; circuit.failure(); const classification = classifyProviderFailure({ status: response.status, message: lastError }); lastFailure = classification; const retryable = classification.disposition === 'RETRYABLE' || classification.disposition === 'WAIT_AND_RETRY'; await attemptLedger?.record({ project_id: input.task.project_id, work_id: input.task.task_id, provider_id: config.providerId, model: config.model, attempt: attempt + 1, latency_ms: Date.now() - startedAt, outcome: 'FAILURE', retryable, error: `${classification.failure_class}: ${lastError}`, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }); if (!retryable || attempt === maxRetries) break; await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelayMs(attempt, 250, 5_000), Math.max(0, deadline - Date.now())))); continue; }
        const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; message?: { content?: unknown }; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }; prompt_eval_count?: unknown; eval_count?: unknown };
        if (controller.signal.aborted || Date.now() >= deadline) throw new Error('provider timeout');
        const text = nativeOllama ? payload.message?.content : payload.choices?.[0]?.message?.content; if (typeof text !== 'string' || !text.trim()) { lastError = 'provider returned no text'; lastFailure = classifyProviderFailure({ message: lastError }); circuit.failure(); await attemptLedger?.record({ project_id: input.task.project_id, work_id: input.task.task_id, provider_id: config.providerId, model: config.model, attempt: requestCount, latency_ms: Date.now() - startedAt, outcome: 'FAILURE', retryable: false, error: lastError, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }); break; }
        const inputTokens = nativeOllama ? (typeof payload.prompt_eval_count === 'number' && Number.isFinite(payload.prompt_eval_count) ? payload.prompt_eval_count : 0) : (typeof payload.usage?.prompt_tokens === 'number' && Number.isFinite(payload.usage.prompt_tokens) ? payload.usage.prompt_tokens : 0);
        const outputTokens = nativeOllama ? (typeof payload.eval_count === 'number' && Number.isFinite(payload.eval_count) ? payload.eval_count : 0) : (typeof payload.usage?.completion_tokens === 'number' && Number.isFinite(payload.usage.completion_tokens) ? payload.usage.completion_tokens : 0);
        const estimatedCost = inputTokens / 1000 * config.costPer1kInputUsd + outputTokens / 1000 * config.costPer1kOutputUsd;
        circuit.success(); await attemptLedger?.record({ project_id: input.task.project_id, work_id: input.task.task_id, provider_id: config.providerId, model: config.model, attempt: attempt + 1, latency_ms: Date.now() - startedAt, outcome: 'SUCCESS', retryable: false, input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_usd: estimatedCost });
        return { ok: true, evidence_ids: [], text, usage: { input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_usd: estimatedCost } };
      } catch (error: unknown) { lastError = controller.signal.aborted ? 'provider timeout' : error instanceof Error ? error.message : String(error); lastFailure = classifyProviderFailure({ message: lastError, timeout: controller.signal.aborted }); circuit.failure(); }
      finally { clearTimeout(timer); }
      await attemptLedger?.record({ project_id: input.task.project_id, work_id: input.task.task_id, provider_id: config.providerId, model: config.model, attempt: attempt + 1, latency_ms: Date.now() - startedAt, outcome: 'FAILURE', retryable: attempt < maxRetries && Date.now() < deadline && ['RETRYABLE', 'WAIT_AND_RETRY'].includes(lastFailure.disposition), error: lastError, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });
      if (!['RETRYABLE', 'WAIT_AND_RETRY'].includes(lastFailure.disposition)) break;
    }
    await deadLetterLedger?.record({ project_id: input.task.project_id, work_id: input.task.task_id, provider_id: config.providerId, model: config.model, failure_class: lastFailure.failure_class, reason: lastError, attempt: requestCount, next_action: lastFailure.disposition === 'WAIT_AND_RETRY' ? 'wait for provider recovery before retrying' : 'hold task for classified provider failure', required_intervention: lastFailure.disposition === 'REQUIRES_CREDENTIAL' ? 'credential or provider configuration' : null });
    return { ok: false, evidence_ids: [], notes: lastError, usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } };
  };
  return { id: `${config.providerId}:${config.model}`, complete };
}
