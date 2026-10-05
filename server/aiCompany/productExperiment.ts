import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ExperimentEvidenceState = 'LOCAL_ONLY' | 'PRODUCTION_OBSERVED';
export interface ExperimentRecord { record_type: 'BASELINE' | 'PREDICTION' | 'MEASUREMENT' | 'LEARNING' | 'REPRIORITIZATION'; experiment_id: string; project_id: string; metric_name: string; value?: number; target?: number; evidence_state: ExperimentEvidenceState; evidence_ids: string[]; decision_affected?: string; created_at: string; }

export class ProductExperimentLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = join(rootDir, 'product-experiments.jsonl'); }
  private async add(input: Omit<ExperimentRecord, 'created_at'>) { const row = { ...input, created_at: new Date().toISOString() }; await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8'); return row; }
  async baseline(input: Omit<ExperimentRecord, 'record_type' | 'created_at'>) { if (input.value === undefined || !input.evidence_ids.length) throw new Error('baseline requires value and evidence'); return this.add({ ...input, record_type: 'BASELINE' }); }
  async prediction(input: Omit<ExperimentRecord, 'record_type' | 'created_at'>) { if (input.target === undefined || !input.evidence_ids.length) throw new Error('prediction requires target and evidence'); return this.add({ ...input, record_type: 'PREDICTION' }); }
  async measurement(input: Omit<ExperimentRecord, 'record_type' | 'created_at'>) { if (input.value === undefined || !input.evidence_ids.length) throw new Error('measurement requires value and evidence'); return this.add({ ...input, record_type: 'MEASUREMENT' }); }
  async learning(input: Omit<ExperimentRecord, 'record_type' | 'created_at'>) { if (!input.decision_affected?.trim() || !input.evidence_ids.length) throw new Error('learning requires affected decision and evidence'); return this.add({ ...input, record_type: 'LEARNING' }); }
  async reprioritize(input: Omit<ExperimentRecord, 'record_type' | 'created_at'>) { if (!input.decision_affected?.trim() || !input.evidence_ids.length) throw new Error('reprioritization requires decision and evidence'); return this.add({ ...input, record_type: 'REPRIORITIZATION' }); }
  async records(experimentId?: string): Promise<ExperimentRecord[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ExperimentRecord); return experimentId ? rows.filter((row) => row.experiment_id === experimentId) : rows; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async hasClosedLocalChain(experimentId: string) { const rows = await this.records(experimentId); return ['BASELINE', 'PREDICTION', 'MEASUREMENT', 'LEARNING', 'REPRIORITIZATION'].every((type) => rows.some((row) => row.record_type === type)) && rows.every((row) => row.evidence_state === 'LOCAL_ONLY'); }

  async measureTelemetry(input: { experiment_id: string; project_id: string; baseline_at: string; source: string; minimum_sessions: number; production: boolean }) {
    let events: Array<{ eventType?: string; sessionId?: string; timestamp?: string }> = [];
    try { events = (await readFile(input.source, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const fresh = events.filter((event) => event.timestamp && Date.parse(event.timestamp) > Date.parse(input.baseline_at));
    const sessions = new Set(fresh.map((event) => event.sessionId).filter(Boolean)); const value = fresh.filter((event) => event.eventType === 'compare_explanation_opened' || event.eventType === 'value_moment_achieved' || event.eventType === 'forecast_export').length;
    if (sessions.size < input.minimum_sessions) return { state: 'INSUFFICIENT_SAMPLE' as const, sample_size: sessions.size, evidence_ids: [`telemetry:${input.source}`] };
    const evidence_state = input.production ? 'PRODUCTION_OBSERVED' as const : 'LOCAL_ONLY' as const;
    const row = await this.measurement({ experiment_id: input.experiment_id, project_id: input.project_id, metric_name: 'value_events_per_session', value: value / sessions.size, evidence_state, evidence_ids: [`telemetry:${input.source}`, `window_after:${input.baseline_at}`] });
    return { state: evidence_state === 'PRODUCTION_OBSERVED' ? 'MEASURED' as const : 'LOCAL_MEASURED' as const, sample_size: sessions.size, measurement: row };
  }
}
