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

TOOL_ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="${FLOW_PROJECT_DIR:-$(pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
SCHEME_DIR="${FLOW_SCHEME_DIR:-$TOOL_ROOT_DIR/scheme}"
LAYOUT_DIR="${FLOW_LAYOUT_DIR:-${TMPDIR:-/tmp}/gui-anything-flow/layouts}"
NOTIFY_ENV_FILE="${FLOW_NOTIFY_ENV_FILE:-$TOOL_ROOT_DIR/.flow-runtime/notify.env}"
MODEL=""
CONTINUE=0
RESUME=0
RESUME_ID=""
CLEANUP_ONLY=0
SESSION_NAME="${FLOW_ZELLIJ_SESSION:-f-$(date +%m%d-%H%M%S)-$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-4)}"
REUSE_SESSION="${FLOW_ZELLIJ_REUSE:-0}"
OBSERVER_WIDTH="${FLOW_ZELLIJ_OBSERVER_WIDTH:-}"
CLAUDE_EXTRA_ARGS=()

load_notify_env() {
  [[ -f "$NOTIFY_ENV_FILE" ]] || return 0
  while IFS='=' read -r key raw_value; do
    [[ -n "${key:-}" ]] || continue
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    case "$key" in
      FLOW_NOTIFY_*)
        if [[ -z "${!key:-}" ]]; then
          local value="$raw_value"
          value="${value%$'\r'}"
          if [[ "$value" == \"*\" && "$value" == *\" ]]; then
            value="${value:1:${#value}-2}"
            value="${value//\\\"/\"}"
            value="${value//\\\\/\\}"
          fi
          export "$key=$value"
        fi
        ;;
    esac
  done < "$NOTIFY_ENV_FILE"
}

load_notify_env

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
      echo "  -c, --continue       Continue Claude session (replay wiki if saved, else live sync)"
      echo "  -r, --resume         Resume via Claude picker (sync observer to picked session)"
      echo "  -r ID, --resume ID   Resume specific Claude session"
      echo ""
      echo "Options:"
      echo "  -m, --model MODEL    Claude model (sonnet, opus, ...)"
      echo "      --cleanup        Kill/delete stale flow zellij sessions and exit"
      echo ""
      echo "Environment:"
      echo "  FLOW_PROJECT_DIR     Project cwd for Claude JSONL, wiki, logs, and resume index"
      echo "  FLOW_ROOT_DIR        Internal runtime root written by the launcher"
      echo "  FLOW_WIKI_DIR        Explicit wiki directory override"
      echo "  FLOW_RESUME_MODE       bind_specific | auto_latest | continue | continue_picker"
      echo "  FLOW_LOG_LEVEL         debug | info | warn | error (default: info)"
      echo "  FLOW_LOG_MODULES       Comma filter, e.g. binding,session,summary,runtime"
      echo "  FLOW_LOG_FILE          Log file (default: \$ROOT_DIR/logs/observer.log)"
      echo "  FLOW_LOG_DISABLED      1 = stderr only, no file"
      echo "  FLOW_SESSION_ID        Pin observer to Claude session UUID"
      echo "  CLAUDE_MODEL           Observer summary/wiki model; set from --model when provided"
      echo "  FLOW_SUMMARY_MODEL     Override observer summary subagent model"
      echo "  FLOW_WIKI_MODEL        Override wiki agent model"
      echo "  FLOW_NOTIFY_WECHAT_USER_ID   Enable WeChat notify hotkey"
      echo "  FLOW_NOTIFY_WECHAT_SERVICE_URL  WeChat service URL (default: http://127.0.0.1:8765)"
      echo "  FLOW_NOTIFY_ENABLED    false = disable WeChat notifications"
      echo "  FLOW_NOTIFY_PROGRESS_INTERVAL  Progress interval minutes (0 = disabled)"
      echo "  wiki/sessions/_index.json  Continue binding (workspace-scoped)"
      echo "  FLOW_ZELLIJ_SESSION  Zellij session name (default: unique)"
      echo "  FLOW_ZELLIJ_AUTOCLEANUP   1=cleanup on exit (default)"
      echo "  FLOW_ZELLIJ_ON_FORCE_CLOSE quit|detach (default: quit; quit kills panes)"
      echo "  Pane spawns use setsid/perl setpgrp (CodeWhale-style process groups)"
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

if [[ "${FLOW_NOTIFY_ENABLED:-true}" != "false" && -z "${FLOW_NOTIFY_WECHAT_USER_ID:-}" && "${FLOW_NOTIFY_HINT_SHOWN:-0}" != "1" ]]; then
  echo "[flow-run] WeChat notifications are not configured. Run: ga notify setup" >&2
fi

export ZELLIJ_SOCKET_DIR="${ZELLIJ_SOCKET_DIR:-/tmp/zellij}"
mkdir -p "$ZELLIJ_SOCKET_DIR"

kdl_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

is_session_uuid() {
  [[ "$1" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

read_session_index() {
  (cd "$SCHEME_DIR" && bun run src/data/session/session-index-cli.ts read --cwd "$ROOT_DIR" 2>/dev/null) || return 1
}

write_session_index() {
  [[ -n "${SESSION_ID:-}" ]] || return 0
  (cd "$SCHEME_DIR" && bun run src/data/session/session-index-cli.ts write --cwd "$ROOT_DIR" --session-id "$SESSION_ID") \
    || echo "[flow-run] Warning: failed to write session index" >&2
}

resolve_resume_id_arg() {
  local arg="$1"
  if is_session_uuid "$arg"; then
    printf '%s' "$arg"
    return 0
  fi
  local resolved=""
  resolved="$(cd "$SCHEME_DIR" && bun run src/data/session/session-index-cli.ts resolve-prefix --cwd "$ROOT_DIR" --prefix "$arg" 2>&1)" || {
    echo "$resolved" >&2
    return 1
  }
  printf '%s' "$resolved"
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

# ponytail: drop EXITED sessions only; active flows in other tabs stay untouched
cleanup_exited_zellij_sessions() {
  local name
  while read -r name; do
    [[ -n "$name" ]] || continue
    zellij kill-session "$name" >/dev/null 2>&1 || true
    zellij delete-session "$name" >/dev/null 2>&1 || true
  done < <(list_zellij_sessions_plain | awk '/EXITED/ {print $1}')
}

# CodeWhale-style shutdown: SIGTERM grace, then SIGKILL backstop (mcp.rs / shell.rs).
pkill_pattern() {
  local signal="$1"
  shift
  local pattern
  for pattern in "$@"; do
    pkill "-${signal}" -f "$pattern" 2>/dev/null || true
  done
}

pkill_patterns_graceful() {
  pkill_pattern TERM "$@"
  sleep 0.6
  pkill_pattern KILL "$@"
}

# Each zellij pane gets its own session/process group (CodeWhale: process_group(0) + group kill).
wrap_pane_lc() {
  local inner_cmd="$1"
  if command -v setsid >/dev/null 2>&1; then
    printf 'exec setsid bash -lc %s' "$(kdl_quote "$inner_cmd")"
    return
  fi
  if command -v perl >/dev/null 2>&1; then
    printf 'exec perl -e %s bash -lc %s' "$(kdl_quote 'setpgrp(0,0); exec @ARGV')" "$(kdl_quote "$inner_cmd")"
    return
  fi
  printf 'exec bash -lc %s' "$(kdl_quote "$inner_cmd")"
}

cleanup_flow_sessions() {
  zellij kill-all-sessions -y >/dev/null 2>&1 || true
  zellij delete-all-sessions -y >/dev/null 2>&1 || true
  pkill_patterns_graceful \
    "scripts/flow-run\.sh" \
    "zellij --layout .*gui-anything-flow/layouts" \
    "zellij --layout .*zellij-layout-" \
    "FLOW_ZELLIJ_SESSION=" \
    "FLOW_SESSION_ID=" \
    "bun run src/main.ts --live"
  rm -f "${LAYOUT_DIR}"/zellij-layout-*.kdl >/dev/null 2>&1 || true
}

cleanup_stale_launchers() {
  [[ "${FLOW_ZELLIJ_AUTOCLEANUP:-${FLOW_AUTOCLEANUP:-1}}" == "1" ]] || return 0
  cleanup_exited_zellij_sessions
  local self="$$"
  local stale_pids=()
  local pid
  while read -r pid; do
    [[ -n "$pid" ]] || continue
    [[ "$pid" == "$self" ]] && continue
    stale_pids+=("$pid")
  done < <(pgrep -f 'scripts/flow-run\.sh' 2>/dev/null || true)

  if (( ${#stale_pids[@]} > 0 )); then
    echo "[flow-run] Cleaning ${#stale_pids[@]} stale flow launcher(s) from prior terminals..."
    kill -TERM "${stale_pids[@]}" 2>/dev/null || true
    sleep 0.6
    kill -KILL "${stale_pids[@]}" 2>/dev/null || true
  fi
}

preflight_cleanup_session() {
  local name="$1"
  [[ -n "$name" ]] || return 0
  zellij kill-session "$name" >/dev/null 2>&1 || true
  zellij delete-session "$name" >/dev/null 2>&1 || true
  pkill_patterns_graceful \
    "attach --create ${name}" \
    "zellij --server .*/${name}"
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
    "FLOW_RESUME_MODE=\"$mode\""
    "FLOW_ZELLIJ_SESSION=\"$SESSION_NAME\""
    "FLOW_THEME=\"${FLOW_THEME:-transparent}\""
  )
  if [[ -n "${SESSION_ID:-}" ]]; then
    cmd+=("FLOW_SESSION_ID=\"$SESSION_ID\"")
  fi
  if [[ -n "$MODEL" ]]; then
    cmd+=("CLAUDE_MODEL=\"$MODEL\"")
  fi
  if [[ -n "${FLOW_SUMMARY_MODEL:-}" ]]; then
    cmd+=("FLOW_SUMMARY_MODEL=\"$FLOW_SUMMARY_MODEL\"")
  fi
  if [[ -n "${FLOW_WIKI_MODEL:-}" ]]; then
    cmd+=("FLOW_WIKI_MODEL=\"$FLOW_WIKI_MODEL\"")
  fi
  local log_file="${FLOW_LOG_FILE:-$ROOT_DIR/logs/observer.log}"
  cmd+=("FLOW_LOG_FILE=\"$log_file\"")
  if [[ -n "${FLOW_LOG_LEVEL:-}" ]]; then
    cmd+=("FLOW_LOG_LEVEL=\"$FLOW_LOG_LEVEL\"")
  fi
  if [[ -n "${FLOW_LOG_MODULES:-}" ]]; then
    cmd+=("FLOW_LOG_MODULES=\"$FLOW_LOG_MODULES\"")
  fi
  if [[ -n "${FLOW_LOG_DISABLED:-}" ]]; then
    cmd+=("FLOW_LOG_DISABLED=\"$FLOW_LOG_DISABLED\"")
  fi
  local prefix="${cmd[*]}"
  printf '%s bun run src/main.ts --live' "$prefix"
}

if [[ "$CLEANUP_ONLY" == "1" ]]; then
  cleanup_flow_sessions
  echo "[flow-run] Cleanup done."
  exit 0
fi

if [[ ! -t 1 ]]; then
  echo "flow-run: needs an interactive terminal (run \`ga flow\` in Terminal/iTerm, not a pipe)" >&2
  exit 1
fi

cleanup_stale_launchers

if [[ -n "$RESUME_ID" ]]; then
  if ! is_session_uuid "$RESUME_ID"; then
    RESUME_ID="$(resolve_resume_id_arg "$RESUME_ID")" || exit 1
  fi
  SESSION_ID="$RESUME_ID"
  echo "[flow-run] Resume specific Claude session: $SESSION_ID (zellij: $SESSION_NAME)"
elif [[ "$RESUME" == "1" ]]; then
  SESSION_NAME="r-$(date +%m%d-%H%M%S)-$(uuidgen | tr 'A-Z' 'a-z' | cut -c1-4)"
  REUSE_SESSION=0
  SESSION_ID=""
  echo "[flow-run] Resume picker (zellij: $SESSION_NAME)"
elif [[ "$CONTINUE" == "1" ]]; then
  if SESSION_ID="$(read_session_index)"; then
    echo "[flow-run] Continue session: $SESSION_ID (index → bundle → Claude jsonl)"
    REUSE_SESSION=0
  else
    SESSION_ID=""
    echo "[flow-run] Continue: Claude --continue; observer will sync and bootstrap wiki if needed"
    REUSE_SESSION=0
  fi
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
# - continue: -c / -r <id> — wiki 有数据 replay，无数据 live 同步 Claude jsonl
# - continue_picker: -r — Claude picker 选中后同上
# - bind_specific: new session (live)
# - auto_latest: plain ga flow only
OBSERVER_RESUME_MODE="auto_latest"
if [[ -n "$RESUME_ID" ]] || [[ "$CONTINUE" == "1" ]]; then
  OBSERVER_RESUME_MODE="continue"
elif [[ "$RESUME" == "1" ]]; then
  OBSERVER_RESUME_MODE="continue_picker"
elif [[ -n "$SESSION_ID" ]]; then
  OBSERVER_RESUME_MODE="bind_specific"
fi

OBSERVER_CMD="$(build_observer_cmd "$OBSERVER_RESUME_MODE")"
CLAUDE_PANE_LC="$(wrap_pane_lc "$CLAUDE_CMD")"
OBSERVER_PANE_LC="$(wrap_pane_lc "$OBSERVER_CMD")"

cat > "$LAYOUT_FILE" <<EOF
layout {
  pane split_direction="vertical" {
    pane name="claude" size="${LEFT_WIDTH}%" command="bash" {
      args "-lc" $(kdl_quote "$CLAUDE_PANE_LC")
      cwd $(kdl_quote "$ROOT_DIR")
      focus true
    }
    pane name="observer" size="${OBSERVER_WIDTH}%" command="bash" {
      args "-lc" $(kdl_quote "$OBSERVER_PANE_LC")
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

write_session_index

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
  local patterns=(
    "attach --create ${name}"
    "zellij --layout .*${layout_base}"
    "zellij --server .*/${name}"
    "FLOW_ZELLIJ_SESSION=\"${name}\""
    "bun run src/main.ts --live"
  )

  zellij kill-session "$name" >/dev/null 2>&1 || true
  zellij delete-session "$name" >/dev/null 2>&1 || true

  if [[ -n "${SESSION_ID:-}" ]]; then
    patterns+=(
      "FLOW_SESSION_ID=\"${SESSION_ID}\""
      "claude --session-id ${SESSION_ID}"
      "claude --resume ${SESSION_ID}"
    )
  fi

  pkill_patterns_graceful "${patterns[@]}"
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

echo "[flow-run] Attaching zellij..."
zellij --layout "$LAYOUT_FILE" attach --create "$SESSION_NAME" options --on-force-close "$ZELLIJ_ON_FORCE_CLOSE"
