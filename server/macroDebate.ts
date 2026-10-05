/**
 * macroDebate.ts (server) — Server-side debate runner and Supabase persistence
 *
 * This module handles:
 *   1. Running debate sessions server-side (receives indicator data + prediction)
 *   2. Persisting debate sessions to Supabase
 *   3. Retrieving debate history per indicator
 *
 * The debate engine itself lives in src/app/data/macroDebate.ts (shared)
 * and can run both client-side and server-side.
 */

import { getSupabaseAdmin, shouldUseSupabaseStorage } from "./supabase.js";
import type { DebateSession } from "../src/app/data/macroDebate.js";
import { getSqliteDebateSession, listSqliteDebateSessions, saveSqliteDebateSession } from "./sqliteDebateSessionStore.js";

// ─── Supabase Persistence ─────────────────────────────────────────────────────

/**
 * Persist a debate session to Supabase.
 * Gracefully handles case where Supabase is not configured (local dev).
 */
export async function persistDebateSession(session: DebateSession): Promise<void> {
  if (!shouldUseSupabaseStorage()) {
    saveSqliteDebateSession(session);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const row = {
    id: session.id,
    indicator_id: session.indicatorId,
    indicator_name: session.indicatorName,
    prediction_value: session.prediction.value,
    prediction_horizon: session.prediction.horizon,
    prediction_source: session.prediction.source,
    prediction_direction: session.prediction.impliedDirection,
    snapshot_value: session.currentSnapshot.value,
    snapshot_date: session.currentSnapshot.date,
    snapshot_unit: session.currentSnapshot.unit,
    bull_case: session.bullCase,
    bear_case: session.bearCase,
    risk_analysis: session.riskAnalysis,
    risk_flags: session.riskFlags,
    verdict_signal: session.verdict.signal,
    verdict_label: session.verdict.label,
    verdict_summary: session.verdict.summary,
    verdict_bull_strength: session.verdict.bullStrength,
    verdict_bear_strength: session.verdict.bearStrength,
    verdict_risk_count: session.verdict.riskCount,
    verdict_limitation: session.verdict.limitation,
    debate_rounds: session.debateRounds,
    eligible_indicator_ids: session.eligibleIndicatorIds,
    fingerprint: session.fingerprint,
    run_at: session.runAt,
  };

  const { error } = await supabase
    .from("debate_sessions")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error(
      JSON.stringify({
        type: "debate_persist_error",
        indicatorId: session.indicatorId,
        error: error.message,
      }),
    );
  }
}

// ─── Debate History ───────────────────────────────────────────────────────────

export interface DebateHistoryRecord {
  id: string;
  indicatorId: string;
  indicatorName: string;
  predictionValue: number;
  predictionHorizon: string;
  predictionSource: string;
  predictionDirection: "higher" | "lower" | "flat";
  snapshotValue: number;
  snapshotDate: string;
  verdictSignal: string;
  verdictLabel: string;
  verdictSummary: string;
  verdictBullStrength: number;
  verdictBearStrength: number;
  verdictRiskCount: number;
  verdictLimitation: string;
  fingerprint: string;
  runAt: string;
}

export interface DebateHistoryPage {
  sessions: DebateHistoryRecord[];
  total: number;
}

/**
 * Retrieve debate history for an indicator.
 */
export async function listDebateSessions(
  indicatorId: string,
  limit = 10,
): Promise<DebateHistoryPage> {
  if (!shouldUseSupabaseStorage()) {
    return listSqliteDebateSessions(indicatorId, limit);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { sessions: [], total: 0 };

  const { data, error, count } = await supabase
    .from("debate_sessions")
    .select(
      [
        "id",
        "indicator_id",
        "indicator_name",
        "prediction_value",
        "prediction_horizon",
        "prediction_source",
        "prediction_direction",
        "snapshot_value",
        "snapshot_date",
        "verdict_signal",
        "verdict_label",
        "verdict_summary",
        "verdict_bull_strength",
        "verdict_bear_strength",
        "verdict_risk_count",
        "verdict_limitation",
        "fingerprint",
        "run_at",
      ].join(","),
      { count: "exact" },
    )
    .eq("indicator_id", indicatorId)
    .order("run_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      JSON.stringify({
        type: "debate_history_error",
        indicatorId,
        error: error.message,
      }),
    );
    return { sessions: [], total: 0 };
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const sessions: DebateHistoryRecord[] = rows.map((row) => ({
    id: String(row.id),
    indicatorId: String(row.indicator_id),
    indicatorName: String(row.indicator_name),
    predictionValue: Number(row.prediction_value),
    predictionHorizon: String(row.prediction_horizon),
    predictionSource: String(row.prediction_source),
    predictionDirection: row.prediction_direction as "higher" | "lower" | "flat",
    snapshotValue: Number(row.snapshot_value),
    snapshotDate: String(row.snapshot_date),
    verdictSignal: String(row.verdict_signal),
    verdictLabel: String(row.verdict_label),
    verdictSummary: String(row.verdict_summary),
    verdictBullStrength: Number(row.verdict_bull_strength),
    verdictBearStrength: Number(row.verdict_bear_strength),
    verdictRiskCount: Number(row.verdict_risk_count),
    verdictLimitation: String(row.verdict_limitation),
    fingerprint: String(row.fingerprint),
    runAt: String(row.run_at),
  }));

  return { sessions, total: count ?? 0 };
}

/**
 * Retrieve a single full debate session (with bull/bear/risk details).
 */
export async function getDebateSessionFull(id: string): Promise<DebateSession | null> {
  if (!shouldUseSupabaseStorage()) return getSqliteDebateSession(id);

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("debate_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    indicatorId: data.indicator_id,
    indicatorName: data.indicator_name,
    prediction: {
      value: Number(data.prediction_value),
      horizon: data.prediction_horizon,
      source: data.prediction_source,
      impliedDirection: data.prediction_direction as "higher" | "lower" | "flat",
    },
    currentSnapshot: {
      value: Number(data.snapshot_value),
      date: data.snapshot_date,
      unit: data.snapshot_unit,
    },
    bullCase: data.bull_case,
    bearCase: data.bear_case,
    riskAnalysis: data.risk_analysis,
    riskFlags: data.risk_flags ?? [],
    verdict: {
      signal: data.verdict_signal,
      label: data.verdict_label,
      summary: data.verdict_summary,
      bullStrength: Number(data.verdict_bull_strength),
      bearStrength: Number(data.verdict_bear_strength),
      riskCount: Number(data.verdict_risk_count),
      limitation: data.verdict_limitation,
      boundary: "bounded-research-opinion",
    },
    debateRounds: data.debate_rounds,
    eligibleIndicatorIds: data.eligible_indicator_ids ?? [],
    runAt: data.run_at,
    fingerprint: data.fingerprint,
  };
}
