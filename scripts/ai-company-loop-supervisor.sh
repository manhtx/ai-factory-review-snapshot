#!/usr/bin/env bash
# ==============================================================================
# AI COMPANY LOOP SUPERVISOR — DUMB RESTART WRAPPER
# Version: 1.0.0
# Description: Manages ai-company-loop.sh lifecycle under launchd.
#              Restarts ONLY on recoverable exit codes (4=quota, 5=model-unavailable).
#              Respects COMPANY_STOP sentinel for intentional operator stops.
#              No product reasoning. No backlog inspection. Purely lifecycle.
# ==============================================================================
#
# Exit codes from ai-company-loop.sh and what this supervisor does:
#   0   — graceful completion (STOP_FILE or MAX_EPOCHS reached) → check COMPANY_STOP sentinel
#   1   — missing required files → TERMINAL (operator fix needed)
#   2   — duplicate lock (another copy running) → TERMINAL for this launch
#   3   — 3 consecutive errors (circuit breaker) → TERMINAL (operator review)
#   4   — quota exhausted (WAITING_RESOURCE) → RESUMABLE, sleep wait_ms from checkpoint
#   5   — model unavailable → RESUMABLE, bounded backoff retry
#   6   — wrong runner config → TERMINAL (operator config fix)
#   7   — doctor blocked startup → TERMINAL (operator fix)
#   127 — CLI binary not found → TERMINAL
#   130 — SIGINT (Ctrl-C) → honour as intentional stop → TERMINAL
#   143 — SIGTERM → honour as intentional stop → TERMINAL
#
# COMPANY_STOP sentinel: .ai-company/COMPANY_STOP
#   If present at startup or after a loop exit, supervisor exits cleanly.
#   launchd will NOT restart the supervisor while COMPANY_STOP is present
#   (because the supervisor exits with code 0, and KeepAlive only re-fires
#   when the process exits non-zero in default config; we use KeepAlive: true
#   but the supervisor deliberately exits 0 for intentional stops so the
#   KeepAlive will restart immediately — see install-loop-agent.sh which
#   sets KeepAlive with ThrottleInterval + COMPANY_STOP awareness).
#
#   IMPORTANT: launchd KeepAlive will restart this supervisor on any exit.
#   The supervisor is the authoritative gate: it checks COMPANY_STOP and
#   exits 0 cleanly. launchd then re-fires the supervisor, which re-checks
#   COMPANY_STOP and exits 0 again. This is safe because ThrottleInterval
#   limits how fast launchd can loop (default 10s). Remove COMPANY_STOP
#   to allow the supervisor to actually start the loop.
# ==============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# ── Constants (all overridable via env vars for test isolation) ────────────────
STOP_SENTINEL="${STOP_SENTINEL:-$REPO_ROOT/.ai-company/COMPANY_STOP}"
EXIT_CODE_FILE="${EXIT_CODE_FILE:-$REPO_ROOT/.ai-company/last-exit-code}"
SUPERVISOR_LOG="${SUPERVISOR_LOG:-$REPO_ROOT/.ai-company/logs/loop-supervisor.log}"
QUOTA_PAUSE_FILE="${QUOTA_PAUSE_FILE:-${AI_COMPANY_STATE_DIR:-$REPO_ROOT/.ai-company/runtime}/projects/macro-os/quota-pause.json}"
MAX_RESTART_ATTEMPTS="${AI_COMPANY_SUPERVISOR_MAX_RESTARTS:-5}"

# Backoff delays (seconds) indexed by attempt number (0-based):
# attempt 0 → 5s, 1 → 30s, 2 → 60s, 3 → 300s, 4 → 900s
MODEL_UNAVAIL_BACKOFFS=(5 30 60 300 900)

mkdir -p "$(dirname "$SUPERVISOR_LOG")"

sup_log() {
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[$ts] [SUPERVISOR] $*" | tee -a "$SUPERVISOR_LOG" >&2
}

sup_log "Supervisor started (PID=$$, MAX_RESTARTS=$MAX_RESTART_ATTEMPTS)"

# ── COMPANY_STOP check ─────────────────────────────────────────────────────────
company_stop_requested() {
  [[ -f "$STOP_SENTINEL" ]]
}

# ── Read quota wait_ms from quota-pause.json ───────────────────────────────────
quota_wait_seconds() {
  # Returns seconds to wait until retry_not_before, minimum 60 (or $AI_COMPANY_SUPERVISOR_MIN_QUOTA_WAIT_SECS).
  # Falls back to 900 (15 min) if checkpoint is unreadable or already past.
  local node_bin min_wait
  min_wait="${AI_COMPANY_SUPERVISOR_MIN_QUOTA_WAIT_SECS:-60}"
  node_bin="$(command -v node || command -v /usr/local/bin/node || echo "")"
  if [[ -z "$node_bin" || ! -f "$QUOTA_PAUSE_FILE" ]]; then
    echo 900
    return
  fi
  QUOTA_PAUSE_FILE="$QUOTA_PAUSE_FILE" MIN_WAIT_SECS="$min_wait" "$node_bin" -e '
    try {
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync(process.env.QUOTA_PAUSE_FILE, "utf8"));
      if (p.status !== "WAITING_RESOURCE") { process.stdout.write("0"); process.exit(0); }
      if (!p.retry_not_before) { process.stdout.write("900"); process.exit(0); }
      const waitMs = Date.parse(p.retry_not_before) - Date.now();
      const minWait = Number(process.env.MIN_WAIT_SECS || 60);
      process.stdout.write(String(Math.max(minWait, Math.ceil(waitMs / 1000))));
    } catch { process.stdout.write("900"); }
  ' 2>/dev/null || echo "900"
}

# ── Main restart loop ──────────────────────────────────────────────────────────
attempt=0

while true; do
  # Always check COMPANY_STOP before starting the loop
  if company_stop_requested; then
    sup_log "COMPANY_STOP sentinel present. Supervisor sleeping 60s then re-checking."
    # Do NOT exit — launchd would immediately restart us. Instead sleep so
    # we don't spin-burn CPU while stop is in effect.
    sleep 60
    continue
  fi

  if [[ $attempt -ge $MAX_RESTART_ATTEMPTS ]]; then
    sup_log "MAX_RESTART_ATTEMPTS ($MAX_RESTART_ATTEMPTS) reached. Writing COMPANY_STOP and exiting — operator review required."
    touch "$STOP_SENTINEL"
    exit 3
  fi

  # AI_COMPANY_LOOP_SCRIPT: test seam. If set, runs the specified script
  # instead of ai-company-loop.sh. The supervisor's restart logic is identical.
  # The harness may inject failures via a mock script but must NOT directly
  # start the process that is supposed to be auto-woken (Section 51).
  LOOP_SCRIPT="${AI_COMPANY_LOOP_SCRIPT:-$SCRIPT_DIR/ai-company-loop.sh}"
  sup_log "Starting loop (attempt=$((attempt + 1))/$MAX_RESTART_ATTEMPTS): $LOOP_SCRIPT"
  bash "$LOOP_SCRIPT" "$@"
  LOOP_EXIT=$?

  # Write exit code for observability
  echo "$LOOP_EXIT" > "$EXIT_CODE_FILE"
  sup_log "ai-company-loop.sh exited with code $LOOP_EXIT"

  # Check COMPANY_STOP immediately after exit (loop may have written it)
  if company_stop_requested; then
    sup_log "COMPANY_STOP sentinel present post-exit. Supervisor sleeping 60s then re-checking."
    sleep 60
    continue
  fi

  case "$LOOP_EXIT" in
    0)
      # Graceful completion (MAX_EPOCHS or STOP_FILE). Loop did its job.
      # Reset attempt counter; next wake is a fresh start.
      GRACEFUL_SLEEP="${AI_COMPANY_SUPERVISOR_GRACEFUL_SLEEP_SECS:-30}"
      sup_log "Loop completed gracefully (exit 0). Resetting restart counter. Sleeping ${GRACEFUL_SLEEP}s."
      attempt=0
      sleep "$GRACEFUL_SLEEP"
      ;;
    2)
      # Another copy is running — back off and let the other copy finish
      sup_log "Another controller instance is active (exit 2). Sleeping 60s."
      sleep 60
      # Don't increment attempt — this is a coordination event, not a failure
      ;;
    4)
      # Quota exhausted — WAITING_RESOURCE — sleep checkpoint delay then restart
      WAIT_SECS=$(quota_wait_seconds)
      sup_log "Quota exhausted (exit 4). Sleeping ${WAIT_SECS}s before restart (reading quota-pause checkpoint)."
      sleep "$WAIT_SECS"
      attempt=$((attempt + 1))
      ;;
    5)
      # Model unavailable — bounded backoff
      IDX=$((attempt < ${#MODEL_UNAVAIL_BACKOFFS[@]} ? attempt : ${#MODEL_UNAVAIL_BACKOFFS[@]} - 1))
      BACKOFF=${MODEL_UNAVAIL_BACKOFFS[$IDX]}
      sup_log "Model unavailable (exit 5). Sleeping ${BACKOFF}s before retry."
      sleep "$BACKOFF"
      attempt=$((attempt + 1))
      ;;
    130|143)
      # SIGINT / SIGTERM — intentional operator signal, write stop sentinel and idle
      sup_log "Loop terminated by operator signal (exit $LOOP_EXIT). Writing COMPANY_STOP sentinel."
      touch "$STOP_SENTINEL"
      sleep 60
      ;;
    137|139|134|135)
      # Process crash / unexpected termination (SIGKILL, SIGSEGV, SIGABRT, SIGBUS)
      # Recoverable crash: bounded retry up to MAX_RESTART_ATTEMPTS
      sup_log "Loop crashed with signal exit code $LOOP_EXIT. Attempting recovery ($((attempt + 1))/$MAX_RESTART_ATTEMPTS)."
      sleep 2
      attempt=$((attempt + 1))
      ;;
    *)
      # All other codes (1, 3, 6, 7, 127) are terminal configuration/logic errors — operator fix required
      sup_log "Terminal exit code $LOOP_EXIT. Writing COMPANY_STOP sentinel. Operator review required."
      touch "$STOP_SENTINEL"
      sleep 60
      ;;
  esac
done
