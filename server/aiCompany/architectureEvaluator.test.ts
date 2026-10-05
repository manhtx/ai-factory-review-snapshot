import { describe, expect, it } from 'vitest';
import { calibrateFreshnessEvaluator, evaluateFreshnessOutput } from './architectureEvaluator';

describe('architecture product evaluator calibration', () => {
  it('scores a grounded, age-qualified output above overclaimed stale output', () => {
    const result = calibrateFreshnessEvaluator();
    expect(result.discriminates).toBe(true);
    expect(result.anchors.strong.product_quality).toBeGreaterThan(result.anchors.weak.product_quality);
    expect(result.anchors.strong.domain_correctness).toBeGreaterThan(result.anchors.unsupported.domain_correctness);
  });

  it('rejects a stale series labelled current', () => {
    const result = evaluateFreshnessOutput({ freshness: 'outdated', displayedLabel: 'Current latest', sourceVerified: true });
    expect(result.product_quality).toBe(0);
    expect(result.domain_correctness).toBe(0);
  });
});
