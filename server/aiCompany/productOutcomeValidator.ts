import { createHash } from 'node:crypto';

export type ProductOutcomeState =
  | 'IMPLEMENTED_LOCAL'
  | 'AWAITING_BASELINE'
  | 'AWAITING_PRODUCTION_TELEMETRY'
  | 'INSUFFICIENT_SAMPLE'
  | 'MEASURED_PASS'
  | 'MEASURED_FAIL'
  | 'LOCAL_IMPLEMENTATION_PASS'
  | 'LOCAL_INSTRUMENTATION_PASS'
  | 'PRODUCT_OUTCOME_UNVERIFIED'
  | 'PRODUCT_OUTCOME_PASS'
  | 'PRODUCT_OUTCOME_FAIL'
  | 'AWAITING_PRODUCTION_EVIDENCE';

export type BaselineSpec =
  | number
  | { type: 'KNOWN'; value: number; source: string }
  | { type: 'UNKNOWN'; reason: string };

export interface MetricContract {
  metric_name: string;
  baseline: BaselineSpec;
  target: number;
  measurement_window: string;
  minimum_sample_size: number;
  failure_condition: string;
  data_source: string;
  current_state?: ProductOutcomeState;
}

export function validateMetricContract(contract: MetricContract): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!contract) {
    return { valid: false, errors: ['metric contract is required'] };
  }
  if (!contract.metric_name?.trim()) errors.push('metric_name is required');
  
  if (typeof contract.baseline === 'number') {
    if (!Number.isFinite(contract.baseline)) errors.push('baseline number must be finite');
  } else if (contract.baseline && typeof contract.baseline === 'object') {
    if (contract.baseline.type === 'KNOWN') {
      if (typeof contract.baseline.value !== 'number' || !Number.isFinite(contract.baseline.value)) {
        errors.push('baseline value must be a finite number');
      }
      if (!contract.baseline.source?.trim()) {
        errors.push('baseline source is required for KNOWN baseline');
      }
    } else if (contract.baseline.type === 'UNKNOWN') {
      if (!contract.baseline.reason?.trim()) {
        errors.push('baseline reason is required for UNKNOWN baseline');
      }
    } else {
      errors.push('baseline type must be KNOWN or UNKNOWN');
    }
  } else {
    errors.push('baseline must be a finite number or BaselineSpec object');
  }

  if (typeof contract.target !== 'number' || !Number.isFinite(contract.target)) errors.push('target must be a finite number');
  if (!contract.measurement_window?.trim()) errors.push('measurement_window is required');
  if (typeof contract.minimum_sample_size !== 'number' || contract.minimum_sample_size <= 0 || !Number.isInteger(contract.minimum_sample_size)) {
    errors.push('minimum_sample_size must be a positive integer');
  }
  if (!contract.failure_condition?.trim()) errors.push('failure_condition is required');
  if (!contract.data_source?.trim()) errors.push('data_source is required');
  return { valid: errors.length === 0, errors };
}

export function evaluateMetricOutcome(
  contract: MetricContract,
  telemetry?: {
    is_production: boolean;
    sample_size: number;
    measured_value: number;
  }
): {
  state: ProductOutcomeState;
  is_win_eligible: boolean;
  reasons: string[];
} {
  // If baseline is UNKNOWN, task cannot graduate to WIN or measured pass; must await baseline
  if (contract.baseline && typeof contract.baseline === 'object' && contract.baseline.type === 'UNKNOWN') {
    return {
      state: 'AWAITING_BASELINE',
      is_win_eligible: false,
      reasons: [`Baseline is UNKNOWN: ${contract.baseline.reason}. Task remains in AWAITING_BASELINE.`],
    };
  }

  if (!telemetry) {
    return {
      state: 'IMPLEMENTED_LOCAL',
      is_win_eligible: false,
      reasons: ['No telemetry data provided. Local implementation complete.'],
    };
  }
  if (!telemetry.is_production) {
    return {
      state: 'AWAITING_PRODUCTION_TELEMETRY',
      is_win_eligible: false,
      reasons: ['Telemetry is from local test harness, not live production traffic.'],
    };
  }
  if (telemetry.sample_size < contract.minimum_sample_size) {
    return {
      state: 'INSUFFICIENT_SAMPLE',
      is_win_eligible: false,
      reasons: [`Sample size ${telemetry.sample_size} is below required minimum ${contract.minimum_sample_size}.`],
    };
  }
  if (telemetry.measured_value >= contract.target) {
    return {
      state: 'MEASURED_PASS',
      is_win_eligible: true,
      reasons: [`Measured value ${telemetry.measured_value} meets or exceeds target ${contract.target}.`],
    };
  }
  return {
    state: 'MEASURED_FAIL',
    is_win_eligible: false,
    reasons: [`Measured value ${telemetry.measured_value} failed target ${contract.target} (${contract.failure_condition}).`],
  };
}

export interface ProductPrediction {
  prediction_id: string;
  cycle_id: string;
  hypothesis: string;
  metric_name: string;
  baseline_value: number;
  predicted_value: number;
  created_at: string;
  immutable_hash: string;
}

export interface ProductMeasurement {
  metric_name: string;
  baseline_value: number;
  measured_value: number;
  source_telemetry_file: string;
  event_coverage_percent: number;
  missing_event_rate_percent: number;
  task_completion_rate: number;
  failure_reasons: string[];
}

export interface ProductLearning {
  learning_id: string;
  cycle_id: string;
  retrieved_in_cycle?: string;
  decision_affected: string;
  key_finding: string;
  immutable_hash: string;
  created_at: string;
}

export interface ProductOutcomeEvaluation {
  state: ProductOutcomeState;
  claim_level: 'UNVERIFIED' | 'LOCAL_ONLY' | 'PRODUCTION_VALIDATED';
  prediction?: ProductPrediction;
  measurement?: ProductMeasurement;
  learning?: ProductLearning;
  verdict_reasons: string[];
  is_win_eligible: boolean;
}

export function createProductPrediction(input: {
  cycle_id: string;
  hypothesis: string;
  metric_name: string;
  baseline_value: number;
  predicted_value: number;
}): ProductPrediction {
  const created_at = new Date().toISOString();
  const prediction_id = `PRED-${input.cycle_id}-${Date.now()}`;
  const payload = `${prediction_id}:${input.hypothesis}:${input.metric_name}:${input.baseline_value}:${input.predicted_value}:${created_at}`;
  const immutable_hash = createHash('sha256').update(payload).digest('hex');

  return {
    prediction_id,
    cycle_id: input.cycle_id,
    hypothesis: input.hypothesis,
    metric_name: input.metric_name,
    baseline_value: input.baseline_value,
    predicted_value: input.predicted_value,
    created_at,
    immutable_hash,
  };
}

export function evaluateProductCycleOutcome(input: {
  prediction: ProductPrediction;
  measurement?: ProductMeasurement;
  isProductionTelemetry: boolean;
}): ProductOutcomeEvaluation {
  const reasons: string[] = [];

  if (!input.measurement) {
    return {
      state: 'PRODUCT_OUTCOME_UNVERIFIED',
      claim_level: 'UNVERIFIED',
      prediction: input.prediction,
      verdict_reasons: ['No post-build telemetry measurement provided'],
      is_win_eligible: false,
    };
  }

  // If measurement only comes from synthetic or local harness
  if (!input.isProductionTelemetry) {
    reasons.push('Measurement is based on local test/instrumentation harness, not durable production traffic');
    return {
      state: 'AWAITING_PRODUCTION_EVIDENCE',
      claim_level: 'LOCAL_ONLY',
      prediction: input.prediction,
      measurement: input.measurement,
      verdict_reasons: reasons,
      is_win_eligible: false, // Never declare WIN on local harness alone!
    };
  }

  const improved = input.measurement.measured_value >= input.prediction.predicted_value;
  if (improved) {
    return {
      state: 'PRODUCT_OUTCOME_PASS',
      claim_level: 'PRODUCTION_VALIDATED',
      prediction: input.prediction,
      measurement: input.measurement,
      verdict_reasons: ['Measured metric exceeds predicted target under production conditions'],
      is_win_eligible: true,
    };
  }

  return {
    state: 'PRODUCT_OUTCOME_FAIL',
    claim_level: 'PRODUCTION_VALIDATED',
    prediction: input.prediction,
    measurement: input.measurement,
    verdict_reasons: ['Measured metric failed to reach predicted threshold'],
    is_win_eligible: false,
  };
}

export function recordImmutableLearning(input: {
  cycle_id: string;
  decision_affected: string;
  key_finding: string;
}): ProductLearning {
  const created_at = new Date().toISOString();
  const learning_id = `LEARN-${input.cycle_id}-${Date.now()}`;
  const payload = `${learning_id}:${input.decision_affected}:${input.key_finding}:${created_at}`;
  const immutable_hash = createHash('sha256').update(payload).digest('hex');

  return {
    learning_id,
    cycle_id: input.cycle_id,
    decision_affected: input.decision_affected,
    key_finding: input.key_finding,
    immutable_hash,
    created_at,
  };
}
