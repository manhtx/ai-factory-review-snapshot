import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface SecurityViolationEvent {
  event_id: string; timestamp: string; project_id: string; run_id: string; namespace: string;
  work_id: string; assignment_id: string; role: string; violation_type: 'FORBIDDEN_PATH' | 'FORBIDDEN_TOOL' | 'CONTROL_PLANE_MUTATION';
  attempted_paths: string[]; prevented: boolean; action: 'BLOCKED' | 'CONTAINED' | 'ESCALATED'; evidence_ref?: string;
}

export class SecurityViolationLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'security-violation-events.jsonl'); }
  async record(input: Omit<SecurityViolationEvent, 'event_id' | 'timestamp'>): Promise<SecurityViolationEvent> {
    const event = { ...input, event_id: `SECURITY-VIOLATION:${input.work_id}:${Date.now()}`, timestamp: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(event)}\n`, 'utf8'); return event;
  }
  async records(): Promise<SecurityViolationEvent[]> { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error: any) { if (error?.code === 'ENOENT') return []; throw error; } }
}
