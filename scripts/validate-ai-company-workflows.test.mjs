import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('product improvement workflow definition', () => {
  it('contains decision, independent verification and learning gates', async () => {
    const workflow = JSON.parse(await readFile(new URL('../.ai-company/workflows/product-improvement.json', import.meta.url), 'utf8'));
    expect(workflow.north_star).toBe('verified_product_improvement_or_valuable_learning');
    expect(workflow.steps.map((step) => step.role)).toEqual(expect.arrayContaining(['ceo-guild', 'critic', 'tech-lead', 'functional-qa', 'quality-control', 'user-persona']));
    expect(workflow.steps.every((step) => step.output && step.role)).toBe(true);
  });
});
