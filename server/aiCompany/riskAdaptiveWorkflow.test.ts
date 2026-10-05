import { describe, expect, it } from 'vitest';
import { selectRiskAdaptiveWorkflow } from './riskAdaptiveWorkflow';
import { calculateEffectiveRisk } from './domainTypes';

describe('selectRiskAdaptiveWorkflow & calculateEffectiveRisk', () => {
  describe('calculateEffectiveRisk', () => {
    it('throws error for unknown task type', () => {
      expect(() =>
        calculateEffectiveRisk({ taskType: 'unsupported_magic_task' as any })
      ).toThrow('unknown task type');
    });

    it('escalates to P0 for production_operation or production impact', () => {
      const risk1 = calculateEffectiveRisk({ taskType: 'production_operation' });
      expect(risk1).toBe('P0');

      const risk2 = calculateEffectiveRisk({
        taskType: 'ui_change',
        productionImpact: true,
      });
      expect(risk2).toBe('P0');
    });

    it('escalates irreversible migration to P0', () => {
      const risk = calculateEffectiveRisk({
        taskType: 'migration',
        reversibility: 'irreversible',
      });
      expect(risk).toBe('P0');
    });

    it('classifies security-sensitive task as at least P1', () => {
      const risk = calculateEffectiveRisk({
        taskType: 'security',
        baseRisk: 'P3',
      });
      expect(risk).toBe('P1');
    });

    it('classifies read-only research task as P3', () => {
      const risk = calculateEffectiveRisk({
        taskType: 'research',
        mutationPolicy: 'read_only',
      });
      expect(risk).toBe('P3');
    });
  });

  describe('selectRiskAdaptiveWorkflow', () => {
    it('routes security task to dedicated security role and tech-lead with QC', () => {
      const route = selectRiskAdaptiveWorkflow('P1', 'security');
      expect(route.roles).toContain('security');
      expect(route.roles).toContain('tech-lead');
      expect(route.requires_qc).toBe(true);
      expect(route.context_artifact_level).toBe('L2');
    });

    it('routes data_change task to data-engineer', () => {
      const route = selectRiskAdaptiveWorkflow('P2', 'data_change');
      expect(route.roles).toContain('data-engineer');
      expect(route.task_type).toBe('data_change');
    });

    it('routes research/product_discovery task to PM and UX without backend coder', () => {
      const route = selectRiskAdaptiveWorkflow('P3', 'research');
      expect(route.roles).toContain('pm');
      expect(route.roles).toContain('ux-research');
      expect(route.roles).not.toContain('coder');
      expect(route.requires_ceo).toBe(false);
    });

    it('routes migration and production_operation to full council and release gate', () => {
      const route = selectRiskAdaptiveWorkflow('P0', 'production_operation');
      expect(route.risk_level).toBe('P0');
      expect(route.roles).toContain('release-security-gate');
      expect(route.roles).toContain('ceo-guild');
      expect(route.requires_ceo).toBe(true);
      expect(route.hard_token_budget).toBeGreaterThanOrEqual(100000);
    });

    it('routes UI changes to frontend-engineer', () => {
      const route = selectRiskAdaptiveWorkflow('P3', 'ui_change');
      expect(route.roles).toEqual(['frontend-engineer', 'functional-qa']);
    });
  });
});
