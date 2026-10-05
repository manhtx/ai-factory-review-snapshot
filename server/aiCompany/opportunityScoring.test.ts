import { describe, expect, it } from 'vitest';
import { scoreOpportunity, scoreOpportunityWithResearch } from './opportunityScoring';

describe('opportunity scoring', () => {
  it('prioritizes evidence-backed high-value opportunities', () => {
    expect(scoreOpportunity({ idea_id: 'I', user_value: 10, strategic_fit: 9, defensibility: 8, feasibility: 8, evidence_confidence: 9, risk: 1 })).toMatchObject({ decision: 'PRIORITIZE', score: 8.75 });
  });
  it('keeps low-evidence ideas in discovery', () => {
    expect(scoreOpportunity({ idea_id: 'I', user_value: 10, strategic_fit: 10, defensibility: 10, feasibility: 10, evidence_confidence: 2, risk: 0 }).decision).toBe('DISCOVER');
  });
  it('rejects non-finite inputs', () => {
    expect(() => scoreOpportunity({ idea_id: 'I', user_value: Number.NaN, strategic_fit: 1, defensibility: 1, feasibility: 1, evidence_confidence: 1, risk: 1 })).toThrow('finite');
  });
  it('does not boost score from advisory confidence', () => {
    const dimensions={idea_id:'I',user_value:6,strategic_fit:8,defensibility:6,feasibility:7,evidence_confidence:5,risk:2};
    expect(scoreOpportunityWithResearch(dimensions,[{source_type:'AI_ADVISORY',confidence:1}])).toEqual(scoreOpportunity(dimensions));
    expect(()=>scoreOpportunityWithResearch(dimensions,[{source_type:'USER_INTERVIEW',confidence:1},{source_type:'MARKET_EVIDENCE',confidence:1}])).toThrow('source verification');
  });
});
