export const userJourneyMatrix = {
  'UJ-001': { persona: 'daily macro reader', task: 'find what changed today and inspect source/as-of date' },
  'UJ-002': { persona: 'Vietnam investor', task: 'compare Vietnam with a global peer across a selected period' },
  'UJ-003': { persona: 'portfolio manager', task: 'trace a risk signal to explanation and limitation' },
  'UJ-004': { persona: 'research analyst', task: 're-open a prior research view after refresh' },
  'UJ-005': { persona: 'accessibility-conscious user', task: 'navigate, search, inspect and export with keyboard only' },
} as const;

export type UserJourneyId = keyof typeof userJourneyMatrix;

export function userJourneyForRole(role: string): UserJourneyId {
  if (role === 'user-persona') return 'UJ-001';
  if (role === 'ux-research') return 'UJ-005';
  if (role === 'stakeholder-panel') return 'UJ-003';
  if (role === 'domain-expert') return 'UJ-003';
  throw new Error(`role has no user journey mapping: ${role}`);
}
