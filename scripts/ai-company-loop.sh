#!/usr/bin/env bash
# ==============================================================================
# MACRO OS AUTONOMOUS PRODUCT COMPANY — EXTERNAL LOOP CONTROLLER
# Version: 3.0.0 (Multi-runner local company controller)
# Description: Invokes a configured local AI runner sequentially epoch-by-epoch
#              with strict Macro OS scope validation and guardrail checks.
# ==============================================================================

set -u

# Ensure working directory is repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# 1. Environment & PATH setup
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# 2. Mandatory Repository Truth Sources Verification
if [[ ! -d ".ai-company" || ! -f "AGENTS.md" || ! -f "docs/PRODUCT_GOAL.md" ]]; then
  echo "[ERROR] Mandatory repository truth sources (.ai-company, AGENTS.md, docs/PRODUCT_GOAL.md) missing." >&2
  exit 1
fi

# 2.4 Load explicit execution authority from active execution lease if present
LEASE_FILE=".ai-company/runtime/EXECUTION_LEASE.json"
if [[ -f "$LEASE_FILE" ]]; then
  LEASE_RUNNER=$(node -e "try { const l = JSON.parse(require('fs').readFileSync('$LEASE_FILE','utf8')); if (l.status === 'ACTIVE') console.log(l.runner); } catch(e) {}" 2>/dev/null || echo "")
  LEASE_MODEL=$(node -e "try { const l = JSON.parse(require('fs').readFileSync('$LEASE_FILE','utf8')); if (l.status === 'ACTIVE') console.log(l.runtime_model_id); } catch(e) {}" 2>/dev/null || echo "")
  if [[ -n "$LEASE_RUNNER" && -z "${RUNNER:-}" ]]; then
    RUNNER="$LEASE_RUNNER"
  fi
  if [[ -n "$LEASE_MODEL" && -z "${AI_COMPANY_MODEL:-}" ]]; then
    AI_COMPANY_MODEL="$LEASE_MODEL"
  fi
fi

# 2.5 Select and normalize the local AI runner
if [[ -z "${RUNNER:-}" ]]; then
  if [[ -n "${ANTIGRAVITY_AGENT:-}" || -n "${ANTIGRAVITY_CONVERSATION_ID:-}" || -d "$HOME/.gemini/antigravity" ]] && command -v agy >/dev/null 2>&1; then
    RUNNER="agy"
  else
    RUNNER="codex"
  fi
fi

if [[ "$RUNNER" == "antigravity" ]]; then
  RUNNER="agy"
fi

if [[ "${AI_COMPANY_DOCTOR_ON_START:-1}" == "1" ]]; then
  echo "[DOCTOR] Checking AI Company workspace before starting controller."
  if ! RUNNER="$RUNNER" node scripts/ai-company-doctor.mjs; then
    echo "[PAUSE] Company doctor blocked startup; fix the reported checks first." >&2
    exit 7
  fi
fi

mkdir -p .ai-company/logs .ai-company/epochs

# Quiet mode keeps controller progress in a durable log instead of flooding the
# terminal. Errors remain on stderr so a human can still react to failures.
# Enable with `QUIET=1 ./scripts/ai-company-loop.sh 10`.
QUIET_MODE="${QUIET:-0}"
if [[ "$QUIET_MODE" == "1" ]]; then
  exec 1>>".ai-company/logs/controller.log"
fi

# 3. Check the selected local AI runner
if [[ "$RUNNER" == "antigravity" ]]; then
  RUNNER="agy"
fi

if [[ "$RUNNER" != "codex" && "$RUNNER" != "agy" ]]; then
  echo "[ERROR] Only RUNNER=codex is enabled or RUNNER=agy; refusing to invoke $RUNNER." >&2
  exit 6
fi
case "$RUNNER" in
  agy)
    RUNNER_BIN="$(command -v agy || true)"
    RUNNER_DISPLAY="Antigravity"
    ;;
  codex)
    RUNNER_BIN="$(command -v codex || true)"
    RUNNER_DISPLAY="Codex"
    ;;
  *)
    echo "[ERROR] Unsupported RUNNER=$RUNNER. Use RUNNER=codex." >&2
    exit 6
    ;;
esac
if [[ -z "$RUNNER_BIN" ]]; then
  echo "======================================================================" >&2
  echo "[CONTROLLER ERROR] $RUNNER_DISPLAY CLI is not found in PATH." >&2
  echo "Install the selected local runner or choose another supported runner." >&2
  echo "The controller will NOT simulate AI epochs with build scripts." >&2
  echo "Please install or add 'agy' to your PATH and rerun." >&2
  echo "======================================================================" >&2
  exit 127
fi

# 4. Single-Instance Lock Management
LOCK_FILE=".ai-company/.controller.lock"
if [[ -f "$LOCK_FILE" ]]; then
  EXISTING_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "[ABORT] Another controller instance is actively running (PID: $EXISTING_PID)." >&2
    exit 2
  else
    echo "[WARN] Removing stale lock file from PID $EXISTING_PID."
    rm -f "$LOCK_FILE"
  fi
fi

echo $$ > "$LOCK_FILE"
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT INT TERM

# 5. Parameters & Configuration
MAX_EPOCHS=${1:-999999}
PROMPT_FILE=".ai-company/prompts/run-next-epoch.md"
STOP_FILE=".ai-company/STOP"
STATE_FILE=".ai-company/company-state.json"
LEDGER_FILE=".ai-company/epoch-ledger.jsonl"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[ERROR] Prompt file $PROMPT_FILE not found." >&2
  exit 1
fi

echo "======================================================================"
echo " Starting Macro OS Autonomous Company Loop (Guarded Scope Edition)"
echo " Maximum Epochs: $MAX_EPOCHS"
echo " State Location: $REPO_ROOT/.ai-company"
echo " CLI Runner: $RUNNER_DISPLAY ($RUNNER_BIN)"
echo " Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "======================================================================"

epoch_count=0
consecutive_errors=0
quota_failovers=0
MAX_QUOTA_FAILOVERS="${MAX_QUOTA_FAILOVERS:-2}"

if [[ "$RUNNER" == "agy" ]]; then
  CURRENT_MODEL="${AI_COMPANY_MODEL:-gemini-3.7-flash-high}"
else
  CURRENT_MODEL="${AI_COMPANY_MODEL:-gpt-5.6-sol}"
fi
FALLBACK_MODEL="${AI_COMPANY_FALLBACK_MODEL:-Gemini 3.6 Flash (Medium)}"
ROLE_LOOP_ENABLED="${AI_COMPANY_ROLE_LOOP:-1}"
ROLE_MAX_CONCURRENCY="${AI_COMPANY_ROLE_MAX_CONCURRENCY:-2}"
CODEX_SANDBOX="${AI_COMPANY_CODEX_SANDBOX:-danger-full-access}"

model_available() {
  if [[ "$RUNNER" == "agy" ]]; then
    agy models 2>/dev/null | grep -Fq -- "$1"
  else
    # Codex resolves model names server-side; availability is proven by the
    # invocation itself and must not be guessed from a separate model list.
    [[ -n "$1" ]]
  fi
}

if ! model_available "$CURRENT_MODEL"; then
  echo "[PAUSE] Configured model is not available in agy models: $CURRENT_MODEL" >&2
  exit 5
fi

while [[ $epoch_count -lt $MAX_EPOCHS ]]; do
  # Check for STOP signals
  if [[ -f "$STOP_FILE" ]]; then
    echo "[STOP] Found stop signal at $STOP_FILE. Halting cleanly."
    rm -f "$STOP_FILE"
    break
  fi

  # Check if stop was requested in company-state.json
  if grep -q '"stop_requested": true' "$STATE_FILE" 2>/dev/null; then
    echo "[STOP] Stop requested in $STATE_FILE. Halting cleanly."
    break
  fi

  CURRENT_TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
  LOG_FILE=".ai-company/logs/epoch_${CURRENT_TIMESTAMP}.log"

  echo ""
  echo "==> [EPOCH RUN #$((epoch_count + 1))] Starting at $(date -u +"%Y-%m-%dT%H:%M:%SZ")..."
  echo "    Model: $CURRENT_MODEL"
  echo "    Logging to: $LOG_FILE"

  if [[ "${AI_COMPANY_AUTONOMOUS_CONTINUATION:-0}" == "1" ]]; then
    echo "[AUTONOMOUS CONTINUATION] Executing autonomous product continuation cycle..."
    if ! node --import tsx scripts/ai-company-product-continuation.mjs --project-id macro-os --runner "$RUNNER" --model "$CURRENT_MODEL" --max-concurrent "$ROLE_MAX_CONCURRENCY"; then
      echo "[WARN] Autonomous continuation returned non-zero code." >&2
      consecutive_errors=$((consecutive_errors + 1))
    else
      echo "[SUCCESS] Autonomous product continuation cycle completed successfully."
      epoch_count=$((epoch_count + 1))
      consecutive_errors=0
    fi
    sleep 2
    continue
  fi

  # Execute a real local headless AI runner with a 10 minute timeout.
  # Explicitly attach the checkout so the runner cannot drift into another repo.
  EPOCH_PROMPT="You are operating only in this checkout: $REPO_ROOT. Read the repository files there first. Do not search the web or any other directory.\n\n$(cat "$PROMPT_FILE")"
  if [[ "$RUNNER" == "agy" ]]; then
    "$RUNNER_BIN" --model "$CURRENT_MODEL" --mode accept-edits --dangerously-skip-permissions --add-dir "$REPO_ROOT" --print-timeout 10m -p "$EPOCH_PROMPT" > "$LOG_FILE" 2>&1
  else
    "$RUNNER_BIN" exec --model "$CURRENT_MODEL" --cd "$REPO_ROOT" --add-dir "$REPO_ROOT" --sandbox "$CODEX_SANDBOX" "$EPOCH_PROMPT" > "$LOG_FILE" 2>&1
  fi
  if [[ $? -eq 0 ]]; then
    # Verify epoch completion criteria
    if grep -q "COMPANY_EPOCH_COMPLETE" "$LOG_FILE"; then
      
      # 🛡️ SCOPE GUARDRAIL: Strict rejection of out-of-scope initiatives in recorded charter/state
      # Disallowed: CBDC, atomic settlement, DvP, sanctions screening, quantum clearing, crypto tokenization
      LATEST_CHARTER=$(tail -n 1 "$LEDGER_FILE" 2>/dev/null | grep -o '"charter":[^,}]*' || echo "")
      CURRENT_CONSTRAINT=$(grep '"current_constraint"' "$STATE_FILE" 2>/dev/null || echo "")
      
      if echo "$LATEST_CHARTER $CURRENT_CONSTRAINT" | grep -iqE "cbdc|delivery-versus-payment|\bdvp\b|sanctions screening|sanctions blacklist|quantum-resilient|rehypothecation|swap facility|tokenization"; then
        echo "======================================================================" >&2
        echo "[VALIDATION FAILED: OUT OF SCOPE INITIATIVE DETECTED IN CHARTER/STATE]" >&2
        echo "Charter: $LATEST_CHARTER" >&2
        echo "Macro OS scope is strictly bounded to macroeconomic research & data intelligence." >&2
        echo "Epoch rejected. State will not be advanced for this out-of-scope work." >&2
        echo "======================================================================" >&2
        consecutive_errors=$((consecutive_errors + 1))
      else
        echo "[SUCCESS] Epoch execution confirmed via COMPANY_EPOCH_COMPLETE block and passed all Scope Guardrails."
        epoch_count=$((epoch_count + 1))
        consecutive_errors=0
        if [[ "$ROLE_LOOP_ENABLED" == "1" ]]; then
          echo "[ROLE COORDINATOR] Dispatching handoff-backed role work (max concurrency: $ROLE_MAX_CONCURRENCY)."
          if ! node --import tsx scripts/ai-company-run-ready.mjs --project-id macro-os --runner "$RUNNER" --model "$CURRENT_MODEL" --max-concurrent "$ROLE_MAX_CONCURRENCY"; then
            echo "[WARN] Role coordinator failed; preserving queue and pausing after the epoch." >&2
            consecutive_errors=$((consecutive_errors + 1))
          fi
        fi
      fi

    else
      echo "[WARN] Invocation finished with code 0 but COMPANY_EPOCH_COMPLETE block was missing."
      consecutive_errors=$((consecutive_errors + 1))
    fi
  else
    EXIT_CODE=$?
    echo "[WARN] agy invocation exited with code $EXIT_CODE."

    # Check for Quota / Rate-limit exhaustion and trigger automatic model failover
    if grep -iqE "quota|rate limit|too many requests|resource_exhausted" "$LOG_FILE" 2>/dev/null; then
      if [[ -f "$LEASE_FILE" ]]; then
        echo "[RESOURCE WAIT] Provider quota exhausted for $CURRENT_MODEL. Recording WAIT_SAME_PROVIDER without silent fallback." >&2
        node --import tsx -e "import { ExecutionLeaseManager } from './server/aiCompany/executionLease.ts'; new ExecutionLeaseManager('.').recordQuotaWait('Quota exhausted: $CURRENT_MODEL').catch(() => null);" 2>/dev/null || true
        echo "[PAUSE] Preserving handoff and state. Exiting with pause code 4." >&2
        exit 4
      fi
      quota_failovers=$((quota_failovers + 1))
      if [[ $quota_failovers -gt $MAX_QUOTA_FAILOVERS ]]; then
        echo "[CIRCUIT OPEN] Provider quota/rate-limit failures exceeded MAX_QUOTA_FAILOVERS=$MAX_QUOTA_FAILOVERS." >&2
        echo "[PAUSE] Preserving handoff and state. Exiting with pause code 4." >&2
        exit 4
      fi
      # Compare against the configured display name used by `agy models`.
      # The previous slug comparison could never match, silently disabling
      # automatic failover when the primary provider exhausted its quota.
      if [[ "$CURRENT_MODEL" == "Claude Sonnet 4.6 (Thinking)" ]]; then
        echo "======================================================================"
        echo "[AUTO-FAILOVER] Claude quota reached. Automatically switching to Gemini 3.6 Flash (Medium)..."
        echo "======================================================================"
        CURRENT_MODEL="$FALLBACK_MODEL"
        if ! model_available "$CURRENT_MODEL"; then
          echo "[CIRCUIT OPEN] Fallback model is not available in agy models: $CURRENT_MODEL" >&2
          exit 5
        fi
        sleep $((2 ** quota_failovers))
        continue
      elif [[ "$CURRENT_MODEL" == "Gemini 3.6 Flash (Medium)" ]]; then
        echo "======================================================================"
        echo "[AUTO-FAILOVER] Gemini quota reached. Trying to switch back to Claude Sonnet 4.6..."
        echo "======================================================================"
        CURRENT_MODEL="Claude Sonnet 4.6 (Thinking)"
        if ! model_available "$CURRENT_MODEL"; then
          echo "[CIRCUIT OPEN] Primary model is not available in agy models: $CURRENT_MODEL" >&2
          exit 5
        fi
        sleep $((2 ** quota_failovers))
        continue
      else
        echo "[PAUSE] All provider quotas exhausted."
        echo "        Preserving handoff and state. Exiting with pause code 4."
        exit 4
      fi
    fi

    consecutive_errors=$((consecutive_errors + 1))
  fi

  if [[ $consecutive_errors -ge 3 ]]; then
    echo "[ERROR] 3 consecutive errors or validation failures encountered. Halting loop for safety." >&2
    exit 3
  fi

  sleep 2
done

echo "======================================================================"
echo " Macro OS Autonomous Company Loop Terminated Gracefully"
echo " Total Epochs Successfully Executed: $epoch_count"
echo "======================================================================"
