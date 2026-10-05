import type { ProductIdea } from './ideaLedger';
import { createHash } from 'node:crypto';

export interface DiscoveryEvidence { evidence_id: string; summary: string; source_url?: string | null; }
export interface DiscoveryWorkerConfig { endpoint: string; model: string; timeoutMs?: number; fetchImpl?: typeof fetch; }

function parseIdea(value: unknown, projectId: string, evidence: DiscoveryEvidence[]): Omit<ProductIdea, 'created_at'> {
  if (!value || typeof value !== 'object') throw new Error('discovery output must be an object');
  const row = value as Record<string, unknown>;
  const required = ['title', 'problem', 'target_persona', 'product_goal_reference', 'differentiation_hypothesis', 'validation_metric'];
  if (required.some((key) => typeof row[key] !== 'string' || !(row[key] as string).trim())) throw new Error('discovery output is missing a required field');
  const fingerprint = createHash('sha256').update(JSON.stringify({ projectId, evidence: evidence.map((item) => ({ evidence_id: item.evidence_id, summary: item.summary })), title: row.title, problem: row.problem })).digest('hex').slice(0, 16);
  return { idea_id: `AI-DISCOVERY-${fingerprint}`, project_id: projectId, title: row.title as string, problem: row.problem as string, target_persona: row.target_persona as string, product_goal_reference: row.product_goal_reference as string, differentiation_hypothesis: row.differentiation_hypothesis as string, validation_metric: row.validation_metric as string, status: 'DISCOVERED' };
}

export async function generateDiscoveryIdea(config: DiscoveryWorkerConfig, input: { projectId: string; productGoal: string; evidence: DiscoveryEvidence[] }): Promise<Omit<ProductIdea, 'created_at'>> {
  if (!input.evidence.length) throw new Error('discovery requires server-owned evidence');
  if (input.evidence.some((item) => !item.evidence_id?.trim() || !item.summary?.trim())) throw new Error('discovery evidence must have an ID and summary');
  if (!input.projectId.trim() || !input.productGoal.trim()) throw new Error('discovery project and product goal are required');
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) throw new Error('discovery endpoint must use HTTPS or local HTTP');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(60_000, Math.max(1_000, config.timeoutMs ?? 30_000)));
  try {
    const response = await (config.fetchImpl ?? fetch)(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: config.model, stream: false, think: false, format: 'json', options: { temperature: 0, num_predict: 512 }, messages: [{ role: 'system', content: `You are Macro OS discovery PM. Return exactly one JSON object and no commentary. It MUST contain these six non-empty string fields: title, problem, target_persona, product_goal_reference, differentiation_hypothesis, validation_metric. Use only the supplied evidence and do not invent facts. Product Goal: ${input.productGoal}` }, { role: 'user', content: JSON.stringify({ task: 'propose one evidence-grounded product idea', evidence: input.evidence }) }] }) });
    if (!response.ok) throw new Error(`discovery provider returned ${response.status}`);
    const payload = await response.json() as { message?: { content?: unknown } };
    if (typeof payload.message?.content !== 'string') throw new Error('discovery provider returned no structured content');
    return parseIdea(JSON.parse(payload.message.content), input.projectId, input.evidence);
  } finally { clearTimeout(timer); }
}
