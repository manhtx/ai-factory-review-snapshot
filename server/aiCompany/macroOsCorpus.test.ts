import { describe, expect, it } from 'vitest';
import { MACRO_OS_TRIAL_CORPUS, runMacroOsCorpus } from './macroOsCorpus';

describe('Macro OS trial corpus', () => {
  it('requires every isolated scenario to pass its A/B gate', async () => {
    const report = await runMacroOsCorpus([
      { case_id: 'minimal', question: 'bounded acceptance', rounds: 2, required_agents: ['coder'] },
      { case_id: 'recovery', question: 'failure recovery', rounds: 2, required_agents: ['functional-qa'] },
    ], 2);
    expect(report.cases).toHaveLength(2);
    expect(report.passed).toBe(true);
    expect(report.cases.every((item) => item.delta.improved)).toBe(true);
  });

  it('ships the four Macro OS acceptance dimensions by default', async () => {
    const report = await runMacroOsCorpus();
    expect(report.cases.map((item) => item.case_id)).toEqual(MACRO_OS_TRIAL_CORPUS.map((item) => item.case_id));
    expect(report.passed).toBe(true);
  });
});
