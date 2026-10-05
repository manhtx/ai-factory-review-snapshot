export type EvidenceQualityState = 'SUFFICIENT' | 'INSUFFICIENT' | 'CONFLICTED' | 'STALE' | 'SYNTHETIC_ONLY' | 'REQUIRES_MORE_EVIDENCE';

export interface EvidenceQualityInput { count: number; provenance: boolean; fresh: boolean; independent: boolean; reproducible: boolean; contradiction: boolean; syntheticOnly?: boolean; risk: 'P0'|'P1'|'P2'|'P3'; }

export function classifyEvidenceQuality(input: EvidenceQualityInput): EvidenceQualityState {
  if (input.contradiction) return 'CONFLICTED';
  if (!input.fresh) return 'STALE';
  if (input.syntheticOnly) return 'SYNTHETIC_ONLY';
  if (!input.provenance || !input.reproducible || input.count < 1) return 'INSUFFICIENT';
  if ((input.risk === 'P0' || input.risk === 'P1') && (!input.independent || input.count < 2)) return 'REQUIRES_MORE_EVIDENCE';
  return 'SUFFICIENT';
}
