import type { ExecutiveReport } from './executiveReport';

const SECRET = /(sk-[A-Za-z0-9_-]+|api[_-]?key\s*[:=]\s*\S+|bot\d+:[A-Za-z0-9:_-]+)/gi;

export function formatExecutiveTelegram(report: ExecutiveReport, maxChars = 3800): string {
  const lines = [
    `AI COMPANY ${report.period}`,
    `Weakest area: ${report.weakest_area}`,
    `Evidence: ${report.evidence.join(' | ')}`,
    `Released: ${report.health.released_tasks} | Revised: ${report.health.revised_tasks} | Blocked: ${report.health.blocked_tasks}`,
    `Failure rate: ${(report.health.agent_failure_rate * 100).toFixed(1)}% | Rework: ${(report.health.rework_rate * 100).toFixed(1)}%`,
    `Cost/outcome: $${report.health.cost_per_validated_outcome_usd.toFixed(4)}`,
    report.optimization_proposals.length ? `Top optimization: ${report.optimization_proposals[0].proposal_id} — ${report.optimization_proposals[0].action}` : 'Top optimization: none',
    report.chairman_decisions_required.length ? `Chairman decisions: ${report.chairman_decisions_required.join(', ')}` : 'Chairman decisions: none',
    `No-response default: ${report.default_action_if_no_response}`,
  ];
  return redact(lines.join('\n')).slice(0, maxChars);
}

function redact(value: string): string { return value.replace(SECRET, '[REDACTED]'); }
