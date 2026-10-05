import type { Indicator } from "../src/app/data/types.js";
import { runMacroDebate, type AnalystOutput, type DebatePrediction, type DebateSession } from "../src/app/data/macroDebate.js";
import { requestStructuredAnalystOutput, type LLMCallMetadata, type LLMProviderConfig } from "./llmDebateAdapter.js";
import type { QualitativeEvidenceItem } from "./qualitativeEvidence.js";
import type { ResearchMemoryRecord } from "./researchMemory.js";
import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";
import { validateGroundedAnalystOutput } from "./groundedLLMOutput.js";

export type DebateBackend = "deterministic" | "mixed" | "llm";

export interface LLMRunResult {
  session: DebateSession;
  backend: DebateBackend;
  roleMetadata: Partial<Record<AnalystOutput["role"], LLMCallMetadata>>;
  roleFallbacks: AnalystOutput["role"][];
  limitation: string;
}

export function configuredLLMProvider(env: Record<string, string | undefined> = process.env): LLMProviderConfig | null {
  const endpoint = env.MACRO_LLM_ENDPOINT?.trim();
  const model = env.MACRO_LLM_MODEL?.trim();
  if (!endpoint && !model) return null;
  if (!endpoint || !model) throw new Error("MACRO_LLM_ENDPOINT and MACRO_LLM_MODEL must be configured together");
  return {
    providerId: env.MACRO_LLM_PROVIDER_ID?.trim() || "openai-compatible",
    endpoint,
    model,
    apiKey: env.MACRO_LLM_API_KEY,
    temperature: env.MACRO_LLM_TEMPERATURE ? Number(env.MACRO_LLM_TEMPERATURE) : 0.2,
    maxTokens: env.MACRO_LLM_MAX_TOKENS ? Number(env.MACRO_LLM_MAX_TOKENS) : undefined,
    maxRetries: env.MACRO_LLM_MAX_RETRIES ? Number(env.MACRO_LLM_MAX_RETRIES) : 2,
  };
}

export function buildResearchMemoryContext(memory: ResearchMemoryRecord[], limit = 5) {
  const items = [...memory]
    .filter((record) => record.actualStatus === "actual-verified-source-backed")
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate) || b.version - a.version || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.floor(limit)))
    .map(({ id, indicatorId, targetDate, predictionValue, actualValue, error, absolutePercentageError, predictedDirection, actualDirection, directionCorrect, predictionSource, lesson }) => ({ id, indicatorId, targetDate, predictionValue, actualValue, error, absolutePercentageError, predictedDirection, actualDirection, directionCorrect, predictionSource, lesson }));
  const content = { items, totalAvailable: memory.length, limitation: "Historical outcomes are descriptive context only; they are not a model score, causal claim, current actual, or trading signal." };
  return { ...content, fingerprint: deterministicFingerprint(content) };
}

function evidencePrompt(session: DebateSession, role: AnalystOutput["role"], qualitativeContext: QualitativeEvidenceItem[] = [], researchMemory: ReturnType<typeof buildResearchMemoryContext> = buildResearchMemoryContext([])): string {
  return JSON.stringify({
    role,
    instruction: role === "bull" ? "Build the strongest evidence-backed case supporting the recorded prediction." : role === "bear" ? "Build the strongest evidence-backed case contesting the recorded prediction." : "Identify risks, contradictions and limitations in both cases and the recorded prediction.",
    prediction: session.prediction,
    snapshot: session.currentSnapshot,
    deterministicEvidence: { bullCase: session.bullCase, bearCase: session.bearCase, riskAnalysis: session.riskAnalysis, riskFlags: session.riskFlags },
    qualitativeContext: qualitativeContext.map(({ id, providerId, publisher, url, headline, excerpt, publishedAt, topic, sentiment, dataState }) => ({ id, providerId, publisher, url, headline, excerpt, publishedAt, topic, sentiment, dataState })),
    researchMemory,
    outputRules: ["Return only the requested JSON object.", "Use only supplied quantitative evidence bullets; do not invent observations or sources.", "Qualitative context may inform thesis, risk discussion or limitation, but must never be converted into a numeric evidence bullet.", "Keep sourceUrl and seriesId exactly as supplied or null.", "This is bounded macro research opinion, not trading advice."],
  });
}

export async function runOptionalLLMDebate(
  indicator: Indicator,
  prediction: DebatePrediction,
  relatedIndicators: Indicator[],
  config: LLMProviderConfig | null,
  fetchImpl: typeof fetch = fetch,
  qualitativeContext: QualitativeEvidenceItem[] = [],
  researchMemory: ResearchMemoryRecord[] = [],
): Promise<LLMRunResult> {
  const session = runMacroDebate(indicator, prediction, relatedIndicators);
  const memoryContext = buildResearchMemoryContext(researchMemory);
  if (!config) return { session, backend: "deterministic", roleMetadata: {}, roleFallbacks: [], limitation: "LLM provider is not configured; deterministic evidence debate was used." };

  const outputs: Partial<Record<AnalystOutput["role"], AnalystOutput>> = {};
  const roleMetadata: Partial<Record<AnalystOutput["role"], LLMCallMetadata>> = {};
  const roleFallbacks: AnalystOutput["role"][] = [];
  const basePrompts: Record<AnalystOutput["role"], string> = {
    bull: "You are the Bull Researcher in a macro research debate.",
    bear: "You are the Bear Researcher in a macro research debate.",
    risk: "You are the Risk Analyst in a macro research debate.",
  };
  const baseline: Record<AnalystOutput["role"], AnalystOutput> = { bull: session.bullCase, bear: session.bearCase, risk: session.riskAnalysis };
  for (const role of ["bull", "bear", "risk"] as const) {
    try {
      const result = await requestStructuredAnalystOutput(config, `${basePrompts[role]} Follow the Macro OS evidence contract.`, evidencePrompt(session, role, qualitativeContext, memoryContext), fetchImpl);
      if (result.output.role !== role) throw new Error(`LLM returned role ${result.output.role} for ${role}`);
      const allowedBullets = [...session.bullCase.bullets, ...session.bearCase.bullets, ...session.riskAnalysis.bullets];
      outputs[role] = validateGroundedAnalystOutput(result.output, allowedBullets);
      roleMetadata[role] = result.metadata;
    } catch {
      outputs[role] = baseline[role];
      roleFallbacks.push(role);
    }
  }
  const acceptedCount = 3 - roleFallbacks.length;
  const backend: DebateBackend = acceptedCount === 0 ? "deterministic" : roleFallbacks.length > 0 ? "mixed" : "llm";
  return {
    session: { ...session, bullCase: outputs.bull!, bearCase: outputs.bear!, riskAnalysis: outputs.risk!, verdict: { ...session.verdict, limitation: `${session.verdict.limitation} LLM analyst outputs are supplementary; deterministic verdict and source boundary remain authoritative.` } },
    backend,
    roleMetadata,
    roleFallbacks,
    limitation: roleFallbacks.length ? `${roleFallbacks.join(", ")} analyst role(s) fell back to deterministic output.` : "All three analyst roles returned validated structured output; deterministic verdict remains authoritative.",
  };
}
