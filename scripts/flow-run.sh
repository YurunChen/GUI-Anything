#!/usr/bin/env bash
# Flow mode: Claude Code + live observer (Zellij dual pane).
#
# Usage:
#   ./scripts/flow-run.sh              # New session
#   ./scripts/flow-run.sh -c           # Continue last session
#   ./scripts/flow-run.sh --continue
#   ./scripts/flow-run.sh -r           # Resume (native picker)
#   ./scripts/flow-run.sh -r ID        # Resume specific session
#   ./scripts/flow-run.sh -m sonnet "Your prompt"
#   ./scripts/flow-run.sh --cleanup    # Kill stale zellij flow sessions
#
# Preferred entry: ga flow

set -euo pipefail

ROOT_DIR="${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SCHEME_DIR="$ROOT_DIR/scheme"
FLOW_DATA_DIR="${FLOW_DATA_DIR:-$ROOT_DIR/.flow-runtime}"
LAYOUT_DIR="${FLOW_DATA_DIR}/layouts"
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
      if [[ -n "${2:-}" && ! "${2:-}" =~ ^- ]]; then
        RESUME_ID="$2"
        shift 2
      else
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
      echo "Session modes:"
      echo "  (none)               New session (default)"
      echo "  -c, --continue       Continue last Claude session (observer may regen summaries)"
      echo "  -r, --resume         Resume via Claude native picker (strict replay)"
      echo "  -r ID, --resume ID   Resume specific session (strict replay)"
      echo ""
      echo "Options:"
      echo "  -m, --model MODEL    Claude model (sonnet, opus, ...)"
      echo "      --cleanup        Kill/delete stale flow zellij sessions and exit"
      echo ""
      echo "Environment:"
      echo "  FLOW_PROJECT_DIR / FLOW_ROOT_DIR / FLOW_DATA_DIR"
      echo "  FLOW_RESUME_MODE     Set by launcher; consumed in scheme/"
      echo "  FLOW_SESSION_ID      Pin observer to Claude session UUID"
      echo "  FLOW_ZELLIJ_SESSION  Zellij session name (default: unique)"
      echo "  FLOW_ZELLIJ_AUTOCLEANUP   1=cleanup on exit (default)"
      echo "  FLOW_ZELLIJ_ON_FORCE_CLOSE quit|detach (default: quit)"
      echo "  ZELLIJ_SOCKET_DIR"
      exit 0
      ;;
    *) break ;;
  esac
done

if [[ $# -gt 0 ]]; then
  CLAUDE_EXTRA_ARGS=("$@")
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "flow-run: claude binary not found in PATH" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "flow-run: bun binary not found in PATH" >&2
  exit 1
fi

if ! command -v zellij >/dev/null 2>&1; then
  echo "flow-run: zellij binary not found in PATH" >&2
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
    if (( cols >= 220 )); then OBSERVER_WIDTH=38
    elif (( cols >= 180 )); then OBSERVER_WIDTH=42
    elif (( cols >= 150 )); then OBSERVER_WIDTH=46
    else OBSERVER_WIDTH=50
    fi
  else
    OBSERVER_WIDTH=46
  fi
fi

list_zellij_sessions_plain() {
  zellij list-sessions 2>/dev/null | sed -E 's/\x1b\[[0-9;]*m//g' || true
}

latest_exited_session_name() {
  list_zellij_sessions_plain | awk '/EXITED/ {print $1; exit}'
}

latest_session_name() {
  list_zellij_sessions_plain | awk 'NF>0 {print $1; exit}'
}

cleanup_flow_sessions() {
  zellij kill-all-sessions -y >/dev/null 2>&1 || true
  zellij delete-all-sessions -y >/dev/null 2>&1 || true
  pkill -f "scripts/flow-run\.sh" >/dev/null 2>&1 || true
  pkill -f "zellij --layout .*zellij-layout-" >/dev/null 2>&1 || true
  rm -f "${LAYOUT_DIR}"/zellij-layout-*.kdl >/dev/null 2>&1 || true
}

preflight_cleanup_session() {
  local name="$1"
  [[ -n "$name" ]] || return 0
  zellij kill-session "$name" >/dev/null 2>&1 || true
  zellij delete-session "$name" >/dev/null 2>&1 || true
  pkill -f "attach --create ${name}" >/dev/null 2>&1 || true
  pkill -f "zellij --server .*/${name}" >/dev/null 2>&1 || true
}

prune_sessions_keep_one() {
  local keep="$1"
  while read -r s; do
    [[ -n "$s" ]] || continue
    [[ "$s" == "$keep" ]] && continue
    zellij delete-session "$s" >/dev/null 2>&1 || true
  done < <(list_zellij_sessions_plain | awk '{print $1}')
}

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

build_observer_cmd() {
  local mode="$1"
  local cmd=(
    "FLOW_PROJECT_DIR=\"$ROOT_DIR\""
    "FLOW_ROOT_DIR=\"$ROOT_DIR\""
    "FLOW_DATA_DIR=\"${FLOW_DATA_DIR}\""
    "FLOW_RESUME_MODE=\"$mode\""
    "FLOW_ZELLIJ_SESSION=\"$SESSION_NAME\""
  )
  if [[ -n "${SESSION_ID:-}" ]]; then
    cmd+=("FLOW_SESSION_ID=\"$SESSION_ID\"")
  fi
  local prefix="${cmd[*]}"
  printf '%s bun run src/main.ts --live' "$prefix"
}

if [[ "$CLEANUP_ONLY" == "1" ]]; then
  cleanup_flow_sessions
  echo "[flow-run] Cleanup done."
  exit 0
fi

if [[ -n "$RESUME_ID" ]]; then
  SESSION_ID="$RESUME_ID"
  echo "[flow-run] Resume specific Claude session: $SESSION_ID (zellij: $SESSION_NAME)"
elif [[ "$RESUME" == "1" ]]; then
  SESSION_NAME="r-$(date +%m%d-%H%M%S)-$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-4)"
  REUSE_SESSION=0
  SESSION_ID=""
  echo "[flow-run] Resume picker (zellij: $SESSION_NAME)"
elif [[ "$CONTINUE" == "1" ]]; then
  LAST_NAME="$(latest_exited_session_name)"
  if [[ -z "$LAST_NAME" ]]; then
    LAST_NAME="$(latest_session_name)"
  fi
  if [[ -n "$LAST_NAME" ]]; then
    SESSION_NAME="$LAST_NAME"
    EXTRACTED_ID="$(extract_session_id_from_layout "$LAST_NAME" "$LAYOUT_DIR" || true)"
    if [[ -n "$EXTRACTED_ID" ]]; then
      SESSION_ID="$EXTRACTED_ID"
      echo "[flow-run] Continue with session id $SESSION_ID (zellij: $SESSION_NAME)"
    else
      SESSION_ID=""
      echo "[flow-run] Continue zellij session $SESSION_NAME (Claude --continue)"
    fi
  else
    SESSION_ID=""
    echo "[flow-run] Continue: no prior session, starting fresh"
  fi
  REUSE_SESSION=1
else
  SESSION_ID="$(uuidgen | tr 'A-Z' 'a-z')"
fi

LEFT_WIDTH=$((100 - OBSERVER_WIDTH))
if (( LEFT_WIDTH < 20 || LEFT_WIDTH > 80 )); then
  LEFT_WIDTH=65
  OBSERVER_WIDTH=35
fi

prune_sessions_keep_one "$SESSION_NAME"
preflight_cleanup_session "$SESSION_NAME"
if [[ "$REUSE_SESSION" != "1" && "$CONTINUE" != "1" && "$RESUME" != "1" && -z "$RESUME_ID" ]]; then
  zellij kill-session "$SESSION_NAME" >/dev/null 2>&1 || true
fi

mkdir -p "$LAYOUT_DIR"
LAYOUT_BASENAME="${SESSION_ID:-$SESSION_NAME}"
LAYOUT_FILE="${LAYOUT_DIR}/zellij-layout-${LAYOUT_BASENAME}.kdl"

claude_args=()
if [[ -n "$RESUME_ID" ]]; then
  claude_args+=(--resume "$SESSION_ID")
elif [[ "$RESUME" == "1" ]]; then
  claude_args+=(--resume)
elif [[ "$CONTINUE" == "1" && -n "$SESSION_ID" ]]; then
  claude_args+=(--resume "$SESSION_ID")
elif [[ "$CONTINUE" == "1" ]]; then
  claude_args+=(--continue)
else
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

# Observer binding (scheme/src/services/session/session-binding-policy.ts):
# - resume_specific / resume_picker: strict replay (no summary regen)
# - bind_specific: new session OR continue with known SESSION_ID (regen allowed)
# - auto_latest: continue without pinned id (mtime discovery)
OBSERVER_RESUME_MODE="auto_latest"
if [[ -n "$RESUME_ID" ]]; then
  OBSERVER_RESUME_MODE="resume_specific"
elif [[ "$RESUME" == "1" ]]; then
  OBSERVER_RESUME_MODE="resume_picker"
elif [[ -n "$SESSION_ID" ]]; then
  OBSERVER_RESUME_MODE="bind_specific"
fi

OBSERVER_CMD="$(build_observer_cmd "$OBSERVER_RESUME_MODE")"

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
echo "  Flow Session Starting"
echo "========================================"
echo "Zellij session: $SESSION_NAME"
if [[ -n "$SESSION_ID" ]]; then
  echo "Claude session:  $SESSION_ID"
fi
if [[ "$CONTINUE" == "1" ]]; then
  echo "Mode: Continue"
elif [[ "$RESUME" == "1" && -n "$RESUME_ID" ]]; then
  echo "Mode: Resume (specific)"
elif [[ "$RESUME" == "1" ]]; then
  echo "Mode: Resume (picker)"
else
  echo "Mode: New"
fi
echo "Observer mode: $OBSERVER_RESUME_MODE"
echo "Layout: $LAYOUT_FILE"
echo ""

FLOW_WATCHDOG_PID=""
FLOW_CLEANUP_DONE=0
FLOW_AUTOCLEANUP="${FLOW_ZELLIJ_AUTOCLEANUP:-${FLOW_AUTOCLEANUP:-1}}"
ZELLIJ_ON_FORCE_CLOSE="${FLOW_ZELLIJ_ON_FORCE_CLOSE:-quit}"

stop_terminal_watchdog() {
  if [[ -n "$FLOW_WATCHDOG_PID" ]]; then
    kill "$FLOW_WATCHDOG_PID" 2>/dev/null || true
    wait "$FLOW_WATCHDOG_PID" 2>/dev/null || true
    FLOW_WATCHDOG_PID=""
  fi
}

cleanup_session() {
  [[ "$FLOW_AUTOCLEANUP" == "1" ]] || return 0
  [[ "$FLOW_CLEANUP_DONE" == "1" ]] && return 0
  FLOW_CLEANUP_DONE=1

  local name="$SESSION_NAME"
  local layout_base="${LAYOUT_BASENAME:-$name}"

  zellij kill-session "$name" >/dev/null 2>&1 || true
  zellij delete-session "$name" >/dev/null 2>&1 || true
  pkill -f "attach --create ${name}" >/dev/null 2>&1 || true
  pkill -f "zellij --layout .*${layout_base}" >/dev/null 2>&1 || true
  pkill -f "zellij --server .*/${name}" >/dev/null 2>&1 || true
  pkill -f "FLOW_ZELLIJ_SESSION=\"${name}\"" >/dev/null 2>&1 || true
  if [[ -n "${SESSION_ID:-}" ]]; then
    pkill -f "FLOW_SESSION_ID=\"${SESSION_ID}\"" >/dev/null 2>&1 || true
    pkill -f "claude --session-id ${SESSION_ID}" >/dev/null 2>&1 || true
    pkill -f "claude --resume ${SESSION_ID}" >/dev/null 2>&1 || true
  fi
}

start_terminal_watchdog() {
  local parent_pid="$PPID"
  local script_pid="$$"
  (
    while kill -0 "$parent_pid" 2>/dev/null; do
      sleep 0.5
    done
    cleanup_session
    kill -TERM "$script_pid" 2>/dev/null || true
  ) &
  FLOW_WATCHDOG_PID=$!
}

on_script_exit() {
  stop_terminal_watchdog
  cleanup_session
}

trap on_script_exit EXIT INT TERM HUP
start_terminal_watchdog

zellij --layout "$LAYOUT_FILE" attach --create "$SESSION_NAME" options --on-force-close "$ZELLIJ_ON_FORCE_CLOSE"
