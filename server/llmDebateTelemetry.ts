import type { LLMCallMetadata } from "./llmDebateAdapter.js";

export type LLMDebateTelemetry = {
  providerIds: string[];
  modelIds: string[];
  roleCount: number;
  acceptedOutputCount: number;
  totalAttempts: number;
  totalRetries: number;
  temperatures: number[];
  usageAvailable: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  evidence: "llm-orchestration-metadata";
};

export function aggregateLLMDebateTelemetry(metadata: Partial<Record<"bull" | "bear" | "risk", LLMCallMetadata>> | Array<Partial<Record<"bull" | "bear" | "risk", LLMCallMetadata>>>): LLMDebateTelemetry {
  const rows = (Array.isArray(metadata) ? metadata.flatMap((item) => Object.values(item)) : Object.values(metadata)).filter((value): value is LLMCallMetadata => Boolean(value));
  const usageRows = rows.map((row) => row.usage).filter((usage): usage is NonNullable<LLMCallMetadata["usage"]> => Boolean(usage));
  return {
    providerIds: [...new Set(rows.map((row) => row.providerId))].sort(),
    modelIds: [...new Set(rows.map((row) => row.model))].sort(),
    roleCount: rows.length,
    acceptedOutputCount: rows.filter((row) => row.acceptedStructuredOutput).length,
    totalAttempts: rows.reduce((sum, row) => sum + row.attemptCount, 0),
    totalRetries: rows.reduce((sum, row) => sum + row.retryCount, 0),
    temperatures: [...new Set(rows.map((row) => row.temperature))].sort((a, b) => a - b),
    usageAvailable: usageRows.length > 0,
    promptTokens: usageRows.length ? usageRows.reduce((sum, usage) => sum + usage.promptTokens, 0) : null,
    completionTokens: usageRows.length ? usageRows.reduce((sum, usage) => sum + usage.completionTokens, 0) : null,
    totalTokens: usageRows.length ? usageRows.reduce((sum, usage) => sum + usage.totalTokens, 0) : null,
    evidence: "llm-orchestration-metadata",
  };
}
