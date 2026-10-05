import { describe, expect, it } from 'vitest';
import { MACRO_OS_GOLDEN_CORPUS, validateGoldenCorpus } from './goldenCorpus';

describe('Macro OS golden corpus', () => {
  it('is structurally valid and covers all four dimensions', () => {
    expect(validateGoldenCorpus()).toEqual([]);
    expect(new Set(MACRO_OS_GOLDEN_CORPUS.map((item) => item.dimension))).toEqual(new Set(['requirements', 'evidence', 'usability', 'release-safety']));
  });
  it('rejects incomplete or duplicated cases', () => {
    const errors = validateGoldenCorpus([{ ...MACRO_OS_GOLDEN_CORPUS[0], case_id: 'same', required_agents: [], acceptance_criteria: [], evidence_required: false }, { ...MACRO_OS_GOLDEN_CORPUS[0], case_id: 'same' }]);
    expect(errors).toEqual(expect.arrayContaining(['same: independent agent coverage missing', 'same: acceptance criteria incomplete', 'same: evidence requirement disabled', 'same: duplicate case id']));
  });
});
