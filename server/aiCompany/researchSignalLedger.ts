import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type ResearchSourceType = 'AI_ADVISORY' | 'USER_INTERVIEW' | 'USABILITY_TEST' | 'MARKET_EVIDENCE' | 'STAKEHOLDER_REVIEW';
export interface ResearchWorkOrigin { work_id: string; attempt_id: string; queue_revision: number; work_sha256: string; input_sha256: string; }
export interface ResearchSignal { signal_id: string; project_id: string; source_type: ResearchSourceType; work_origin?: ResearchWorkOrigin; persona: string; research_question: string; source_reference: string; finding: string; confidence: number; observed_metric?: { name: string; value: number; unit?: string }; created_at: string; }
export class ResearchSignalLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'research-signals.jsonl'); }
  async record(input: Omit<ResearchSignal, 'created_at'>): Promise<ResearchSignal> { if (!input.signal_id || !input.persona || !input.research_question || !input.finding) throw new Error('research signal identity and finding are required'); if (!input.source_reference.trim()) throw new Error('research signal source is required'); if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error('research signal confidence must be between 0 and 1'); const existing = (await this.records(input.project_id)).find((row) => row.signal_id === input.signal_id); if (existing) return existing; await mkdir(this.rootDir, { recursive: true }); const row = { ...input, created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8'); return row; }
  async records(projectId?: string): Promise<ResearchSignal[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ResearchSignal); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}
