export type CeoHorizon = 'near_term' | 'mid_term' | 'long_term';

export interface CeoMandate {
  mandate_id: string;
  project_id: string;
  purpose: string;
  north_star: string;
  horizons: Array<{
    horizon: CeoHorizon;
    window: string;
    objective: string;
    non_negotiable_outcome: string;
  }>;
  decision_rights: Array<{
    decision: string;
    accountable_role: string;
    required_evidence: string[];
    cannot_override: string[];
  }>;
  operating_rules: string[];
  stop_conditions: string[];
  review_cadence: Array<{ cadence: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'; purpose: string; required_roles: string[] }>;
}

export const macroOsCeoMandate: CeoMandate = {
  mandate_id: 'CEO-MANDATE-MACRO-OS-001',
  project_id: 'macro-os',
  purpose: 'Build Macro OS into the most trustworthy, evidence-led macro research operating system for global and Vietnam-focused users.',
  north_star: 'A user can understand what changed, why it changed, what is uncertain, and what to research next from current, traceable evidence.',
  horizons: [
    { horizon: 'near_term', window: '0-90 days', objective: 'Repair truth, freshness, recovery and core research workflow gaps.', non_negotiable_outcome: 'No decision-relevant value is presented without provenance, freshness and explicit data state.' },
    { horizon: 'mid_term', window: '3-36 months', objective: 'Win daily global macro intelligence and reproducible research workflows.', non_negotiable_outcome: 'Users complete the discover → inspect → compare → save → monitor loop with measurable task success.' },
    { horizon: 'long_term', window: '3-15 years', objective: 'Create a durable global macro intelligence institution with compounding data, research and trust advantages.', non_negotiable_outcome: 'Coverage, evidence quality, user value and safe operations improve cumulatively without sacrificing independence.' },
  ],
  decision_rights: [
    { decision: 'prioritize or defer product work', accountable_role: 'ceo', required_evidence: ['Product Goal alignment', 'user or domain value hypothesis', 'risk and capacity assessment'], cannot_override: ['data provenance guardrails', 'security blocks', 'independent release gate'] },
    { decision: 'accept a product requirement into backlog', accountable_role: 'pm', required_evidence: ['user research question', 'acceptance criteria', 'evidence plan'], cannot_override: ['CEO priority boundary', 'licensing constraints', 'missing real-data evidence'] },
    { decision: 'authorize release', accountable_role: 'release-security-gate', required_evidence: ['functional QA', 'QC', 'stakeholder', 'user persona', 'UX', 'domain evidence'], cannot_override: ['failed recovery or security preflight', 'unverified data', 'missing rollback plan'] },
    { decision: 'promote an AI-generated discovery', accountable_role: 'ceo', required_evidence: ['server-owned evidence', 'PM disposition', 'research or user validation'], cannot_override: ['DISCOVERED-only status', 'missing source or rights state'] },
  ],
  operating_rules: [
    'Every role acts only within its contract and leaves append-only evidence.',
    'Facts, inference, scenarios and limitations remain visibly separate.',
    'A failed or blocked cycle remains failed or blocked; no empty success is synthesized.',
    'Near-term evidence and user value outrank impressive but ungrounded features.',
    'The company continuously creates the next backlog, but never self-approves its own release.',
  ],
  stop_conditions: [
    'Stop promotion when any required independent review is missing, blocked or unevidenced.',
    'Stop provider execution when retry, cost, latency or error budgets are exhausted.',
    'Stop a data surface when provenance, freshness, rights or reconciliation is unknown.',
    'Escalate rather than silently decide when CEO, PM, domain or stakeholder evidence conflicts materially.',
  ],
  review_cadence: [
    { cadence: 'daily', purpose: 'Run health, data freshness, user demand, backlog and bounded delivery review.', required_roles: ['ceo', 'pm', 'data-engineer', 'sre', 'functional-qa', 'quality-control'] },
    { cadence: 'weekly', purpose: 'Review workflow outcomes, rework, incidents, backlog aging and competitive signals.', required_roles: ['ceo', 'pm', 'ux-research', 'user-persona', 'domain-expert', 'security', 'quality-control'] },
    { cadence: 'monthly', purpose: 'Reassess opportunities, customer value, provider rights, cost and market position.', required_roles: ['ceo', 'pm', 'stakeholder-panel', 'domain-expert', 'ai-engineer', 'security'] },
    { cadence: 'quarterly', purpose: 'Reset portfolio, SLOs, risk budget and roadmap against the long-term mandate.', required_roles: ['ceo', 'pm', 'stakeholder-panel', 'sre', 'security', 'quality-control'] },
    { cadence: 'annual', purpose: 'Revalidate the 3–15 year direction and institutional moat.', required_roles: ['ceo', 'pm', 'stakeholder-panel', 'domain-expert', 'user-persona'] },
  ],
};

export function ceoMandateSnapshot(mandate: CeoMandate = macroOsCeoMandate) {
  return { mandate, horizon_count: mandate.horizons.length, decision_count: mandate.decision_rights.length, cadence_count: mandate.review_cadence.length };
}
