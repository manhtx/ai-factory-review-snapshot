import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureBaselineIdeas, IdeaLedger, promoteAcceptedIdea } from './ideaLedger';
import { BacklogLedger } from './backlogLedger';

describe('idea ledger', () => {
  it('persists differentiated Product Goal ideas idempotently', async () => {
    const ledger = new IdeaLedger(await mkdtemp(path.join(os.tmpdir(), 'ideas-')));
    expect(await ensureBaselineIdeas(ledger)).toHaveLength(3);
    expect(await ensureBaselineIdeas(ledger)).toHaveLength(0);
    expect(await ledger.records('macro-os')).toHaveLength(3);
  });
  it('requires acceptance before promoting an idea into backlog', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'idea-promote-'));
    const ledger = new IdeaLedger(root); const backlog = new BacklogLedger(root);
    await ensureBaselineIdeas(ledger);
    await expect(promoteAcceptedIdea(ledger, backlog, 'IDEA-EVIDENCE-GRAPH')).rejects.toThrow('accepted');
    await ledger.decide('IDEA-EVIDENCE-GRAPH', 'ACCEPTED');
    expect(await promoteAcceptedIdea(ledger, backlog, 'IDEA-EVIDENCE-GRAPH')).toMatchObject({ backlog_id: 'IDEA-IDEA-EVIDENCE-GRAPH', priority: 'P1' });
  });
  it('persists opportunity score and decision for CEO/PM audit', async () => {
    const ledger = new IdeaLedger(await mkdtemp(path.join(os.tmpdir(), 'idea-score-')));
    await ensureBaselineIdeas(ledger);
    await expect(ledger.score('IDEA-EVIDENCE-GRAPH', { user_value: 9, strategic_fit: 9, defensibility: 8, feasibility: 7, evidence_confidence: 8, risk: 2 })).resolves.toMatchObject({ opportunity_decision: 'PRIORITIZE', opportunity_score: expect.any(Number) });
  });
});

it('legacy self-declared research labels cannot boost persisted idea score',async()=>{
 const ledger=new IdeaLedger(await mkdtemp(path.join(os.tmpdir(),'idea-unverified-')));await ensureBaselineIdeas(ledger);const dims={user_value:6,strategic_fit:8,defensibility:6,feasibility:7,evidence_confidence:5,risk:2};const base=await ledger.score('IDEA-EVIDENCE-GRAPH',dims);
 const scored=await ledger.scoreWithResearch('IDEA-EVIDENCE-GRAPH',dims,[{signal_id:'RS-IDEA-EVIDENCE-GRAPH:research:user-persona',project_id:'macro-os',source_type:'USER_INTERVIEW',persona:'user-persona',research_question:'unit',source_reference:'unverified',finding:'Unit only',confidence:1,created_at:'unit'}]);expect(scored.opportunity_score).toBe(base.opportunity_score);
});
