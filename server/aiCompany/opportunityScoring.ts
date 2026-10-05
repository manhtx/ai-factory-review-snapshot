export interface OpportunityScoreInput { idea_id: string; user_value: number; strategic_fit: number; defensibility: number; feasibility: number; evidence_confidence: number; risk: number; }
export interface OpportunityScore extends OpportunityScoreInput { score: number; decision: 'DISCOVER' | 'VALIDATE' | 'PRIORITIZE' | 'HOLD'; }

function bounded(value: number) { return Math.max(0, Math.min(10, value)); }
export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScore {
  const values = [input.user_value, input.strategic_fit, input.defensibility, input.feasibility, input.evidence_confidence, input.risk];
  if (values.some((value) => !Number.isFinite(value))) throw new Error('opportunity dimensions must be finite');
  const score = (bounded(input.user_value) * .25) + (bounded(input.strategic_fit) * .2) + (bounded(input.defensibility) * .2) + (bounded(input.feasibility) * .15) + (bounded(input.evidence_confidence) * .2) - (bounded(input.risk) * .15);
  const decision = input.evidence_confidence < 4 ? 'DISCOVER' : score >= 7 ? 'PRIORITIZE' : score >= 4.5 ? 'VALIDATE' : 'HOLD';
  return { ...input, score: Number(score.toFixed(3)), decision };
}

// Source labels and self-reported confidence do not establish real observations.
export function scoreOpportunityWithResearch(input: OpportunityScoreInput, signals: Array<{ source_type: import('./researchSignalLedger').ResearchSourceType; confidence: number }>): OpportunityScore {
  if (signals.some(signal => !Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1)) throw new Error('research confidence must be between 0 and 1');
  if (signals.some(signal => signal.source_type !== 'AI_ADVISORY')) throw new Error('external research source verification is required; source labels cannot authorize score boosts');
  return scoreOpportunity(input);
}
