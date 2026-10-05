import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProductOperatingCycleResult } from './productOperatingCycle';

export type ProductCyclePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export interface ProductCycleSchedulerOptions { projectId: string; run: (period: ProductCyclePeriod) => Promise<ProductOperatingCycleResult>; now?: () => Date; state?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> }; reportDir?: string }

export class ProductCycleScheduler {
  private readonly now: () => Date;
  private readonly state: NonNullable<ProductCycleSchedulerOptions['state']> | undefined;
  constructor(private readonly options: ProductCycleSchedulerOptions) { this.now = options.now ?? (() => new Date()); this.state = options.state ?? (options.reportDir ? { get: async (key) => { try { const values = JSON.parse(await readFile(path.join(options.reportDir!, 'product-cycle-state.json'), 'utf8')) as Record<string, string>; return values[key] ?? null; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; } }, set: async (key, value) => { await mkdir(options.reportDir!, { recursive: true }); let values: Record<string, string> = {}; try { values = JSON.parse(await readFile(path.join(options.reportDir!, 'product-cycle-state.json'), 'utf8')) as Record<string, string>; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } values[key] = value; await writeFile(path.join(options.reportDir!, 'product-cycle-state.json'), JSON.stringify(values), 'utf8'); } } : undefined); }

  async tick(): Promise<ProductCyclePeriod[]> {
    const date = this.now();
    const day = date.toISOString().slice(0, 10);
    const week = `${date.getUTCFullYear()}-W${isoWeek(date)}`;
    const month = date.toISOString().slice(0, 7);
    const quarter = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    const year = String(date.getUTCFullYear());
    const due: ProductCyclePeriod[] = [];
    // Treat 08:00 UTC as the due time, not as a single execution window.
    // This makes restart/recovery safe when the process was down at the exact
    // minute or when the supervisor's interval drifts across the boundary.
    if (date.getUTCHours() < 8) return due;
    if (await this.last('daily') !== day) { await this.execute('daily', day); due.push('daily'); }
    if (date.getUTCDay() === 1 && await this.last('weekly') !== week) { await this.execute('weekly', week); due.push('weekly'); }
    if (date.getUTCDate() === 1 && await this.last('monthly') !== month) { await this.execute('monthly', month); due.push('monthly'); }
    if (date.getUTCDate() === 1 && [0, 3, 6, 9].includes(date.getUTCMonth()) && await this.last('quarterly') !== quarter) { await this.execute('quarterly', quarter); due.push('quarterly'); }
    if (date.getUTCMonth() === 0 && date.getUTCDate() === 1 && await this.last('annual') !== year) { await this.execute('annual', year); due.push('annual'); }
    return due;
  }

  private async last(period: ProductCyclePeriod): Promise<string | null> { return this.state?.get(`product-cycle:${this.options.projectId}:${period}`) ?? null; }
  private async execute(period: ProductCyclePeriod, key: string): Promise<void> {
    const result = await this.options.run(period);
    if (this.options.reportDir) { await mkdir(this.options.reportDir, { recursive: true }); await appendFile(path.join(this.options.reportDir, 'product-cycle-reports.jsonl'), `${JSON.stringify({ project_id: this.options.projectId, period, key, result, created_at: this.now().toISOString() })}\n`, 'utf8'); }
    await this.state?.set(`product-cycle:${this.options.projectId}:${period}`, key);
  }
}

function isoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return String(Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0');
}
