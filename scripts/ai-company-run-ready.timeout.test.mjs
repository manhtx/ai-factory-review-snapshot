import { describe, expect, it } from 'vitest';

describe('run-ready timeout lifecycle contract', () => {
  it('clears the phase timer after a successful phase', async () => {
    const active = new Set();
    const withPhaseTimeout = (promise, phase, timeoutMs) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${phase} timed out`)), timeoutMs);
      active.add(timer);
      Promise.resolve(promise).then(
        (value) => { clearTimeout(timer); active.delete(timer); resolve(value); },
        (error) => { clearTimeout(timer); active.delete(timer); reject(error); },
      );
    });

    await expect(withPhaseTimeout(Promise.resolve('done'), 'test phase', 1000)).resolves.toBe('done');
    expect(active.size).toBe(0);
  });

  it('clears the phase timer after a rejected phase', async () => {
    const active = new Set();
    const withPhaseTimeout = (promise, phase, timeoutMs) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${phase} timed out`)), timeoutMs);
      active.add(timer);
      Promise.resolve(promise).then(
        (value) => { clearTimeout(timer); active.delete(timer); resolve(value); },
        (error) => { clearTimeout(timer); active.delete(timer); reject(error); },
      );
    });

    await expect(withPhaseTimeout(Promise.reject(new Error('phase failed')), 'test phase', 1000)).rejects.toThrow('phase failed');
    expect(active.size).toBe(0);
  });
});
