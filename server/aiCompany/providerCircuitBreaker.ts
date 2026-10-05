export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export class ProviderCircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(private readonly threshold = 3, private readonly cooldownMs = 60_000) {}
  state(now = Date.now()): CircuitState { if (this.failures < this.threshold) return 'CLOSED'; if (now - this.openedAt >= this.cooldownMs) return 'HALF_OPEN'; return 'OPEN'; }
  allow(now = Date.now()): boolean { return this.state(now) !== 'OPEN'; }
  success(): void { this.failures = 0; this.openedAt = 0; }
  failure(now = Date.now()): void { this.failures += 1; if (this.failures >= this.threshold && !this.openedAt) this.openedAt = now; }
  snapshot(now = Date.now()) { return { state: this.state(now), consecutive_failures: this.failures, opened_at: this.openedAt ? new Date(this.openedAt).toISOString() : null, cooldown_ms: this.cooldownMs }; }
}
