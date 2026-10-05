#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INVOCATION=$(sed -n '1,260p' "$REPO_ROOT/scripts/ai-company-loop.sh")
grep -q -- '--add-dir "$REPO_ROOT"' <<< "$INVOCATION"
grep -q -- '--mode accept-edits' <<< "$INVOCATION"
grep -q 'operating only in this checkout' <<< "$INVOCATION"
grep -q 'model_available' <<< "$INVOCATION"
grep -q 'RUNNER=codex' <<< "$INVOCATION"
grep -q 'exec --model' <<< "$INVOCATION"
grep -q 'Only RUNNER=codex is enabled' <<< "$INVOCATION"
grep -Fq 'CURRENT_MODEL="${AI_COMPANY_MODEL:-gpt-5.6-sol}"' <<< "$INVOCATION"
grep -Fq 'FALLBACK_MODEL="${AI_COMPANY_FALLBACK_MODEL:-Gemini 3.6 Flash (Medium)}"' <<< "$INVOCATION"
echo 'ai-company-loop invocation guard: pass'
grep -q "ai-company-doctor.mjs" scripts/ai-company-loop.sh
