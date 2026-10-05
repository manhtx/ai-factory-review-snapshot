import { describe, expect, it } from 'vitest';
import {
  createProductPrediction,
  evaluateProductCycleOutcome,
  recordImmutableLearning,
} from './productOutcomeValidator';

describe('Product Outcome Validator & Honest States', () => {
  it('creates immutable prediction with hash', () => {
    const pred = createProductPrediction({
      cycle_id: 'cycle-001',
      hypothesis: 'Exposing freshness boundaries reduces journey step errors',
      metric_name: 'funnel_error_rate',
      baseline_value: 0.15,
      predicted_value: 0.05,
    });

    expect(pred.prediction_id).toContain('cycle-001');
    expect(pred.immutable_hash).toHaveLength(64);
  });

  it('evaluates local harness measurements as AWAITING_PRODUCTION_EVIDENCE and prevents WIN claim', () => {
    const pred = createProductPrediction({
      cycle_id: 'cycle-001',
      hypothesis: 'Better observability',
      metric_name: 'event_coverage',
      baseline_value: 50,
      predicted_value: 90,
    });

    const evalResult = evaluateProductCycleOutcome({
      prediction: pred,
      measurement: {
        metric_name: 'event_coverage',
        baseline_value: 50,
        measured_value: 95, // Exceeds predicted 90
        source_telemetry_file: '.ai-company/runtime/user-telemetry.jsonl',
        event_coverage_percent: 95,
        missing_event_rate_percent: 0,
        task_completion_rate: 1.0,
        failure_reasons: [],
      },
      isProductionTelemetry: false, // Local harness only!
    });

    // Cannot claim WIN or PASS without production traffic!
    expect(evalResult.state).toBe('AWAITING_PRODUCTION_EVIDENCE');
    expect(evalResult.is_win_eligible).toBe(false);
    expect(evalResult.claim_level).toBe('LOCAL_ONLY');
    expect(evalResult.verdict_reasons[0]).toContain('not durable production traffic');
  });

  it('records immutable learning and tracks decision impact', () => {
    const learning = recordImmutableLearning({
      cycle_id: 'cycle-001',
      decision_affected: 'prioritize UTC freshness filter in discovery pipeline',
      key_finding: 'Users drop off when date boundaries are ambiguous',
    });

    expect(learning.learning_id).toContain('cycle-001');
    expect(learning.immutable_hash).toHaveLength(64);
    expect(learning.decision_affected).toContain('prioritize UTC');
  });

  describe('MetricContract Lifecycle & Outcomes', () => {
    const validContract = {
      metric_name: 'core_journey_step_latency_ms',
      baseline: 420,
      target: 200,
      measurement_window: '14d',
      minimum_sample_size: 200,
      failure_condition: 'p95 > 250ms',
      data_source: 'live_user_telemetry',
    };

    it('validates a correct metric contract and catches invalid configurations', async () => {
      const { validateMetricContract } = await import('./productOutcomeValidator');
      expect(validateMetricContract(validContract).valid).toBe(true);

      const invalid = { ...validContract, baseline: 'unknown' as any, minimum_sample_size: -5 };
      const res = validateMetricContract(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('baseline must be a finite number or BaselineSpec object');
      expect(res.errors).toContain('minimum_sample_size must be a positive integer');
    });

    it('evaluates outcome states: IMPLEMENTED_LOCAL, AWAITING_PRODUCTION_TELEMETRY, INSUFFICIENT_SAMPLE, MEASURED_PASS, MEASURED_FAIL', async () => {
      const { evaluateMetricOutcome } = await import('./productOutcomeValidator');

      // 1. Without telemetry: IMPLEMENTED_LOCAL
      const noTelem = evaluateMetricOutcome(validContract);
      expect(noTelem.state).toBe('IMPLEMENTED_LOCAL');
      expect(noTelem.is_win_eligible).toBe(false);

      // 2. Local test harness: AWAITING_PRODUCTION_TELEMETRY (never WIN on local harness!)
      const localTelem = evaluateMetricOutcome(validContract, {
        is_production: false,
        sample_size: 500,
        measured_value: 180,
      });
      expect(localTelem.state).toBe('AWAITING_PRODUCTION_TELEMETRY');
      expect(localTelem.is_win_eligible).toBe(false);

      // 3. Production traffic but below sample size: INSUFFICIENT_SAMPLE
      const smallSample = evaluateMetricOutcome(validContract, {
        is_production: true,
        sample_size: 50, // required: 200
        measured_value: 180,
      });
      expect(smallSample.state).toBe('INSUFFICIENT_SAMPLE');
      expect(smallSample.is_win_eligible).toBe(false);

      // 4. Production traffic meeting target: MEASURED_PASS (WIN eligible!)
      const passTelem = evaluateMetricOutcome(validContract, {
        is_production: true,
        sample_size: 350,
        measured_value: 220, // target is 200
      });
      expect(passTelem.state).toBe('MEASURED_PASS');
      expect(passTelem.is_win_eligible).toBe(true);

      // 5. Production traffic failing target: MEASURED_FAIL
      const failTelem = evaluateMetricOutcome(validContract, {
        is_production: true,
        sample_size: 350,
        measured_value: 120, // failed target
      });
      expect(failTelem.state).toBe('MEASURED_FAIL');
      expect(failTelem.is_win_eligible).toBe(false);
    });
  });
});
