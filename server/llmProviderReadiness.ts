export type LLMProviderReadiness = {
  status: "unconfigured" | "partial" | "configured" | "invalid";
  deterministicFallback: true;
  limitation: string;
};

export function getLLMProviderReadiness(env: Record<string, string | undefined> = process.env): LLMProviderReadiness {
  const endpoint = Boolean(env.MACRO_LLM_ENDPOINT?.trim());
  const model = Boolean(env.MACRO_LLM_MODEL?.trim());
  if (!endpoint && !model) return { status: "unconfigured", deterministicFallback: true, limitation: "LLM provider is not configured; deterministic debate remains available." };
  if (!endpoint || !model) return { status: "partial", deterministicFallback: true, limitation: "LLM provider requires both endpoint and model; deterministic debate remains available." };
  try {
    const url = new URL(env.MACRO_LLM_ENDPOINT!.trim());
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("invalid endpoint");
  } catch {
    return { status: "invalid", deterministicFallback: true, limitation: "LLM endpoint is invalid; deterministic debate remains available." };
  }
  return { status: "configured", deterministicFallback: true, limitation: "Provider configuration exists; connectivity, rights, cost and output quality remain unverified." };
}
