import { describe, expect, it } from 'vitest';
import { ProviderCircuitBreaker } from './providerCircuitBreaker';

describe('provider circuit breaker', () => {
  it('opens after consecutive failures and permits a half-open probe after cooldown', () => {
    const circuit = new ProviderCircuitBreaker(2, 1000);
    circuit.failure(100); circuit.failure(200);
    expect(circuit.allow(500)).toBe(false);
    expect(circuit.snapshot(500).state).toBe('OPEN');
    expect(circuit.allow(1200)).toBe(true);
    expect(circuit.snapshot(1200).state).toBe('HALF_OPEN');
    circuit.success();
    expect(circuit.snapshot(1200)).toMatchObject({ state: 'CLOSED', consecutive_failures: 0 });
  });
});
