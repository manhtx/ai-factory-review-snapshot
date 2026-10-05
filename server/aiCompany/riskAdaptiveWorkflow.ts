import type { CompanyRoleId } from './roleContracts';
import type { RiskLevel, TaskType } from './assignmentEnvelope';

export interface WorkflowRoute {
  risk_level: RiskLevel;
  task_type: string;
  roles: CompanyRoleId[];
  requires_ceo: boolean;
  requires_qc: boolean;
  context_artifact_level: 'L0' | 'L1' | 'L2';
  target_token_budget: number;
  hard_token_budget: number;
  rationale: string;
}

export function selectRiskAdaptiveWorkflow(risk: RiskLevel, taskType: TaskType | string = 'backend_change'): WorkflowRoute {
  // Specialized routing based on taskType
  if (taskType === 'security') {
    return {
      risk_level: risk === 'P0' ? 'P0' : 'P1',
      task_type: 'security',
      roles: ['security', 'tech-lead', 'functional-qa'],
      requires_ceo: risk === 'P0',
      requires_qc: true,
      context_artifact_level: 'L2',
      target_token_budget: 35000,
      hard_token_budget: 55000,
      rationale: 'Security task routes to dedicated security and tech-lead audit with independent QA verification.',
    };
  }

  if (taskType === 'research' || taskType === 'product_discovery') {
    const isP3 = risk === 'P3';
    return {
      risk_level: risk,
      task_type: taskType,
      roles: isP3 ? ['pm', 'ux-research'] : ['pm', 'ux-research', 'critic'],
      requires_ceo: risk === 'P0' || risk === 'P1',
      requires_qc: false,
      context_artifact_level: isP3 ? 'L0' : 'L1',
      target_token_budget: isP3 ? 15000 : 25000,
      hard_token_budget: isP3 ? 25000 : 40000,
      rationale: 'Research and product discovery tasks route through PM, UX research, and analytical critique.',
    };
  }

  if (taskType === 'data_change') {
    return {
      risk_level: risk,
      task_type: 'data_change',
      roles: ['pm', 'data-engineer', 'functional-qa', ...(risk === 'P0' || risk === 'P1' ? (['quality-control'] as CompanyRoleId[]) : [])],
      requires_ceo: risk === 'P0' || risk === 'P1',
      requires_qc: risk === 'P0' || risk === 'P1',
      context_artifact_level: risk === 'P0' || risk === 'P1' ? 'L2' : 'L1',
      target_token_budget: 35000,
      hard_token_budget: 55000,
      rationale: 'Data changes require data-engineer pipeline validation and quality-control audit.',
    };
  }

  if (taskType === 'migration' || taskType === 'production_operation') {
    return {
      risk_level: 'P0',
      task_type: taskType,
      roles: ['tech-lead', 'backend-engineer', 'sre', 'security', 'functional-qa', 'quality-control', 'ceo-guild', 'release-security-gate'],
      requires_ceo: true,
      requires_qc: true,
      context_artifact_level: 'L2',
      target_token_budget: 85000,
      hard_token_budget: 120000,
      rationale: 'Migrations and production operations require full engineering council, security, SRE, and release gate approval.',
    };
  }

  // Standard development workflows stratified by risk level
  switch (risk) {
    case 'P3':
      return {
        risk_level: 'P3',
        task_type: taskType,
        roles: taskType === 'ui_change' ? ['frontend-engineer', 'functional-qa'] : ['coder', 'functional-qa'],
        requires_ceo: false,
        requires_qc: false,
        context_artifact_level: 'L1',
        target_token_budget: 12000,
        hard_token_budget: 20000,
        rationale: 'Low-risk changes require only engineering implementation and deterministic QA verification.',
      };
    case 'P2':
      return {
        risk_level: 'P2',
        task_type: taskType,
        roles: ['pm', taskType === 'ui_change' ? 'frontend-engineer' : 'coder', 'functional-qa'],
        requires_ceo: false,
        requires_qc: false,
        context_artifact_level: 'L1',
        target_token_budget: 28000,
        hard_token_budget: 45000,
        rationale: 'Medium-risk changes require PM scoping, engineering execution, and independent QA verification.',
      };
    case 'P1':
      return {
        risk_level: 'P1',
        task_type: taskType,
        roles: ['pm', 'tech-lead', 'coder', 'functional-qa', 'quality-control', 'ceo-guild'],
        requires_ceo: true,
        requires_qc: true,
        context_artifact_level: 'L2',
        target_token_budget: 65000,
        hard_token_budget: 95000,
        rationale: 'High-risk changes require full multi-agent guild review and CEO sign-off.',
      };
    case 'P0':
      return {
        risk_level: 'P0',
        task_type: taskType,
        roles: ['pm', 'tech-lead', 'coder', 'functional-qa', 'quality-control', 'security', 'ceo-guild'],
        requires_ceo: true,
        requires_qc: true,
        context_artifact_level: 'L2',
        target_token_budget: 80000,
        hard_token_budget: 115000,
        rationale: 'Critical P0 changes require security audit, full guild review, and CEO sign-off.',
      };
    default: {
      const _exhaustiveCheck: never = risk;
      throw new Error(`Unhandled risk level: ${_exhaustiveCheck}`);
    }
  }
}

