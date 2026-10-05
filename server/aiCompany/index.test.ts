import { describe, expect, it } from 'vitest';
import * as platform from './index';

describe('AI Company public boundary', () => {
  it('exports the platform primitives from one stable module', () => {
    expect(platform.BoundedOrchestrator).toBeDefined();
    expect(platform.CompanyStateStore).toBeDefined();
    expect(platform.runPmCeoBacklogPipeline).toBeDefined();
    expect(platform.transitionWithDecision).toBeDefined();
  });
});
