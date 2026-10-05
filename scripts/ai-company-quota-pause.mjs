#!/usr/bin/env node
/**
 * ai-company-quota-pause.mjs — Quota pause / startup-resume helper for ai-company-loop.sh
 *
 * Commands:
 *   write  --host <ANTIGRAVITY|CODEX> --action <next_safe_action> [--sprint <id>] [--cycle <id>] [--retry-after <seconds>]
 *   read   → prints JSON or exits 0 with nothing if no pause active
 *   check  → exits 0 if ready to retry, exits 1 if still waiting
 *   clear  → removes the checkpoint
 *
 * This script is the ONLY thing that writes quota-pause.json.
 * ai-company-loop.sh calls it; no other runtime code should need to import it.
 */

import { QuotaPauseLedger, isReadyToRetry, computeRetryDelayMs } from '../server/aiCompany/quotaPause.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.AI_COMPANY_PROJECT_ROOT ?? process.cwd();
const stateDir = process.env.AI_COMPANY_STATE_DIR ?? path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const ledger = new QuotaPauseLedger(stateDir);

const cmd = process.argv[2];
const args = new Map();
for (let i = 3; i < process.argv.length; i += 2) {
  if (process.argv[i]?.startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '');
}

// Try to read current marathon state for next_safe_action if not supplied
async function readMarathonNextAction() {
  try {
    const marathonPath = path.join(root, '.ai-company', 'mission', 'AI_COMPANY_EVOLUTION_MARATHON_STATE.json');
    const marathon = JSON.parse(await readFile(marathonPath, 'utf8'));
    return marathon?.next_safe_action ?? 'CONTINUE_NEXT_EPOCH';
  } catch {
    return 'CONTINUE_NEXT_EPOCH';
  }
}

switch (cmd) {
  case 'write': {
    const host = args.get('host') ?? 'UNKNOWN';
    const sprintId = args.get('sprint') ?? null;
    const cycleId = args.get('cycle') ?? null;
    const retryAfterSecs = args.get('retry-after') ? Number(args.get('retry-after')) : null;
    const nextAction = args.get('action') ?? (await readMarathonNextAction());
    const retryNotBefore = retryAfterSecs && retryAfterSecs > 0
      ? new Date(Date.now() + retryAfterSecs * 1000).toISOString()
      : null;

    const checkpoint = await ledger.recordQuotaPause({
      host: host,
      sprint_id: sprintId,
      cycle_id: cycleId,
      next_safe_action: nextAction,
      retry_not_before: retryNotBefore,
      retry_time_source: retryNotBefore ? 'PARSED_MESSAGE' : 'UNKNOWN',
    });
    console.log(JSON.stringify({ ok: true, status: checkpoint.status, next_safe_action: checkpoint.next_safe_action, retry_not_before: checkpoint.retry_not_before, attempt: checkpoint.resume_attempt_count }));
    break;
  }
  case 'read': {
    const checkpoint = await ledger.loadQuotaPause();
    if (!checkpoint) { process.exit(0); }
    console.log(JSON.stringify(checkpoint));
    break;
  }
  case 'check': {
    const checkpoint = await ledger.loadQuotaPause();
    if (!checkpoint) { console.log('NO_PAUSE'); process.exit(0); }
    const ready = isReadyToRetry(checkpoint, new Date());
    if (ready) {
      const delayMs = computeRetryDelayMs(checkpoint.resume_attempt_count, 0);
      console.log(JSON.stringify({ ready: true, next_safe_action: checkpoint.next_safe_action, attempt: checkpoint.resume_attempt_count, next_delay_ms: delayMs }));
      process.exit(0);
    } else {
      const waitMs = checkpoint.retry_not_before
        ? Math.max(0, new Date(checkpoint.retry_not_before).getTime() - Date.now())
        : computeRetryDelayMs(checkpoint.resume_attempt_count, 0);
      console.log(JSON.stringify({ ready: false, wait_ms: waitMs, wait_human: `${Math.ceil(waitMs / 60_000)}min`, next_safe_action: checkpoint.next_safe_action }));
      process.exit(1);
    }
  }
  case 'clear': {
    await ledger.clearQuotaPause();
    console.log(JSON.stringify({ ok: true, cleared: true }));
    break;
  }
  default:
    console.error(`Unknown command: ${cmd}. Use: write | read | check | clear`);
    process.exit(2);
}
