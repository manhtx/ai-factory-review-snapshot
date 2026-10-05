import { db } from "./db.js";
import type { DebateSession } from "../src/app/data/macroDebate.js";

export function saveSqliteDebateSession(session: DebateSession) {
  db.prepare(`
    INSERT INTO debate_sessions (
      id, indicator_id, indicator_name, prediction_value, prediction_horizon,
      prediction_source, prediction_direction, snapshot_value, snapshot_date,
      snapshot_unit, bull_case_json, bear_case_json, risk_analysis_json,
      risk_flags_json, verdict_signal, verdict_label, verdict_summary,
      verdict_bull_strength, verdict_bear_strength, verdict_risk_count,
      verdict_limitation, debate_rounds, eligible_indicator_ids_json,
      fingerprint, run_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      bull_case_json=excluded.bull_case_json, bear_case_json=excluded.bear_case_json,
      risk_analysis_json=excluded.risk_analysis_json, risk_flags_json=excluded.risk_flags_json,
      verdict_signal=excluded.verdict_signal, verdict_label=excluded.verdict_label,
      verdict_summary=excluded.verdict_summary, verdict_bull_strength=excluded.verdict_bull_strength,
      verdict_bear_strength=excluded.verdict_bear_strength, verdict_risk_count=excluded.verdict_risk_count,
      verdict_limitation=excluded.verdict_limitation, fingerprint=excluded.fingerprint,
      run_at=excluded.run_at
  `).run(
    session.id, session.indicatorId, session.indicatorName, session.prediction.value,
    session.prediction.horizon, session.prediction.source, session.prediction.impliedDirection,
    session.currentSnapshot.value, session.currentSnapshot.date, session.currentSnapshot.unit,
    JSON.stringify(session.bullCase), JSON.stringify(session.bearCase), JSON.stringify(session.riskAnalysis),
    JSON.stringify(session.riskFlags), session.verdict.signal, session.verdict.label, session.verdict.summary,
    session.verdict.bullStrength, session.verdict.bearStrength, session.verdict.riskCount,
    session.verdict.limitation, session.debateRounds, JSON.stringify(session.eligibleIndicatorIds),
    session.fingerprint, session.runAt,
  );
  return session;
}

function parseSession(row: Record<string, unknown>): DebateSession {
  return {
    id: String(row.id), indicatorId: String(row.indicator_id), indicatorName: String(row.indicator_name),
    prediction: { value: Number(row.prediction_value), horizon: String(row.prediction_horizon), source: String(row.prediction_source), impliedDirection: row.prediction_direction as "higher" | "lower" | "flat" },
    currentSnapshot: { value: Number(row.snapshot_value), date: String(row.snapshot_date), unit: String(row.snapshot_unit) },
    bullCase: JSON.parse(String(row.bull_case_json)), bearCase: JSON.parse(String(row.bear_case_json)), riskAnalysis: JSON.parse(String(row.risk_analysis_json)), riskFlags: JSON.parse(String(row.risk_flags_json)),
    verdict: { signal: row.verdict_signal as DebateSession["verdict"]["signal"], label: String(row.verdict_label), summary: String(row.verdict_summary), bullStrength: Number(row.verdict_bull_strength), bearStrength: Number(row.verdict_bear_strength), riskCount: Number(row.verdict_risk_count), limitation: String(row.verdict_limitation), boundary: "bounded-research-opinion" },
    debateRounds: Number(row.debate_rounds), eligibleIndicatorIds: JSON.parse(String(row.eligible_indicator_ids_json)), runAt: String(row.run_at), fingerprint: String(row.fingerprint),
  };
}

export function listSqliteDebateSessions(indicatorId: string, limit = 10) {
  const rows = db.prepare("SELECT * FROM debate_sessions WHERE indicator_id = ? ORDER BY run_at DESC LIMIT ?").all(indicatorId, Math.min(50, Math.max(1, limit))) as Array<Record<string, unknown>>;
  return { sessions: rows.map((row) => { const session = parseSession(row); return { id: session.id, indicatorId: session.indicatorId, indicatorName: session.indicatorName, predictionValue: session.prediction.value, predictionHorizon: session.prediction.horizon, predictionSource: session.prediction.source, predictionDirection: session.prediction.impliedDirection, snapshotValue: session.currentSnapshot.value, snapshotDate: session.currentSnapshot.date, verdictSignal: session.verdict.signal, verdictLabel: session.verdict.label, verdictSummary: session.verdict.summary, verdictBullStrength: session.verdict.bullStrength, verdictBearStrength: session.verdict.bearStrength, verdictRiskCount: session.verdict.riskCount, verdictLimitation: session.verdict.limitation, fingerprint: session.fingerprint, runAt: session.runAt }; }), total: rows.length };
}

export function getSqliteDebateSession(id: string) {
  const row = db.prepare("SELECT * FROM debate_sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? parseSession(row) : null;
}
