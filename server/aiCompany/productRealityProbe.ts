import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProductRealitySnapshot { project_id: string; source: string; generated_at: string; event_count: number; session_count: number; events_by_type: Record<string, number>; journey_completion_events: number; evidence_state: 'LOCAL_ONLY' | 'PRODUCTION_OBSERVED' | 'MISSING'; limitation: string; }

export async function readProductRealitySnapshot(rootDir: string, projectId = 'macro-os'): Promise<ProductRealitySnapshot> {
  const source = join(rootDir, 'user-telemetry.jsonl');
  let events: Array<{ eventType?: string; sessionId?: string; provenance?: string }> = [];
  try { events = (await readFile(source, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const byType: Record<string, number> = {};
  for (const event of events) if (event.eventType) byType[event.eventType] = (byType[event.eventType] ?? 0) + 1;
  // Never trust a caller-controlled legacy `isProduction` field. Production
  // evidence must be stamped by the trusted ingestion boundary.
  const production = events.some((event) => event.provenance === 'production_attested');
  const completion = (byType.value_moment_achieved ?? 0) + (byType.forecast_export ?? 0);
  return { project_id: projectId, source, generated_at: new Date().toISOString(), event_count: events.length, session_count: new Set(events.map((event) => event.sessionId).filter(Boolean)).size, events_by_type: byType, journey_completion_events: completion, evidence_state: production ? 'PRODUCTION_OBSERVED' : events.length ? 'LOCAL_ONLY' : 'MISSING', limitation: production ? 'Production telemetry is observed; outcome attribution still requires a metric contract and measurement window.' : 'No production-tagged telemetry; local events cannot prove product value.' };
}
