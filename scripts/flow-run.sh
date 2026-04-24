#!/usr/bin/env bash
# Flow mode: Claude interactive + live observer polling session JSONL
#
# Usage:
#   ./scripts/flow-run.sh              # interactive Claude + live observer
#   ./scripts/flow-run.sh "Summarize"  # run with prompt + live observer
#   ./scripts/flow-run.sh -m sonnet    # specify model
#   ./scripts/flow-run.sh --detach     # create session but don't attach (for non-interactive use)
#
# Flow:
#   1. Starts live observer in background (polls session JSONL, renders TUI)
#   2. Runs Claude interactively (native TUI)
#   3. Observer updates in real-time as Claude works

set -euo pipefail

ROOT_DIR="${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SCHEME_DIR="$ROOT_DIR/scheme"

MODEL=""
PROMPT=""
DETACH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--model) MODEL="$2"; shift 2 ;;
    --detach) DETACH=1; shift ;;
    -h|--help)
      echo "Usage: $0 [-m MODEL] [--detach] [PROMPT]"
      echo ""
      echo "Options:"
      echo "  -m, --model MODEL    Specify Claude model (sonnet, opus, etc.)"
      echo "  --detach             Create session but don't attach (non-interactive mode)"
      echo "  -h, --help           Show this help"
      echo ""
      echo "Environment variables:"
      echo "  FLOW_TMUX_SESSION    Session name (default: flow-main)"
      echo "  FLOW_KEEP_SESSION    Set 1 to preserve session after exit"
      exit 0
      ;;
    *) break ;;
  esac
done

if [[ $# -gt 0 ]]; then
  for arg in "$@"; do
    PROMPT="$PROMPT $arg"
  done
  PROMPT="${PROMPT# }"
fi

# Auto-detect detach mode if no TTY
if [[ ! -t 0 ]] && [[ "$DETACH" == "0" ]]; then
  DETACH=1
  echo "[flow-run] Non-interactive shell detected. Using detach mode." >&2
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "flow-run: claude binary not found in PATH" >&2
  exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "flow-run: tmux is required" >&2
  exit 1
fi

SESSION_NAME="${FLOW_TMUX_SESSION:-flow-main}"
SESSION_ID="$(uuidgen | tr 'A-Z' 'a-z')"
KEEP_SESSION="${FLOW_KEEP_SESSION:-0}"
CLEAR_PANES="${FLOW_CLEAR_PANES:-1}"
CLEAR_HISTORY="${FLOW_CLEAR_HISTORY:-1}"
TMUX_HISTORY_LIMIT="${FLOW_TMUX_HISTORY_LIMIT:-5000}"

# Avoid background buildup: default to one reusable session name.
# If a session with the same name already exists, kill it before starting fresh.
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
fi

# Enable mouse scrolling
tmux set -g mouse on
tmux set -g history-limit "$TMUX_HISTORY_LIMIT"

# Create session
tmux new-session -d -s "$SESSION_NAME" -c "$ROOT_DIR"

if [[ "$CLEAR_PANES" == "1" ]]; then
  tmux send-keys -t "$SESSION_NAME:0.0" "clear" Enter
fi

# Left pane: Claude Code (interactive TUI)
MODEL_FLAG=""
if [[ -n "$MODEL" ]]; then
  MODEL_FLAG="--model $MODEL"
fi
tmux send-keys -t "$SESSION_NAME:0" "claude $MODEL_FLAG --session-id $SESSION_ID ${PROMPT:+"\"$PROMPT\""}" Enter

# Right pane: live observer (polls session JSONL)
# Pass exact session ID so observer doesn't pick up stale sessions
FLOW_SESSION_ID="$SESSION_ID" FLOW_PROJECT_DIR="$ROOT_DIR" tmux split-window -h -t "$SESSION_NAME:0" -c "$SCHEME_DIR"
if [[ "$CLEAR_PANES" == "1" ]]; then
  tmux send-keys -t "$SESSION_NAME:0.1" "clear" Enter
fi
tmux send-keys -t "$SESSION_NAME:0" "FLOW_PROJECT_DIR=\"$ROOT_DIR\" FLOW_SESSION_ID=\"$SESSION_ID\" bun run src/main.ts --live" Enter

# Label panes
tmux select-pane -t "$SESSION_NAME:0.0" -T "claude"
tmux select-pane -t "$SESSION_NAME:0.1" -T "observer"
tmux select-pane -t "$SESSION_NAME:0.0"
tmux select-layout -t "$SESSION_NAME:0" even-horizontal

# If in detach mode, output session info and exit
if [[ "$DETACH" == "1" ]]; then
  echo ""
  echo "========================================"
  echo "  Flow Session Created"
  echo "========================================"
  echo ""
  echo "Session: $SESSION_NAME"
  echo "Session ID: $SESSION_ID"
  echo ""
  echo "Panes:"
  echo "  - Left:  Claude Code TUI"
  echo "  - Right: Live observer"
  echo ""
  echo "To attach to the session, run:"
  echo ""
  echo "  tmux attach -t $SESSION_NAME"
  echo ""
  echo "Or from repo root:"
  echo "  ./scripts/flow-run.sh"
  echo ""
  echo "Detach with: Ctrl+B D"
  echo ""
  exit 0
fi

# Attach (interactive mode)
tmux attach-session -t "$SESSION_NAME"

# When user exits/detaches, clean session by default to prevent orphan processes.
if [[ "$KEEP_SESSION" != "1" ]]; then
  if [[ "$CLEAR_HISTORY" == "1" ]]; then
    tmux clear-history -t "$SESSION_NAME:0.0" 2>/dev/null || true
    tmux clear-history -t "$SESSION_NAME:0.1" 2>/dev/null || true
  fi
  tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
fi
