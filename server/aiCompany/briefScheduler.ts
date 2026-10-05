export type BriefPeriod = 'daily' | 'weekly';
export interface BriefSchedulerOptions { send: (period: BriefPeriod) => Promise<void>; now?: () => Date; state?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> } }

export class BriefScheduler {
  private lastSent = new Map<BriefPeriod, string>();
  private readonly now: () => Date;
  constructor(private readonly options: BriefSchedulerOptions) { this.now = options.now ?? (() => new Date()); }

  async tick(): Promise<BriefPeriod[]> {
    const date = this.now();
    const day = date.toISOString().slice(0, 10);
    const week = `${date.getUTCFullYear()}-W${isoWeek(date)}`;
    const sent: BriefPeriod[] = [];
    const dailyLast = await this.last('daily');
    const weeklyLast = await this.last('weekly');
    if (date.getUTCHours() === 8 && dailyLast !== day) { await this.options.send('daily'); await this.save('daily', day); sent.push('daily'); }
    if (date.getUTCDay() === 1 && date.getUTCHours() === 8 && weeklyLast !== week) { await this.options.send('weekly'); await this.save('weekly', week); sent.push('weekly'); }
    return sent;
  }

  private async last(period: BriefPeriod): Promise<string | null> { return this.options.state?.get(`brief:${period}`) ?? this.lastSent.get(period) ?? null; }
  private async save(period: BriefPeriod, value: string): Promise<void> { this.lastSent.set(period, value); await this.options.state?.set(`brief:${period}`, value); }
}

function isoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return String(Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0');
}
