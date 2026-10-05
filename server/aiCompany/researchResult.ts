export interface ResearchResult { research_question: string; source_reference: string; finding: string; confidence: number; }
export function assertResearchResult(value: unknown): ResearchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid research result: object required');
  const row = value as Record<string, unknown>;
  if (['research_question','source_reference','finding'].some(key => typeof row[key] !== 'string' || !(row[key] as string).trim())
    || typeof row.confidence !== 'number' || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) throw new Error('invalid research result: finding, question, source reference and explicit confidence [0,1] required');
  return value as ResearchResult;
}
