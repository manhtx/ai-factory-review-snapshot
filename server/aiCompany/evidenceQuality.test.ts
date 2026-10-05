import { describe, expect, it } from 'vitest';
import { classifyEvidenceQuality } from './evidenceQuality';
describe('evidence quality', () => {
  const base = { count: 1, provenance:true, fresh:true, independent:true, reproducible:true, contradiction:false, risk:'P2' as const };
  it('distinguishes weak, stale, synthetic and conflicted evidence', () => {
    expect(classifyEvidenceQuality({...base, provenance:false})).toBe('INSUFFICIENT');
    expect(classifyEvidenceQuality({...base, fresh:false})).toBe('STALE');
    expect(classifyEvidenceQuality({...base, syntheticOnly:true})).toBe('SYNTHETIC_ONLY');
    expect(classifyEvidenceQuality({...base, contradiction:true})).toBe('CONFLICTED');
    expect(classifyEvidenceQuality(base)).toBe('SUFFICIENT');
  });
  it('requires independent evidence for high-risk work', () => expect(classifyEvidenceQuality({...base, risk:'P1', independent:false})).toBe('REQUIRES_MORE_EVIDENCE'));
});
