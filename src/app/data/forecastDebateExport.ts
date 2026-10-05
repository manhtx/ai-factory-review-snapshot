import type { DebateSession } from "./macroDebate";
import { deterministicFingerprint } from "./deterministicFingerprint.js";

export interface ForecastDebateExportArtifact {
  schema: "macro-os.forecast-debate";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  boundary: "persisted-debate-research-artifact";
  session: DebateSession;
  limitations: string[];
}

function boundedSession(session: DebateSession): DebateSession {
  return {
    ...session,
    eligibleIndicatorIds: [...session.eligibleIndicatorIds],
    riskFlags: session.riskFlags.map((flag) => ({ ...flag })),
    bullCase: { ...session.bullCase, bullets: session.bullCase.bullets.map((bullet) => ({ ...bullet })) },
    bearCase: { ...session.bearCase, bullets: session.bearCase.bullets.map((bullet) => ({ ...bullet })) },
    riskAnalysis: { ...session.riskAnalysis, bullets: session.riskAnalysis.bullets.map((bullet) => ({ ...bullet })) },
    verdict: { ...session.verdict },
    prediction: { ...session.prediction },
    currentSnapshot: { ...session.currentSnapshot },
  };
}

export function createForecastDebateExportArtifact(session: DebateSession, exportedAt = new Date().toISOString()): ForecastDebateExportArtifact {
  const bounded = boundedSession(session);
  const boundary = "persisted-debate-research-artifact" as const;
  const limitations = [
    "This export is a bounded research opinion from a persisted debate session; it is not an investment recommendation.",
    "Evidence freshness, source rights and provider availability must be rechecked before a new research run.",
    "The artifact contains cited metadata and bounded evidence bullets, not raw provider payloads or credentials.",
  ];
  return { schema: "macro-os.forecast-debate", version: 1, exportedAt, fingerprint: deterministicFingerprint({ session: bounded, boundary, limitations }), boundary, session: bounded, limitations };
}

function markdownText(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|").trim();
}

function renderCase(label: string, output: DebateSession["bullCase"]) {
  const bullets = output.bullets.length ? output.bullets.map((bullet) => `- ${markdownText(bullet.shortName)}: ${markdownText(bullet.argument)} (${markdownText(bullet.asOf)})`).join("\n") : "- Không đủ bằng chứng định lượng.";
  return `## ${label}\n\n**Thesis:** ${markdownText(output.thesis)}\n\n**Strength:** ${markdownText(output.strength)}\n\n${bullets}\n\n**Limitation:** ${markdownText(output.limitation)}`;
}

export function renderForecastDebateMarkdown(artifact: ForecastDebateExportArtifact) {
  const { session } = artifact;
  const flags = session.riskFlags.length ? session.riskFlags.map((flag) => `- ${markdownText(flag.severity)}: ${markdownText(flag.description)} (${markdownText(flag.evidenceDate)})`).join("\n") : "- Không phát hiện risk flag trong bundle hiện tại.";
  return [
    `# Forecast Debate — ${markdownText(session.indicatorName)}`,
    "",
    `- Indicator: ${markdownText(session.indicatorId)}`,
    `- Prediction: ${markdownText(session.prediction.value)} (${markdownText(session.prediction.horizon)})`,
    `- Source: ${markdownText(session.prediction.source)}`,
    `- Current snapshot: ${markdownText(session.currentSnapshot.value)} @ ${markdownText(session.currentSnapshot.date)}`,
    `- Verdict: ${markdownText(session.verdict.label)} — ${markdownText(session.verdict.signal)}`,
    `- Artifact fingerprint: ${markdownText(artifact.fingerprint)}`,
    "",
    renderCase("Bull Case", session.bullCase),
    "",
    renderCase("Bear Case", session.bearCase),
    "",
    renderCase("Risk Analysis", session.riskAnalysis),
    "",
    "## Risk Flags",
    "",
    flags,
    "",
    "## Limitations",
    "",
    artifact.limitations.map((limitation) => `- ${markdownText(limitation)}`).join("\n"),
    "",
  ].join("\n");
}
