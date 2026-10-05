import { createHash } from 'node:crypto';

export type RoleContentQuality = 'PASS' | 'QUALITY_FAIL' | 'REVIEW_REQUIRED';
export type RoleQualityResult = { content_quality: RoleContentQuality; warnings: string[]; context_fingerprint: string };

export function buildRoleContextFingerprint(input: { productGoal: string; projectId: string; workId: string; role: string; evidenceIds: string[]; acceptanceCriteria: string[] }) {
  return createHash('sha256').update(JSON.stringify({ ...input, productGoal: input.productGoal.trim(), evidenceIds: [...input.evidenceIds].sort(), acceptanceCriteria: [...input.acceptanceCriteria].sort() })).digest('hex').slice(0, 24);
}

/** Conservative semantic screen: it catches known unsupported/scope-expanding
 * patterns, but never pretends to be a complete truth evaluator. */
export function evaluateRoleOutput(input: { role: string; output: string; suppliedEvidence: string[]; acceptanceCriteria: string[]; productGoal: string }): RoleQualityResult {
  const text = input.output.trim();
  const lower = text.toLowerCase();
  const warnings: string[] = [];
  if (!text) warnings.push('empty output');
  if (/user feedback|usage evidence|customer interviews?|user research/.test(lower) && !input.suppliedEvidence.some((item) => /user|telemetry|interview|research/i.test(item))) warnings.push('claims user evidence not present in supplied evidence');
  if (/\b(user interface|ui|dashboard|frontend|visual design)\b/.test(lower) && !input.acceptanceCriteria.some((item) => /ui|frontend|interface|visual/i.test(item))) warnings.push('scope-expanding UI/UX deliverable not present in acceptance criteria');
  if (/\b(product goal|north star)\b/.test(lower) && input.productGoal.length < 40) warnings.push('Product Goal context is too short for a governance claim');
  const critical = warnings.some((warning) => /unsupported|scope-expanding|too short/.test(warning));
  return { content_quality: critical ? 'QUALITY_FAIL' : warnings.length ? 'REVIEW_REQUIRED' : 'PASS', warnings, context_fingerprint: buildRoleContextFingerprint({ productGoal: input.productGoal, projectId: 'unknown', workId: 'unknown', role: input.role, evidenceIds: input.suppliedEvidence, acceptanceCriteria: input.acceptanceCriteria }) };
}
