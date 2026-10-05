import { createHash } from 'node:crypto';
import type { CompanyStateStore } from './stateStore';
import type { BacklogLedger } from './backlogLedger';
import type { DecisionLedger } from './decisionLedger';

export type TelegramCommand =
  | { kind: 'STATUS'; project?: string }
  | { kind: 'BACKLOG'; project: string }
  | { kind: 'BRIEF'; period: 'daily' | 'weekly' }
  | { kind: 'APPROVE' | 'REJECT' | 'REVISE' | 'DELEGATE'; decisionId: string; value?: string }
  | { kind: 'PRIORITIZE'; decisionId: string; priority: 'P0' | 'P1' | 'P2' | 'P3' }
  | { kind: 'INSTRUCT'; project: string; instruction: string }
  | { kind: 'PAUSE' | 'RESUME' | 'KILL'; target: string };

export interface TelegramInbound { update_id: number; user_id: number; text: string }
export interface TelegramReply { update_id: number; accepted: boolean; message: string; command?: TelegramCommand }

export class TelegramControlPlane {
  private readonly seen = new Set<number>();
  constructor(private readonly allowedUserId: number, private readonly store: CompanyStateStore, private readonly backlog?: BacklogLedger, private readonly decisions?: DecisionLedger) {}

  async handle(update: TelegramInbound): Promise<TelegramReply> {
    if (this.seen.has(update.update_id)) return { update_id: update.update_id, accepted: false, message: 'duplicate update ignored' };
    this.seen.add(update.update_id);
    if (update.user_id !== this.allowedUserId) return { update_id: update.update_id, accepted: false, message: 'unauthorized user' };
    const command = parseTelegramCommand(update.text);
    if (!command) return { update_id: update.update_id, accepted: false, message: 'unsupported or malformed command' };
    if (command.kind === 'APPROVE' || command.kind === 'REJECT' || command.kind === 'REVISE' || command.kind === 'DELEGATE') {
      if (!this.decisions) return { update_id: update.update_id, accepted: false, message: 'decision control is not configured' };
      const prior = (await this.decisions.records()).find((record) => record.decision_id === command.decisionId);
      if (prior && new Date(prior.expires_at).getTime() <= Date.now()) return { update_id: update.update_id, accepted: false, message: 'decision expired' };
      await this.decisions.record({ decision_id: command.decisionId, action: command.kind, value: command.value, actor: 'CHAIRMAN', expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    }
    if (command.kind === 'PRIORITIZE') {
      if (!this.backlog) return { update_id: update.update_id, accepted: false, message: 'backlog control is not configured' };
      const item = (await this.backlog.items()).find((candidate) => candidate.backlog_id === command.decisionId);
      if (!item) return { update_id: update.update_id, accepted: false, message: 'backlog item not found' };
      await this.backlog.decide({ backlog_id: item.backlog_id, project_id: item.project_id, priority: command.priority, rationale: 'Chairman Telegram instruction', decided_by: 'CHAIRMAN' });
    }
    await this.store.checkpoint({ aggregateId: `telegram:${update.update_id}`, actor: 'chairman-interface', cursor: 'accepted', payload: { command, digest: digest(update.text) }, idempotencyKey: `telegram:${update.update_id}` });
    return { update_id: update.update_id, accepted: true, message: `accepted ${command.kind}`, command };
  }
}

export function parseTelegramCommand(text: string): TelegramCommand | null {
  const parts = text.trim().split(/\s+/);
  const name = parts.shift()?.toLowerCase();
  if (name === '/status') return { kind: 'STATUS', project: parts[0] };
  if (name === '/backlog' && parts[0]) return { kind: 'BACKLOG', project: parts[0] };
  if (name === '/brief' && (parts[0] === 'daily' || parts[0] === 'weekly')) return { kind: 'BRIEF', period: parts[0] };
  if (name === '/approve' && parts[0]) return { kind: 'APPROVE', decisionId: parts[0] };
  if (name === '/reject' && parts[0]) return { kind: 'REJECT', decisionId: parts[0], value: parts.slice(1).join(' ') };
  if (name === '/revise' && parts[0]) return { kind: 'REVISE', decisionId: parts[0], value: parts.slice(1).join(' ') };
  if (name === '/delegate' && parts[0] && parts[1]) return { kind: 'DELEGATE', decisionId: parts[0], value: parts[1] };
  if (name === '/prioritize' && parts[0] && ['P0', 'P1', 'P2', 'P3'].includes(parts[1] ?? '')) return { kind: 'PRIORITIZE', decisionId: parts[0], priority: parts[1] as 'P0' | 'P1' | 'P2' | 'P3' };
  if (name === '/instruct' && parts[0] && parts.length > 1) return { kind: 'INSTRUCT', project: parts.shift()!, instruction: parts.join(' ') };
  if ((name === '/pause' || name === '/resume' || name === '/kill') && parts[0]) return { kind: name.slice(1).toUpperCase() as 'PAUSE' | 'RESUME' | 'KILL', target: parts[0] };
  return null;
}

function digest(text: string): string { return createHash('sha256').update(text).digest('hex'); }
