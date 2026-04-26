---
name: flow
description: Launch and manage the dual-pane flow workflow (Claude Code + scheme live observer) with automatic cleanup, and handle stale sessions or visual glitches. Supports three session modes (new, continue, resume) and two backends (tmux, zellij). Use when the user asks to start flow mode, continue a session, run flow-run.sh, observe live summaries, fix scrollback duplication, or clean flow background processes.
---

# Flow

Dual-pane terminal workflow that runs Claude Code interactively alongside a real-time observer showing exploration cards and summaries.

Design principles: **心流 (flow state)** — observer defaults passive; **按需知识** — Wiki/directions appear only when relevant; **无感使用** — one command starts, auto-discovers sessions.

## When to use

- User asks to start flow mode / observer / dual-pane live view.
- User asks to run `flow-run.sh` with optional model or initial prompt.
- User asks to inspect, clean, or fix leftover flow background processes.
- User reports scrollback duplication, visual glitches, or stale session buildup.

## Prerequisites

Ensure these are available in PATH:
- `claude` (Claude Code CLI)
- `tmux` (3.0+)
- `bun` (for the observer)

Repository must contain `scripts/flow-run.sh` at the project root.

## Launch workflow

`flow-run.sh` supports three session modes and two launch styles:

| Mode | Flag | Use When |
|------|------|----------|
| **new** (default) | (none) | Starting fresh work |
| **continue** | `--continue` | Resuming the most recent session |
| **resume** | `--resume <id>` | Specific session ID |

Launch styles:
- **Interactive**: Creates session and attaches (for terminals)
- **Detach** (`--detach`): Creates session, outputs attach command (for Claude Code)

### When user asks to start flow mode

1. **New session** (default):

   ```bash
   ./scripts/flow-run.sh --detach
   ```

2. **Continue last session**:

   ```bash
   ./scripts/flow-run.sh --continue --detach
   ```

3. **Resume specific session**:

   ```bash
   ./scripts/flow-run.sh --resume <session-id> --detach
   ```

4. **With options**:

   ```bash
   ./scripts/flow-run.sh -m sonnet --detach
   ./scripts/flow-run.sh "Analyze codebase" --continue --detach
   ```

5. **After session is created**, instruct user to attach:

   ```bash
   tmux attach -t flow-main
   ```

### For users running directly in their terminal

Interactive mode (no `--detach` needed):

```bash
./scripts/flow-run.sh                    # New session
./scripts/flow-run.sh --continue         # Continue last
./scripts/flow-run.sh --resume <id>      # Specific session
./scripts/flow-run.sh -m sonnet         # With model
./scripts/flow-run.sh "Your prompt"     # With prompt
```

### Zellij alternative (current terminal)

For users who prefer native terminal splits:

```bash
./scripts/flow-run-zellij.sh             # New session
./scripts/flow-run-zellij.sh -m sonnet   # With model
```

**Differences from tmux**:
- Zellij: unique session names, clipboard-only inject, current terminal
- tmux: fixed session names, supports direct inject, detach/reattach capable

### Expected behavior

- Creates tmux session named `flow-main` (or `$FLOW_TMUX_SESSION`)
- Left pane: Claude Code interactive TUI
- Right pane: scheme live observer polling the same session JSONL
- With `--detach`: Session stays running, user attaches manually
- On interactive exit/detach: Session cleans automatically unless `FLOW_KEEP_SESSION=1`

## Cleanup workflow

Use when user reports "too many background processes" or before starting fresh after crashes.

1. List tmux sessions:
   ```bash
   tmux ls
   ```

2. Remove flow sessions (matches `flow` prefix, includes `flow-main`):
   ```bash
   tmux ls | awk -F: '/^flow/{print $1}' | xargs -I{} tmux kill-session -t {}
   ```

3. Check for orphan processes:
   ```bash
   ps aux | awk '/claude --session-id|src\/main\.ts --live|flow-run\.sh/ && !/awk/'
   ```

4. Kill specific PIDs if still running:
   ```bash
   kill <PID>
   ```

## Environment variables

### Core Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FLOW_TMUX_SESSION` | `flow-main` | Tmux session name to use |
| `FLOW_KEEP_SESSION` | `0` | Set to `1` to preserve session after exit |
| `FLOW_CLEAR_PANES` | `1` | Set to `0` to skip initial clear on both panes |
| `FLOW_CLEAR_HISTORY` | `1` | Set to `0` to skip tmux history clear on exit |
| `FLOW_TMUX_HISTORY_LIMIT` | `5000` | Tmux scrollback buffer size |
| `FLOW_PROJECT_DIR` | auto | Override project directory for observer |
| `FLOW_SESSION_ID` | auto | Pin observer to specific session |

### Zellij Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FLOW_ZELLIJ_SESSION` | auto | Session name (default: unique short) |
| `FLOW_ZELLIJ_REUSE` | `0` | Set `1` to reuse existing session |
| `ZELLIJ_SOCKET_DIR` | `/tmp/zellij` | Socket path (macOS TMPDIR fix) |

### UX Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FLOW_QUIET` | `0` | Set `1` for minimal UI (心流模式) |
| `FLOW_INJECT_BACKEND` | auto | `tmux`, `clipboard`, or `none` |

## Troubleshooting

### Scrollback shows duplicated conversation (residual redraw)

Cause: Full-screen TUI in tmux redraws after resize/reconnect, mixing old and new frames in scrollback.

Fix:
- Inside the left pane, press `Ctrl+L` or run `clear`
- Or detach and reattach: `Ctrl+B D`, then `tmux attach -t flow-main`
- Or exit and relaunch `./scripts/flow-run.sh`

### Stale sessions after crashes

Check and clean:
```bash
tmux ls
tmux ls | awk -F: '/^flow/{print $1}' | xargs -I{} tmux kill-session -t {}
```

### Observer shows old session data

Make sure `FLOW_PROJECT_DIR` and `FLOW_SESSION_ID` point to the current session. By default, the script pins the observer to the newly generated session ID.

## Safety rules

- Never kill non-flow tmux sessions (e.g., `claude-activity`, `claude-observe`) unless user explicitly asks.
- Explain what will be cleaned before destructive cleanup.
- Respect `FLOW_KEEP_SESSION=1` if user wants to preserve state.
- Do not suggest `kill -9` unless normal `kill` fails and user confirms.
