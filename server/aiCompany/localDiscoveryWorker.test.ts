import { describe, expect, it, vi } from 'vitest';
import { generateDiscoveryIdea } from './localDiscoveryWorker';

describe('local discovery worker', () => {
  const config = { endpoint: 'http://127.0.0.1:11434/api/chat', model: 'qwen3:8b', fetchImpl: vi.fn() };
  it('returns a DISCOVERED idea from structured evidence-grounded output', async () => {
    config.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ message: { content: JSON.stringify({ title: 'Release radar', problem: 'Users miss releases', target_persona: 'macro analyst', product_goal_reference: 'Product Goal 6', differentiation_hypothesis: 'Evidence-linked release alerts reduce missed context', validation_metric: 'users save five relevant releases' }) } }), { status: 200 }));
    const idea = await generateDiscoveryIdea(config, { projectId: 'macro-os', productGoal: 'trusted macro research', evidence: [{ evidence_id: 'E-1', summary: 'FRED release calendar', source_url: 'https://fred.stlouisfed.org' }] });
    expect(idea).toMatchObject({ project_id: 'macro-os', status: 'DISCOVERED', title: 'Release radar' });
    expect(idea.idea_id).toBe('AI-DISCOVERY-95b3edcf3fbc24a3');
    config.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ message: { content: JSON.stringify({ title: 'Release radar', problem: 'Users miss releases', target_persona: 'macro analyst', product_goal_reference: 'Product Goal 6', differentiation_hypothesis: 'Evidence-linked release alerts reduce missed context', validation_metric: 'users save five relevant releases' }) } }), { status: 200 }));
    const repeat = await generateDiscoveryIdea(config, { projectId: 'macro-os', productGoal: 'trusted macro research', evidence: [{ evidence_id: 'E-1', summary: 'FRED release calendar', source_url: 'https://fred.stlouisfed.org' }] });
    expect(repeat.idea_id).toBe(idea.idea_id);
  });
  it('fails closed without server-owned evidence or valid structured output', async () => {
    await expect(generateDiscoveryIdea(config, { projectId: 'macro-os', productGoal: 'goal', evidence: [] })).rejects.toThrow('server-owned evidence');
    config.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ message: { content: '{}' } }), { status: 200 }));
    await expect(generateDiscoveryIdea(config, { projectId: 'macro-os', productGoal: 'goal', evidence: [{ evidence_id: 'E-1', summary: 'source' }] })).rejects.toThrow('required field');
    await expect(generateDiscoveryIdea(config, { projectId: 'macro-os', productGoal: 'goal', evidence: [{ evidence_id: '', summary: 'source' }] })).rejects.toThrow('ID and summary');
    await expect(generateDiscoveryIdea({ ...config, endpoint: 'http://remote.example.test/api/chat' }, { projectId: 'macro-os', productGoal: 'goal', evidence: [{ evidence_id: 'E-1', summary: 'source' }] })).rejects.toThrow('HTTPS or local HTTP');
  });
});
