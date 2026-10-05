import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompanyStateStore } from './stateStore';
import { TelegramControlPlane, parseTelegramCommand } from './telegramControl';
import { BacklogLedger } from './backlogLedger';

describe('Telegram control plane', () => {
  it('parses only schema-defined commands', () => {
    expect(parseTelegramCommand('/approve DEC-1')).toEqual({ kind: 'APPROVE', decisionId: 'DEC-1' });
    expect(parseTelegramCommand('/instruct macro-os ưu tiên freshness')).toMatchObject({ kind: 'INSTRUCT', project: 'macro-os' });
    expect(parseTelegramCommand('/prioritize BL-1 P0')).toEqual({ kind: 'PRIORITIZE', decisionId: 'BL-1', priority: 'P0' });
    expect(parseTelegramCommand('/backlog macro-os')).toEqual({ kind: 'BACKLOG', project: 'macro-os' });
    expect(parseTelegramCommand('rm -rf /')).toBeNull();
  });

  it('authenticates, deduplicates and journals accepted commands', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const control = new TelegramControlPlane(42, store);
    expect((await control.handle({ update_id: 1, user_id: 99, text: '/status' })).accepted).toBe(false);
    expect((await control.handle({ update_id: 2, user_id: 42, text: '/status macro-os' })).accepted).toBe(true);
    expect((await control.handle({ update_id: 2, user_id: 42, text: '/status macro-os' })).message).toContain('duplicate');
    expect((await store.events())).toHaveLength(1);
  });

  it('applies a validated Telegram priority instruction to the backlog ledger', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const backlog = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-backlog-')));
    await backlog.add([{ backlog_id: 'BL-1', project_id: 'p', task_id: 't', title: 'x', priority: 'P2', rationale: 'r', source_feedback_ids: [], acceptance_criteria: ['done'], status: 'PROPOSED' }]);
    const control = new TelegramControlPlane(42, store, backlog);
    expect((await control.handle({ update_id: 3, user_id: 42, text: '/prioritize BL-1 P0' })).accepted).toBe(true);
    expect((await backlog.decisions('p'))[0].priority).toBe('P0');
  });
});
