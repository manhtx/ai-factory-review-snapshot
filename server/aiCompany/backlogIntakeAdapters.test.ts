import { describe, expect, it } from 'vitest';
import { candidateFromProductIdea, candidateFromProductOpportunity, candidateFromTelemetryOpportunity } from './backlogIntake';

describe('backlog intake adapters', () => {
  it('preserves idea provenance and keeps it PM-only', () => {
    const c = candidateFromProductIdea({ idea_id: 'I-1', project_id: 'macro-os', title: 'Freshness', problem: 'stale data', target_persona: 'analyst', validation_metric: 'date visible' });
    expect(c.source_id).toBe('idea:I-1'); expect(c.source_type).toBe('PRODUCT_DISCOVERY'); expect(c.evidence_quality).toBe('REQUIRES_MORE_EVIDENCE');
  });
  it('maps telemetry evidence without promoting it', () => {
    const c = candidateFromTelemetryOpportunity({ opportunity_id: 'O-1', project_id: 'macro-os', problem: 'drop off', evidence_ids: ['e:1'], confidence: .8 });
    expect(c.source_id).toBe('opportunity:O-1'); expect(c.evidence_ids).toEqual(['e:1']); expect(c.confidence_signal).toBe(.8);
  });
  it('converts discovery output into a PM candidate without product authority', () => {
    const c = candidateFromProductOpportunity({ opportunity_id: 'O-2', project_id: 'macro-os', idea: 'Improve freshness', problem_statement: 'Stale data can be mistaken for current', affected_surface: '/indicators/:id', affected_persona: 'analyst', evidence_ids: ['E-1'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', confidence: .8, expected_value: 'HIGH', acceptance_criteria: ['show state'], non_goals: ['provider migration'] });
    expect(c.source_type).toBe('PRODUCT_DISCOVERY'); expect(c.evidence_quality).toBe('REQUIRES_MORE_EVIDENCE'); expect(c.source_id).toBe('opportunity:O-2');
  });
});
