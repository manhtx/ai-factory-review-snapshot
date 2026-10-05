export interface CompanyScheduler { id: string; tick: () => Promise<unknown> }
export interface CompanyTickResult { scheduler_id: string; ok: boolean; result?: unknown; error?: string }
export interface CompanySupervisorStatus { running: boolean; ticking: boolean; startedAt: string | null; lastTickAt: string | null; lastResults: CompanyTickResult[] }

export class CompanySupervisor {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private ticking = false;
  private lastTickAt: string | null = null;
  private startedAt: string | null = null;
  private lastResults: CompanyTickResult[] = [];
  constructor(private readonly schedulers: CompanyScheduler[], private readonly intervalMs = 60_000) {}

  async tick(): Promise<CompanyTickResult[]> {
    if (this.ticking) return this.schedulers.map((scheduler) => ({ scheduler_id: scheduler.id, ok: false, error: 'tick already in progress' }));
    this.ticking = true;
    try {
      const results = await Promise.all(this.schedulers.map(async (scheduler): Promise<CompanyTickResult> => {
        try { return { scheduler_id: scheduler.id, ok: true, result: await scheduler.tick() }; }
        catch (error: unknown) { return { scheduler_id: scheduler.id, ok: false, error: error instanceof Error ? error.message : String(error) }; }
      }));
      this.lastResults = results;
      this.lastTickAt = new Date().toISOString();
      return results;
    } finally { this.ticking = false; }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = new Date().toISOString();
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.running = false;
  }

  isRunning(): boolean { return this.running; }
  status(): CompanySupervisorStatus { return { running: this.running, ticking: this.ticking, startedAt: this.startedAt, lastTickAt: this.lastTickAt, lastResults: this.lastResults }; }
}
