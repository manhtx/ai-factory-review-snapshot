import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export type IngestionJobClaim = { id: string; indicatorId: string; workerId: string; claimedAt: string; attempts: number };

export function claimIngestionJob(indicatorId: string, workerId: string, now = new Date(), staleAfterMs = 30 * 60_000): IngestionJobClaim | null {
  const claimedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const active = db.prepare(`SELECT id, claimed_at AS claimedAt FROM ingestion_jobs WHERE indicator_id = ? AND status = 'claimed' ORDER BY claimed_at DESC LIMIT 1`).get(indicatorId) as { id: string; claimedAt: string } | undefined;
    if (active && active.claimedAt > staleBefore) {
      db.exec("COMMIT");
      return null;
    }
    if (active) db.prepare("UPDATE ingestion_jobs SET status = 'recovered', completed_at = ?, error_message = ? WHERE id = ?").run(claimedAt, "Recovered stale claim before a new attempt", active.id);
    const id = randomUUID();
    const attempts = Number((db.prepare("SELECT COALESCE(MAX(attempts), 0) AS attempts FROM ingestion_jobs WHERE indicator_id = ?").get(indicatorId) as { attempts: number }).attempts) + 1;
    db.prepare(`INSERT INTO ingestion_jobs(id, indicator_id, status, worker_id, claimed_at, heartbeat_at, attempts) VALUES (?, ?, 'claimed', ?, ?, ?, ?)`).run(id, indicatorId, workerId, claimedAt, claimedAt, attempts);
    db.exec("COMMIT");
    return { id, indicatorId, workerId, claimedAt, attempts };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function heartbeatIngestionJob(jobId: string, now = new Date()) {
  db.prepare("UPDATE ingestion_jobs SET heartbeat_at = ? WHERE id = ? AND status = 'claimed'").run(now.toISOString(), jobId);
}

export function finishIngestionJob(jobId: string, status: "succeeded" | "failed", errorMessage?: string, now = new Date()) {
  db.prepare("UPDATE ingestion_jobs SET status = ?, completed_at = ?, error_message = ? WHERE id = ? AND status = 'claimed'").run(status, now.toISOString(), errorMessage ?? null, jobId);
}

export function listIngestionJobs(indicatorId?: string) {
  const query = `SELECT id, indicator_id AS indicatorId, status, worker_id AS workerId, claimed_at AS claimedAt, heartbeat_at AS heartbeatAt, completed_at AS completedAt, attempts, error_message AS errorMessage FROM ingestion_jobs ${indicatorId ? "WHERE indicator_id = ?" : ""} ORDER BY claimed_at DESC LIMIT 200`;
  return (indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all()) as Array<Record<string, unknown>>;
}
