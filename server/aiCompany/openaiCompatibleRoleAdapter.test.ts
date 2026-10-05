import { describe, expect, it, vi } from 'vitest';
import { createConfiguredRoleModelAdapter } from './openaiCompatibleRoleAdapter';
import { ProviderAttemptLedger } from './providerAttemptLedger';
import { ProviderDeadLetterLedger } from './providerResilience';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('configured role model adapter', () => {
  it('fails closed when configuration is absent or unsafe', () => {
    expect(createConfiguredRoleModelAdapter({})).toBeNull();
    expect(createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'http://remote.example', MACRO_LLM_MODEL: 'm' })).toBeNull();
  });
  it('returns bounded provider text and cost metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"result":"done"}' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const adapter = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions', MACRO_LLM_MODEL: 'model', AI_COMPANY_ROLE_INPUT_COST_PER_1K_USD: '2', AI_COMPANY_ROLE_OUTPUT_COST_PER_1K_USD: '4', AI_COMPANY_ROLE_MAX_RETRIES: '0' }, fetchImpl);
    const result = await adapter!.complete({ worker_id: 'coder', task: { task_id: 'T1', project_id: 'macro-os', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 1, timeout_seconds: 1 } } });
    expect(result).toMatchObject({ ok: true, text: '{"result":"done"}', usage: { input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.4 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string)).toMatchObject({ stream: false, think: false, chat_template_kwargs: { thinking: false }, max_tokens: 256, response_format: { type: 'json_object' } });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string).messages[0].content).toContain('Bounded Engineering Worker');
  });

  it('records retryable provider failures before retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('busy', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
    const ledger = new ProviderAttemptLedger(await mkdtemp(path.join(os.tmpdir(), 'provider-attempt-adapter-')));
    const adapter = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions', MACRO_LLM_MODEL: 'model', AI_COMPANY_ROLE_MAX_RETRIES: '1' }, fetchImpl, ledger);
    await adapter!.complete({ worker_id: 'coder', task: { task_id: 'T2', project_id: 'macro-os', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 2, timeout_seconds: 1 } } });
    expect(await ledger.records('macro-os')).toEqual([expect.objectContaining({ outcome: 'FAILURE', retryable: true, attempt: 1 }), expect.objectContaining({ outcome: 'SUCCESS', attempt: 2 })]);
  });

  it('supports native Ollama chat responses without exposing reasoning fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '{"bounded":true}' }, prompt_eval_count: 12, eval_count: 8 }), { status: 200 }));
    const adapter = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'http://127.0.0.1:11434/api/chat', MACRO_LLM_MODEL: 'qwen3:8b' }, fetchImpl);
    const result = await adapter!.complete({ worker_id: 'pm', task: { task_id: 'T3', project_id: 'macro-os', risk_level: 'P2', acceptance_criteria: ['bounded'], budget: { max_attempts: 1, timeout_seconds: 1 } } });
    expect(result).toMatchObject({ ok: true, text: '{"bounded":true}', usage: { input_tokens: 12, output_tokens: 8 } });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string)).toMatchObject({ think: false, format: 'json', options: { num_predict: 1024 } });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string).messages[0].content).toContain('Product Manager');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string).messages[0].content).toContain('PROCEED, REVISE, HOLD, REJECT');
  });

  it('gives native Ollama a bounded cold-start timeout while keeping remote default shorter', async () => {
    const local = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'http://127.0.0.1:11434/api/chat', MACRO_LLM_MODEL: 'qwen3:8b' }, vi.fn());
    const remote = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions', MACRO_LLM_MODEL: 'model' }, vi.fn());
    expect(local).toBeTruthy(); expect(remote).toBeTruthy();
  });

  it('does not retry after a threshold-one failure opens the circuit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    const adapter = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions', MACRO_LLM_MODEL: 'model', AI_COMPANY_ROLE_MAX_RETRIES: '3', AI_COMPANY_PROVIDER_FAILURE_THRESHOLD: '1' }, fetchImpl);
    const result = await adapter!.complete({ worker_id: 'coder', task: { task_id: 'T4', project_id: 'macro-os', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 1, timeout_seconds: 1 } } });
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('persists a dead letter after bounded retries are exhausted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    const dir = await mkdtemp(path.join(os.tmpdir(), 'provider-dead-letter-adapter-'));
    const deadLetters = new ProviderDeadLetterLedger(dir);
    const adapter = createConfiguredRoleModelAdapter({ MACRO_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions', MACRO_LLM_MODEL: 'model', AI_COMPANY_ROLE_MAX_RETRIES: '1' }, fetchImpl, undefined, deadLetters);
    const result = await adapter!.complete({ worker_id: 'coder', task: { task_id: 'T5', project_id: 'macro-os', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 2, timeout_seconds: 1 } } });
    expect(result.ok).toBe(false);
    await expect(deadLetters.records()).resolves.toMatchObject([expect.objectContaining({ work_id: 'T5', failure_class: 'PROVIDER_UNAVAILABLE', attempt: 2 })]);
  });
});
