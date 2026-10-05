import type { AnalystOutput, EvidenceBullet } from "../src/app/data/macroDebate.js";

export type LLMFailureCode = "configuration" | "network" | "timeout" | "rate-limited" | "authentication" | "provider" | "schema-invalid" | "malformed-output";

export interface LLMProviderConfig {
  providerId: string;
  endpoint: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface LLMCallMetadata {
  providerId: string;
  model: string;
  attemptCount: number;
  retryCount: number;
  temperature: number;
  acceptedStructuredOutput: true;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export class LLMAdapterError extends Error {
  constructor(public readonly code: LLMFailureCode, message: string, public readonly retryable = false) {
    super(message);
    this.name = "LLMAdapterError";
  }
}

const ROLES = new Set(["bull", "bear", "risk"]);
const STRENGTHS = new Set(["strong", "moderate", "weak", "insufficient"]);
const DIRECTIONS = new Set(["up", "down", "flat"]);

function safeEndpoint(endpoint: string): URL {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new LLMAdapterError("configuration", "LLM endpoint is invalid"); }
  if (!(["https:", "http:"].includes(url.protocol)) || (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new LLMAdapterError("configuration", "LLM endpoint must use HTTPS or local HTTP");
  }
  return url;
}

function isEvidenceBullet(value: unknown): value is EvidenceBullet {
  if (!value || typeof value !== "object") return false;
  const bullet = value as Record<string, unknown>;
  return typeof bullet.indicatorId === "string" && typeof bullet.shortName === "string" && typeof bullet.value === "number" && Number.isFinite(bullet.value) && typeof bullet.unit === "string" && typeof bullet.asOf === "string" && typeof bullet.trend === "string" && DIRECTIONS.has(bullet.trend) && typeof bullet.argument === "string" && typeof bullet.sourceName === "string" && (bullet.sourceUrl === null || typeof bullet.sourceUrl === "string") && (bullet.seriesId === null || typeof bullet.seriesId === "string");
}

export function validateStructuredAnalystOutput(value: unknown): AnalystOutput {
  if (!value || typeof value !== "object") throw new LLMAdapterError("schema-invalid", "LLM output must be an object");
  const output = value as Record<string, unknown>;
  if (typeof output.role !== "string" || !ROLES.has(output.role)) throw new LLMAdapterError("schema-invalid", "LLM output role is invalid");
  if (typeof output.thesis !== "string" || !output.thesis.trim()) throw new LLMAdapterError("schema-invalid", "LLM output thesis is missing");
  if (!Array.isArray(output.bullets) || !output.bullets.every(isEvidenceBullet)) throw new LLMAdapterError("schema-invalid", "LLM output evidence bullets are invalid");
  if (typeof output.strength !== "string" || !STRENGTHS.has(output.strength)) throw new LLMAdapterError("schema-invalid", "LLM output strength is invalid");
  if (typeof output.limitation !== "string" || !output.limitation.trim()) throw new LLMAdapterError("schema-invalid", "LLM output limitation is missing");
  return { role: output.role as AnalystOutput["role"], thesis: output.thesis, bullets: output.bullets as EvidenceBullet[], strength: output.strength as AnalystOutput["strength"], limitation: output.limitation };
}

function retryableForStatus(status: number): { code: LLMFailureCode; retryable: boolean } {
  if (status === 408) return { code: "timeout", retryable: true };
  if (status === 429) return { code: "rate-limited", retryable: true };
  if (status === 401 || status === 403) return { code: "authentication", retryable: false };
  if (status >= 500) return { code: "provider", retryable: true };
  return { code: "provider", retryable: false };
}

function parseContent(payload: unknown): unknown {
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new LLMAdapterError("malformed-output", "LLM response content is missing");
  try { return JSON.parse(content); } catch { throw new LLMAdapterError("malformed-output", "LLM response was not valid JSON"); }
}

export async function requestStructuredAnalystOutput(config: LLMProviderConfig, systemPrompt: string, userPrompt: string, fetchImpl: typeof fetch = fetch): Promise<{ output: AnalystOutput; metadata: LLMCallMetadata }> {
  const endpoint = safeEndpoint(config.endpoint);
  if (!config.providerId || !config.model) throw new LLMAdapterError("configuration", "LLM providerId and model are required");
  const maxRetries = Math.min(5, Math.max(0, Math.floor(config.maxRetries ?? 2)));
  const timeoutMs = Math.min(60_000, Math.max(1_000, Math.floor(config.timeoutMs ?? 20_000)));
  const temperature = config.temperature ?? 0.2;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new LLMAdapterError("configuration", "LLM temperature must be between 0 and 2");
  let attemptCount = 0;
  for (let retryCount = 0; retryCount <= maxRetries; retryCount += 1) {
    attemptCount += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("llm-timeout"), timeoutMs);
    try {
      const response = await fetchImpl(endpoint.toString(), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
        body: JSON.stringify({ model: config.model, temperature, max_tokens: config.maxTokens, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], response_format: { type: "json_object" } }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = retryableForStatus(response.status);
        throw new LLMAdapterError(failure.code, `LLM provider returned ${response.status}`, failure.retryable);
      }
      const payload = await response.json() as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } };
      const output = validateStructuredAnalystOutput(parseContent(payload));
      const usage = payload.usage;
      const usageValues = [usage?.prompt_tokens, usage?.completion_tokens, usage?.total_tokens];
      const hasUsage = usageValues.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
      return { output, metadata: { providerId: config.providerId, model: config.model, attemptCount, retryCount, temperature, acceptedStructuredOutput: true, ...(hasUsage ? { usage: { promptTokens: usageValues[0] as number, completionTokens: usageValues[1] as number, totalTokens: usageValues[2] as number } } : {}) } };
    } catch (error) {
      const normalized = error instanceof LLMAdapterError ? error : controller.signal.aborted ? new LLMAdapterError("timeout", "LLM request timed out", true) : new LLMAdapterError("network", "LLM provider request failed", true);
      if (!normalized.retryable || retryCount >= maxRetries) throw normalized;
      const delay = Math.min(2_000, Math.max(0, config.retryDelayMs ?? 50) * (retryCount + 1));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    } finally { clearTimeout(timer); }
  }
  throw new LLMAdapterError("network", "LLM provider request exhausted", true);
}
