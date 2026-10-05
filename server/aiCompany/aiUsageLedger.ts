import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface AiUsageEvent {
  id: string; timestamp: string; company_id: string; product_id: string; run_id: string; cycle_id?: string | null; epoch_id?: string | null; workflow_id: string;
  workflow_version?: string | null; task_id: string; assignment_id: string; agent_role: string; agent_version?: string | null;
  provider: string; runner: string; model: string; model_version?: string | null; prompt_version?: string | null;
  prompt_fingerprint: string; context_manifest_id?: string | null;
  input_tokens_actual?: number | null; input_tokens_estimated?: number | null;
  output_tokens_actual?: number | null; output_tokens_estimated?: number | null;
  reasoning_tokens_actual?: number | null; cached_input_tokens?: number | null; tool_related_tokens?: number | null;
  total_tokens_actual?: number | null; total_tokens_estimated?: number | null;
  latency_ms: number; provider_latency_ms?: number | null; tool_latency_ms?: number | null; retry_count: number;
  tool_call_count?: number | null; files_read_count?: number | null; files_written_count?: number | null;
  exit_code: number; status: string; failure_class?: string | null; review_verdict?: string | null;
  estimated_cost?: number | null; currency?: string | null; pricing_version?: string | null; cost_source?: string | null;
  context_composition?: Record<string, number | string> | null;
}

export class AiUsageLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'ai-usage-events.jsonl'); }
  async record(input: Omit<AiUsageEvent, 'id' | 'timestamp'>): Promise<AiUsageEvent> {
    const event: AiUsageEvent = { ...input, id: `AI-USAGE:${input.task_id}:${Date.now()}`, timestamp: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(event)}\n`, 'utf8'); return event;
  }
  async records(): Promise<AiUsageEvent[]> { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error: any) { if (error?.code === 'ENOENT') return []; throw error; } }
}
