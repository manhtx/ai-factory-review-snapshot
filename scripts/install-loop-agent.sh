#!/usr/bin/env bash
# ==============================================================================
# AI COMPANY LOOP AGENT INSTALLER
# Version: 1.0.0
# Usage: bash scripts/install-loop-agent.sh [--uninstall]
# Description: Renders and installs the com.macrolens.ai-company-loop LaunchAgent.
#              One-shot installer. Safe to re-run — overwrites existing install.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$REPO_ROOT/launchagents/com.macrolens.ai-company-loop.plist"
LABEL="com.macrolens.ai-company-loop"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
DEST="$LAUNCH_AGENTS_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/AICompany"

# ── Uninstall ──────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "[UNINSTALL] Stopping and unloading $LABEL..."
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$DEST"
  echo "[UNINSTALL] Done. $DEST removed."
  exit 0
fi

# ── Preflight ──────────────────────────────────────────────────────────────────
if [[ ! -f "$TEMPLATE" ]]; then
  echo "[ERROR] Template not found: $TEMPLATE" >&2
  exit 1
fi
if [[ ! -f "$REPO_ROOT/scripts/ai-company-continuity-kernel.mjs" ]]; then
  echo "[ERROR] Continuity kernel not found: $REPO_ROOT/scripts/ai-company-continuity-kernel.mjs" >&2
  exit 1
fi

BASH_PATH="$(command -v bash)"
NODE_PATH="$(command -v node 2>/dev/null || echo "/usr/local/bin/node")"

echo "[INSTALL] Rendering plist template..."
echo "  REPO_ROOT  = $REPO_ROOT"
echo "  BASH_PATH  = $BASH_PATH"
echo "  HOME       = $HOME"
echo "  DEST       = $DEST"

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"
mkdir -p "$REPO_ROOT/.ai-company/logs"

# Render: substitute template variables
sed \
  -e "s|__REPO_ROOT__|$REPO_ROOT|g" \
  -e "s|__BASH_PATH__|$BASH_PATH|g" \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__NODE_PATH__|$NODE_PATH|g" \
  "$TEMPLATE" > "$DEST"

echo "[INSTALL] Plist written to $DEST"

# ── Unload previous version if loaded ─────────────────────────────────────────
if launchctl print "gui/$(id -u)/$LABEL" &>/dev/null; then
  echo "[INSTALL] Unloading previous version..."
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  sleep 1
fi

# ── Load new version ───────────────────────────────────────────────────────────
echo "[INSTALL] Loading $LABEL..."
launchctl bootstrap "gui/$(id -u)" "$DEST"

echo ""
echo "======================================================================"
echo " AI Company Loop Agent installed successfully."
echo ""
echo " The loop supervisor will start automatically when you:"
echo "   launchctl kickstart -k gui/\$(id -u)/$LABEL"
echo ""
echo " To STOP the loop without uninstalling:"
echo "   touch $REPO_ROOT/.ai-company/COMPANY_STOP"
echo ""
echo " To RESUME after a stop:"
echo "   rm $REPO_ROOT/.ai-company/COMPANY_STOP"
echo "   launchctl kickstart -k gui/\$(id -u)/$LABEL"
echo ""
echo " To uninstall:"
echo "   bash $SCRIPT_DIR/install-loop-agent.sh --uninstall"
echo ""
echo " Logs:"
echo "   Supervisor: $LOG_DIR/loop-supervisor.stdout.log"
echo "   Loop:       $REPO_ROOT/.ai-company/logs/loop-supervisor.log"
echo "======================================================================"
