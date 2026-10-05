import { runMacroOsAbTrial, type TrialDelta } from './trialEvaluation';

export interface MacroOsCorpusCase {
  case_id: string;
  question: string;
  rounds: number;
  required_agents: string[];
}

export interface MacroOsCorpusResult extends MacroOsCorpusCase {
  delta: TrialDelta;
  passed: boolean;
}

export interface MacroOsCorpusReport {
  cases: MacroOsCorpusResult[];
  passed: boolean;
}

/**
 * Deterministic, bounded Macro OS acceptance corpus. Each case gets isolated
 * state through runMacroOsAbTrial; one passing case cannot mask another.
 */
export const MACRO_OS_TRIAL_CORPUS: MacroOsCorpusCase[] = [
  { case_id: 'freshness', question: 'Can a research workflow surface stale macro data?', rounds: 3, required_agents: ['coder', 'functional-qa', 'domain-expert'] },
  { case_id: 'provenance', question: 'Can every conclusion retain evidence provenance?', rounds: 3, required_agents: ['coder', 'functional-qa', 'domain-expert'] },
  { case_id: 'usability', question: 'Can a target user understand the research output?', rounds: 3, required_agents: ['coder', 'functional-qa', 'ux-research'] },
  { case_id: 'release-safety', question: 'Does independent verification block an unsafe release?', rounds: 3, required_agents: ['coder', 'functional-qa', 'ux-research', 'domain-expert'] },
];

export async function runMacroOsCorpus(cases: MacroOsCorpusCase[] = MACRO_OS_TRIAL_CORPUS, roundsOverride?: number): Promise<MacroOsCorpusReport> {
  const results: MacroOsCorpusResult[] = [];
  for (const testCase of cases) {
    const trial = await runMacroOsAbTrial(roundsOverride ?? testCase.rounds, testCase.case_id);
    const observedAgents = new Set(trial.intervention.results.flatMap((result) => result.workers.map((worker) => worker.worker_id)));
    const agentsPresent = testCase.required_agents.every((agent) => observedAgents.has(agent));
    results.push({ ...testCase, rounds: roundsOverride ?? testCase.rounds, delta: trial.delta, passed: trial.delta.improved && agentsPresent });
  }
  return { cases: results, passed: results.length > 0 && results.every((item) => item.passed) };
}
