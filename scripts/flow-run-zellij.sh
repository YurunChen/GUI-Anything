#!/usr/bin/env bash
# Flow mode (Zellij): Claude interactive + live observer side-by-side in current terminal.
#
# Usage:
#   ./scripts/flow-run-zellij.sh              # New session
#   ./scripts/flow-run-zellij.sh -c           # Continue last session
#   ./scripts/flow-run-zellij.sh --continue   # Continue last session
#   ./scripts/flow-run-zellij.sh -r           # Resume (native picker)
#   ./scripts/flow-run-zellij.sh --resume     # Resume (native picker)
#   ./scripts/flow-run-zellij.sh -r ID        # Resume specific session
#   ./scripts/flow-run-zellij.sh --resume ID  # Resume specific session
#   ./scripts/flow-run-zellij.sh -m sonnet
#   ./scripts/flow-run-zellij.sh -m sonnet "Summarize this repo"

set -euo pipefail

ROOT_DIR="${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SCHEME_DIR="$ROOT_DIR/scheme"
FLOW_DATA_DIR="${FLOW_DATA_DIR:-$ROOT_DIR/.flow-runtime}"
SNAPSHOT_DIR="${FLOW_SNAPSHOT_DIR:-$FLOW_DATA_DIR}"
MODEL=""
CONTINUE=0
RESUME=0
RESUME_ID=""
CLEANUP_ONLY=0
SESSION_NAME="${FLOW_ZELLIJ_SESSION:-f-$(date +%m%d-%H%M%S)-$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-4)}"
REUSE_SESSION="${FLOW_ZELLIJ_REUSE:-0}"
OBSERVER_WIDTH="${FLOW_ZELLIJ_OBSERVER_WIDTH:-}"
CLAUDE_EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--model) MODEL="${2:-}"; shift 2 ;;
    -c|--continue) CONTINUE=1; shift ;;
    -r|--resume)
      RESUME=1
      # Optional argument: if $2 exists and doesn't start with -, treat as ID
      if [[ -n "${2:-}" && ! "${2:-}" =~ ^- ]]; then
        RESUME_ID="$2"
        shift 2
      else
        # No ID provided, use native picker mode
        RESUME_ID=""
        shift
      fi
      ;;
    --cleanup)
      CLEANUP_ONLY=1
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS] [PROMPT]"
      echo ""
      echo "Session Modes:"
      echo "  (none)               Start new session (default)"
      echo "  -c, --continue       Continue last session (binds observer to same session)"
      echo "  -r, --resume         Resume using Claude Code native session picker"
      echo "  -r ID, --resume ID   Resume specific session ID (binds observer to same session)"
      echo ""
      echo "Options:"
      echo "  -m, --model MODEL    Specify Claude model (sonnet, opus, etc.)"
      echo "  -c, --continue       Continue last Claude session"
      echo "  -r, --resume [ID]    Resume session (uses native picker if ID omitted)"
      echo "      --cleanup        Kill/delete stale flow zellij sessions and exit"
      echo ""
      echo "Environment variables:"
      echo "  FLOW_ZELLIJ_SESSION         Session name (default: unique short f-mmdd-HHMMSS-xxxx)"
      echo "  FLOW_ZELLIJ_REUSE           Set 1 to reuse existing session (default: 0)"
      echo "  FLOW_ZELLIJ_OBSERVER_WIDTH  Right pane width percentage (default: auto by terminal width)"
      echo "  ZELLIJ_SOCKET_DIR           Socket dir (default: /tmp/zellij)"
      echo "  FLOW_PROJECT_DIR            Project root override"
      exit 0
      ;;
    *) break ;;
  esac
done

# Any remaining args are forwarded to Claude CLI as-is.
if [[ $# -gt 0 ]]; then
  CLAUDE_EXTRA_ARGS=("$@")
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "flow-run-zellij: claude binary not found in PATH" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "flow-run-zellij: bun binary not found in PATH" >&2
  exit 1
fi

if ! command -v zellij >/dev/null 2>&1; then
  echo "flow-run-zellij: zellij binary not found in PATH" >&2
  exit 1
fi

export ZELLIJ_SOCKET_DIR="${ZELLIJ_SOCKET_DIR:-/tmp/zellij}"
mkdir -p "$ZELLIJ_SOCKET_DIR"

kdl_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

if [[ -z "$OBSERVER_WIDTH" ]]; then
  cols="$(tput cols 2>/dev/null || echo 0)"
  if [[ "$cols" =~ ^[0-9]+$ ]]; then
    if (( cols >= 220 )); then
      OBSERVER_WIDTH=38
    elif (( cols >= 180 )); then
      OBSERVER_WIDTH=42
    elif (( cols >= 150 )); then
      OBSERVER_WIDTH=46
    else
      OBSERVER_WIDTH=50
    fi
  else
    OBSERVER_WIDTH=46
  fi
fi

# Helpers
list_zellij_sessions_plain() {
  zellij list-sessions 2>/dev/null | sed -E 's/\x1b\[[0-9;]*m//g' || true
}

latest_exited_session_name() {
  list_zellij_sessions_plain | awk '/EXITED/ {print $1; exit}'
}

latest_session_name() {
  list_zellij_sessions_plain | awk 'NF>0 {print $1; exit}'
}

cleanup_flow_zellij_sessions() {
  # Kill active sessions first, then delete exited metadata entries.
  zellij kill-all-sessions -y >/dev/null 2>&1 || true
  zellij delete-all-sessions -y >/dev/null 2>&1 || true
  # Best-effort cleanup of stale flow layout snapshots.
  rm -f "$SNAPSHOT_DIR"/zellij-layout-*.kdl >/dev/null 2>&1 || true
}

prune_sessions_keep_one() {
  local keep="$1"
  while read -r s; do
    [[ -n "$s" ]] || continue
    [[ "$s" == "$keep" ]] && continue
    zellij delete-session "$s" >/dev/null 2>&1 || true
  done < <(list_zellij_sessions_plain | awk '{print $1}')
}

if [[ "$CLEANUP_ONLY" == "1" ]]; then
  cleanup_flow_zellij_sessions
  echo "[flow-run-zellij] Cleanup done."
  exit 0
fi

# Extract FLOW_SESSION_ID from layout file containing given zellij session name
extract_session_id_from_layout() {
  local zellij_session="$1"
  local layout_dir="$2"
  for layout_file in "$layout_dir"/zellij-layout-*.kdl; do
    [[ -f "$layout_file" ]] || continue
    if grep -q "FLOW_ZELLIJ_SESSION=\"$zellij_session\"" "$layout_file" 2>/dev/null; then
      basename "$layout_file" | sed 's/zellij-layout-//; s/\.kdl$//'
      return 0
    fi
  done
  return 1
}

# Determine session mode and IDs
if [[ -n "$RESUME_ID" ]]; then
  # Resume specific session (-r ID or --resume ID)
  SESSION_ID="$RESUME_ID"
  SESSION_NAME="$RESUME_ID"
  echo "[flow-run-zellij] Resuming session: $SESSION_ID"
elif [[ "$RESUME" == "1" ]]; then
  # Resume with native picker (-r or --resume without ID)
  # Must start a fresh Claude pane so native picker is shown.
  SESSION_NAME="r-$(date +%m%d-%H%M%S)-$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-4)"
  REUSE_SESSION=0
  # Observer will use auto-discovery since we don't know which session user will pick
  SESSION_ID=""
  echo "[flow-run-zellij] Resume mode: using Claude native session picker (zellij: $SESSION_NAME)"
  echo "[flow-run-zellij] Note: observer will auto-discover session after selection"
elif [[ "$CONTINUE" == "1" ]]; then
  # Continue latest saved session: find the zellij session name first, then extract session ID from layout
  LAST_NAME="$(latest_exited_session_name)"
  if [[ -z "$LAST_NAME" ]]; then
    LAST_NAME="$(latest_session_name)"
  fi
  if [[ -n "$LAST_NAME" ]]; then
    SESSION_NAME="$LAST_NAME"
    # Try to extract the Claude session ID from the corresponding layout file
    EXTRACTED_ID="$(extract_session_id_from_layout "$LAST_NAME" "$SNAPSHOT_DIR" || true)"
    if [[ -n "$EXTRACTED_ID" ]]; then
      SESSION_ID="$EXTRACTED_ID"
      echo "[flow-run-zellij] Continue mode: using session id $SESSION_ID (zellij: $SESSION_NAME)"
    else
      echo "[flow-run-zellij] Continue mode: using zellij session $SESSION_NAME (no layout found, will use --continue)"
    fi
  else
    echo "[flow-run-zellij] Continue mode: no existing sessions found, starting new session"
  fi
  REUSE_SESSION=1
else
  # New session (default)
  SESSION_ID="$(uuidgen | tr 'A-Z' 'a-z')"
fi

LEFT_WIDTH=$((100 - OBSERVER_WIDTH))
if (( LEFT_WIDTH < 20 || LEFT_WIDTH > 80 )); then
  LEFT_WIDTH=65
  OBSERVER_WIDTH=35
fi

# Keep exactly one historical session: the one we're about to use/start.
prune_sessions_keep_one "$SESSION_NAME"

if [[ "$REUSE_SESSION" != "1" && "$CONTINUE" != "1" && "$RESUME" != "1" && -z "$RESUME_ID" ]]; then
  zellij kill-session "$SESSION_NAME" >/dev/null 2>&1 || true
fi

mkdir -p "$FLOW_DATA_DIR/layouts"
# Use SESSION_ID for layout filename; fallback to SESSION_NAME if SESSION_ID is empty
LAYOUT_BASENAME="${SESSION_ID:-$SESSION_NAME}"
LAYOUT_FILE="$FLOW_DATA_DIR/layouts/zellij-layout-${LAYOUT_BASENAME}.kdl"

# Build Claude command based on session mode
claude_args=()
if [[ -n "$RESUME_ID" ]]; then
  # Resume specific session (user provided ID via -r ID or --resume ID)
  claude_args+=(--resume "$SESSION_ID")
elif [[ "$RESUME" == "1" ]]; then
  # Resume with native picker (-r or --resume without ID)
  claude_args+=(--resume)
elif [[ "$CONTINUE" == "1" && -n "$SESSION_ID" ]]; then
  # Continue mode with extracted session ID: use explicit --resume for alignment
  claude_args+=(--resume "$SESSION_ID")
elif [[ "$CONTINUE" == "1" ]]; then
  # Continue mode without extracted ID: fall back to native --continue
  claude_args+=(--continue)
else
  # New session
  claude_args+=(--session-id "$SESSION_ID")
fi

if [[ -n "$MODEL" ]]; then
  claude_args+=(--model "$MODEL")
fi
if [[ ${#CLAUDE_EXTRA_ARGS[@]} -gt 0 ]]; then
  claude_args+=("${CLAUDE_EXTRA_ARGS[@]}")
fi

printf -v CLAUDE_CMD '%q ' claude "${claude_args[@]}"
CLAUDE_CMD="${CLAUDE_CMD% }"

# Observer command: always pass FLOW_SESSION_ID for consistent summary binding
if [[ -n "$SESSION_ID" ]]; then
  OBSERVER_CMD="FLOW_PROJECT_DIR=\"$ROOT_DIR\" FLOW_SESSION_ID=\"$SESSION_ID\" FLOW_ZELLIJ_SESSION=\"$SESSION_NAME\" bun run src/main.ts --live"
else
  OBSERVER_CMD="FLOW_PROJECT_DIR=\"$ROOT_DIR\" FLOW_ZELLIJ_SESSION=\"$SESSION_NAME\" bun run src/main.ts --live"
fi

cat > "$LAYOUT_FILE" <<EOF
layout {
  pane split_direction="vertical" {
    pane name="claude" size="${LEFT_WIDTH}%" command="bash" {
      args "-lc" $(kdl_quote "exec $CLAUDE_CMD")
      cwd $(kdl_quote "$ROOT_DIR")
      focus true
    }
    pane name="observer" size="${OBSERVER_WIDTH}%" command="bash" {
      args "-lc" $(kdl_quote "$OBSERVER_CMD")
      cwd $(kdl_quote "$SCHEME_DIR")
    }
  }
}
EOF

echo ""
echo "========================================"
echo "  Flow Session Starting (Zellij)"
echo "========================================"
echo "Session: $SESSION_NAME"
if [[ -n "$SESSION_ID" ]]; then
  echo "Session ID: $SESSION_ID"
fi
if [[ "$CONTINUE" == "1" ]]; then
  echo "Mode: Continue (resume with session binding)"
elif [[ "$RESUME" == "1" && -n "$RESUME_ID" ]]; then
  echo "Mode: Resume specific"
elif [[ "$RESUME" == "1" ]]; then
  echo "Mode: Resume (native picker)"
else
  echo "Mode: New session"
fi
echo "Layout: $LAYOUT_FILE"
echo ""
echo "Layout:"
echo "  - Left:  Claude Code"
echo "  - Right: Live observer"
echo ""

cleanup_session() {
  # Optional auto-cleanup when explicitly enabled.
  if [[ "${FLOW_ZELLIJ_AUTOCLEANUP:-0}" == "1" ]]; then
    zellij kill-session "$SESSION_NAME" >/dev/null 2>&1 || true
  fi
}

trap cleanup_session EXIT INT TERM HUP
zellij --layout "$LAYOUT_FILE" attach --create "$SESSION_NAME"
