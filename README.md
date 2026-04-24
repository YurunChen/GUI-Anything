# GUI-Anything

A Claude Code Flow Observer with dual-pane terminal UI.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `scheme/` | **Flow observer implementation** — OpenTUI-based real-time observer for Claude Code sessions |
| `scripts/` | **Utility scripts** — `flow-run.sh` for dual-pane launch, skill definitions |
| `reference/` | **Reference implementations** — OpenTUI, tail-claude, and other UI patterns |
| `docs/` | **Documentation** — Protocol specs and design docs |
| `protocol/` | **Normative protocols** — cli-event and ui-surface protocol definitions |

## Installation

### One-Command Setup (Recommended)

```bash
./scripts/setup.sh
```

This automatically:
1. Checks and installs **tmux** (if not found)
2. Checks and installs **Bun** (if not found)
3. Installs project dependencies (`bun install`)
4. Sets executable permissions
5. Installs Claude Code skill to `~/.claude/skills/`

After setup, run:
```bash
./scripts/flow-run.sh
```

## Using Claude Code Skill

The setup script automatically installs the Flow skill to `~/.claude/skills/flow/`.

### Verify Installation

```bash
ls ~/.claude/skills/flow/SKILL.md
```

### How to Use

The skill supports **both interactive and non-interactive workflows**:

#### 1. Start Flow from Claude Code (Non-interactive)

Claude Code can now **create** the flow session for you, then you attach manually:

```
You: start flow mode
Claude: I'll create the flow session for you...

[runs: ./scripts/flow-run.sh --detach]

Output:
  ========================================
    Flow Session Created
  ========================================
  
  Session: flow-main
  
  To attach to the session, run:
    tmux attach -t flow-main

You: [runs tmux attach -t flow-main in your terminal]
```

Or ask Claude Code to start with specific options:

| What you want | Say this in Claude Code |
|---------------|------------------------|
| Start flow | "start flow mode" |
| With model | "start flow with sonnet" |
| With prompt | "start flow with prompt 'analyze codebase'" |

#### 2. Cleanup and Fixes (Run inside Claude Code)

These operations work fully inside Claude Code:

| Task | Say this |
|------|----------|
| Clean sessions | "clean stale flow sessions" |
| Fix display | "fix scrollback duplication in flow" |
| Check status | "what flow sessions are running?" |

#### 3. Direct Terminal Use (Interactive)

If you're already in your terminal, just run directly (no `--detach` needed):

```bash
./scripts/flow-run.sh                    # Start interactively
./scripts/flow-run.sh -m sonnet         # With model
./scripts/flow-run.sh "Your prompt"     # With prompt
```

### The `--detach` Flag

The script auto-detects when it's running in a non-interactive shell (like Claude Code) and automatically uses detach mode. You can also force it:

```bash
./scripts/flow-run.sh --detach              # Auto-detected in Claude Code
./scripts/flow-run.sh -m opus --detach    # With model
```

In detach mode:
- Session is created and starts running
- Script outputs the attach command
- You run the attach command in your terminal
- Session persists after you detach

### Manual Setup

If you prefer manual installation:

#### 1. Install tmux (3.0+)

**macOS:**
```bash
# Via Homebrew
brew install tmux

# Or via MacPorts
sudo port install tmux
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install tmux
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install tmux
```

**Verify installation:**
```bash
tmux -V  # Should show 3.0 or higher
```

#### Bun Runtime

```bash
# Install via official installer
curl -fsSL https://bun.sh/install | bash

# Or upgrade if already installed
bun upgrade

# Verify installation
bun --version
```

### 2. Install Project Dependencies

From the repository root:

```bash
cd scheme
bun install
```

This installs:
- `@opentui/core` & `@opentui/react` — Terminal UI framework
- `react` — React 19 for component rendering
- TypeScript types and dev dependencies

**Verify dependencies are installed:**
```bash
ls node_modules/@opentui  # Should show core and react
```

### 3. Verify Installation

Run the observer directly to ensure everything works:

```bash
cd scheme
bun run src/main.ts --help
```

If you see usage information, the installation is successful.

## Quick Start

### Start Flow Mode (Dual Pane)

From repo root:

```bash
./scripts/flow-run.sh
```

This creates a tmux session (`flow-main` by default) with:
- **Left pane**: Native Claude Code interactive TUI
- **Right pane**: Live observer polling the same session JSONL

### Controls

| Key | Action |
|-----|--------|
| `Ctrl+B D` | Detach from tmux session (flow continues in background) |
| `tmux attach -t flow-main` | Reattach to existing session |
| `t` | Toggle `flow` / `tree` view in observer |
| `g` | Generate potential directions |
| `q` / `Esc` | Safe quit with terminal restore |

### Usage Examples

**Basic start:**
```bash
./scripts/flow-run.sh
```

**With initial prompt:**
```bash
./scripts/flow-run.sh "Refactor auth middleware to use JWT"
```

**Specify model:**
```bash
./scripts/flow-run.sh -m sonnet
./scripts/flow-run.sh -m opus "Analyze codebase structure"
./scripts/flow-run.sh -m qwen3.6-plus "Summarize this project"
```

**Debug mode (preserve session after exit):**
```bash
FLOW_KEEP_SESSION=1 ./scripts/flow-run.sh
```

## Claude Code Skill Installation

Install the Flow skill to enable natural language workflow control in Claude Code.

### Install

```bash
mkdir -p ~/.claude/skills/flow
cp scripts/flow-hooks/skills/flow/SKILL.md ~/.claude/skills/flow/SKILL.md
```

### Verify

```bash
ls ~/.claude/skills/flow/SKILL.md
```

### Use

In Claude Code chat, use natural prompts:
- `start flow mode`
- `run flow-run with sonnet`
- `clean stale flow sessions`
- `fix scrollback duplication in flow`

Claude Code will apply the skill automatically.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOW_TMUX_SESSION` | `flow-main` | Tmux session name |
| `FLOW_KEEP_SESSION` | `0` | Set `1` to preserve session after exit |
| `FLOW_CLEAR_PANES` | `1` | Set `0` to skip initial clear |
| `FLOW_CLEAR_HISTORY` | `1` | Set `0` to skip history clear on exit |
| `FLOW_TMUX_HISTORY_LIMIT` | `5000` | Scrollback buffer size |
| `FLOW_PROJECT_DIR` | auto | Project directory override |
| `FLOW_SESSION_ID` | auto | Pin observer to specific session |

## Modes (scheme/)

| Mode | Command | Description |
|------|---------|-------------|
| **Live** | `bun run src/main.ts --live` | Poll existing Claude session |
| **Direct** | `bun run src/main.ts "<prompt>"` | One-shot TUI run |
| **Flow** | `bun run src/main.ts --flow "<prompt>"` | Flow observer mode |
| **Observer** | `bun run src/main.ts --observer "<prompt>"` | OpenTUI observer with stream |
| **Posthoc** | `bun run src/main.ts --posthoc [path]` | Analyze finished session |
| **Web API** | `bun run src/main.ts --web` | HTTP server at `:3000` |

## Troubleshooting

### "Cannot find module" errors

```bash
cd scheme
rm -rf node_modules bun.lock
bun install
```

### "tmux: command not found"

Install tmux for your platform (see Installation section above).

### Scrollback shows duplicated conversation

This is tmux TUI redraw residue. Fix:
- Inside the left pane, press `Ctrl+L` or run `clear`
- Or detach and reattach: `Ctrl+B D`, then `tmux attach -t flow-main`
- Or exit and relaunch `./scripts/flow-run.sh`

### Stale sessions after crashes

Clean up manually:
```bash
# List sessions
tmux ls

# Kill all flow sessions
tmux ls | awk -F: '/^flow/{print $1}' | xargs -I{} tmux kill-session -t {}

# Check for orphan processes
ps aux | awk '/claude --session-id|src\/main\.ts --live|flow-run\.sh/ && !/awk/'

# Kill specific PID if needed
kill <PID>
```

### Permission denied on scripts

```bash
chmod +x scripts/flow-run.sh
```

## Development

### Running Tests

```bash
cd scheme
bun test
```

### Building

```bash
cd scheme
bun run build
```

### Type Checking

```bash
cd scheme
bunx tsc --noEmit
```
