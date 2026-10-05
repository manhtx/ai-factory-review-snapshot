import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { freshnessStatus, FreshnessStatus } from "./freshness.js";

export interface ServerAlertInput {
  indicatorId: string;
  condition: "above" | "below" | "crossover";
  threshold: number;
  note?: string;
}

export function alertFreshnessGate(period: string, frequency: string, now = new Date()): { eligible: boolean; freshness: FreshnessStatus } {
  const freshness = freshnessStatus(period, frequency, now);
  return { eligible: freshness === "fresh", freshness };
}

export function listAlerts() {
  return db.prepare(`
    SELECT id, indicator_id AS indicatorId, condition, threshold, active,
           note, created_at AS createdAt, updated_at AS updatedAt
    FROM alerts ORDER BY created_at DESC
  `).all();
}

export function createAlert(input: ServerAlertInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO alerts(id, indicator_id, condition, threshold, active, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, input.indicatorId, input.condition, input.threshold, input.note ?? null, now, now);
  return { id, ...input, active: true, createdAt: now, updatedAt: now };
}

export function removeAlert(id: string) {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM alert_events WHERE alert_id = ?").run(id);
    const result = db.prepare("DELETE FROM alerts WHERE id = ?").run(id);
    db.exec("COMMIT");
    return result.changes > 0;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function setAlertActive(id: string, active: boolean) {
  const updatedAt = new Date().toISOString();
  const result = db.prepare(`
    UPDATE alerts SET active = ?, updated_at = ? WHERE id = ?
  `).run(active ? 1 : 0, updatedAt, id);
  return result.changes > 0;
}

export function acknowledgeAlertEvent(id: number) {
  const result = db.prepare(`
    UPDATE alert_events SET acknowledged_at = ?
    WHERE id = ? AND acknowledged_at IS NULL
  `).run(new Date().toISOString(), id);
  return result.changes > 0;
}

export function listAlertEvents() {
  return db.prepare(`
    SELECT id, alert_id AS alertId, indicator_id AS indicatorId,
           observation_period AS observationPeriod, observed_value AS observedValue,
           triggered_at AS triggeredAt, acknowledged_at AS acknowledgedAt
    FROM alert_events ORDER BY triggered_at DESC LIMIT 500
  `).all();
}

export function evaluateServerAlerts(indicatorId: string) {
  const observations = db.prepare(`
    SELECT period, value, status, quality FROM observations
    WHERE indicator_id = ?
    ORDER BY period DESC, vintage DESC LIMIT 2
  `).all(indicatorId) as { period: string; value: number; status: string; quality: string }[];
  if (observations.length === 0) return [];

  const current = observations[0];
  const previous = observations[1];
  const sourceUrl = DATA_SOURCES[indicatorId]?.sourceUrl;
  if (current.status !== "actual" || current.quality !== "verified" || !sourceUrl) return [];
  if (!DATA_SOURCES[indicatorId]?.frequencyLabel || !alertFreshnessGate(current.period, DATA_SOURCES[indicatorId].frequencyLabel).eligible) return [];
  if (previous && (previous.status !== "actual" || previous.quality !== "verified")) return [];
  const alerts = db.prepare(`
    SELECT id, condition, threshold FROM alerts
    WHERE indicator_id = ? AND active = 1
  `).all(indicatorId) as { id: string; condition: string; threshold: number }[];
  const triggered: string[] = [];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO alert_events(
      alert_id, indicator_id, observation_period, observed_value, triggered_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const alert of alerts) {
    const match =
      alert.condition === "above"
        ? current.value > alert.threshold
        : alert.condition === "below"
        ? current.value < alert.threshold
        : previous
        ? (previous.value <= alert.threshold && current.value > alert.threshold) ||
          (previous.value >= alert.threshold && current.value < alert.threshold)
        : false;
    if (match) {
      const result = insert.run(
        alert.id, indicatorId, current.period, current.value, new Date().toISOString()
      );
      if (result.changes > 0) triggered.push(alert.id);
    }
  }
  return triggered;
}
