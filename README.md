# GUI-Anything

A Claude Code Flow Observer with dual-pane terminal UI — designed for **心流 (flow state)**, **按需知识 (knowledge on-demand)**, and **无感使用 (seamless UX)**.

## Design Principles

Three core principles guide every design decision:

| Principle | What it means | In Practice |
|-----------|---------------|-------------|
| **心流 (Flow State)** | Don't interrupt the left pane (Claude) | Observer defaults to passive mode; context panels (Wiki/Inspiration/Directions) only expand when explicitly requested |
| **按需知识 (On-Demand)** | Retrieve and persist knowledge only when needed | Wiki search has thresholds; auto-extract only when model signals persist; quiet mode available |
| **无感使用 (Seamless)** | One command to start; failures don't block; no manual path hunting | `FLOW_PROJECT_DIR` + `FLOW_SESSION_ID` auto-bound; loading states neutral (not error-like) |

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `cli/` | **Public CLI entrypoint** — `ga flow` and `ga doctor` |
| `scheme/` | **Flow observer implementation** — OpenTUI-based real-time observer for Claude Code sessions |
| `scripts/` | **Runtime scripts** — tmux/zellij launchers and helper tooling |
| `reference/` | **Reference implementations** — OpenTUI, tail-claude, and other UI patterns |
| `docs/` | **Documentation** — protocol specs, design docs, release checklist |
| `wiki/` | **Local runtime knowledge data** — knowledge base, evidence, runtime cache, notes (gitignored) |

## Mental Model: Run / Capture / Guide

Flow Observer organizes work into three layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Run (执行态)                                                │
│  ├── Current session / exploration                           │
│  ├── Phase indicators                                        │
│  └── Tool/error signals                                      │
├─────────────────────────────────────────────────────────────┤
│  Capture (沉淀态)                                            │
│  ├── Summary JSON (AI-generated)                              │
│  ├── Wiki staging (auto-extract)                            │
│  └── Inspiration notes (manual capture)                     │
├─────────────────────────────────────────────────────────────┤
│  Guide (导航态)                                              │
│  ├── Potential directions (AI suggestions)                  │
│  ├── Wiki matches (search results)                          │
│  └── Command bar (available actions)                        │
└─────────────────────────────────────────────────────────────┘
```

Each layer has clear boundaries and contracts — see [Architecture Boundaries](#architecture-boundaries).

## Commercial CLI (ga)

Use `ga` as the only public entrypoint for flow sessions.

### Install

```bash
# one-off
npx gui-anything@latest doctor

# global
npm i -g gui-anything
```

### Quickstart

```bash
ga doctor
ga flow
```

Supported external commands:
- `ga flow`
- `ga flow --continue`
- `ga flow --resume`
- `ga flow --resume <sessionId>`
- `ga flow --model <model>`
- `ga doctor`

## Installation

### One-Command Setup (Recommended)

```bash
./scripts/setup.sh
```

This automatically:
1. Checks and installs **tmux** (if not found)
2. Checks and installs **Bun** (if not found)
3. Checks **Zellij** (optional, for current-terminal split layout)
4. Installs project dependencies (`bun install`)
5. Sets executable permissions
6. Installs Claude Code skill to `~/.claude/skills/`

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

Verify CLI entrypoint is available:

```bash
ga doctor
```

If checks pass (or only non-blocking warnings appear), installation is successful.

## Launch Matrix: tmux vs Zellij

Choose your terminal multiplexer based on your workflow:

| Feature | `flow-run.sh` (tmux) | `flow-run-zellij.sh` (zellij) |
|---------|----------------------|-------------------------------|
| **Session naming** | Fixed (`flow-main` default, kills existing) | Unique short names (`f-mmdd-HHMMSS-xxxx`) |
| **Window behavior** | New tmux session | Current terminal split |
| **Inject to Claude** | Yes (`injectToClaudeInput` via tmux) | No (clipboard only) |
| **Best for** | Long-running sessions, detach/reattach | Quick tasks, native terminal feel |
| **Socket path** | N/A | `ZELLIJ_SOCKET_DIR=/tmp/zellij` (short path for macOS) |

### Session Lifecycle Modes

Flow supports three session modes (tmux and zellij):

| Mode | Script Flag | Left Pane (Claude) | Observer `FLOW_SESSION_ID` | Use When |
|------|-------------|-------------------|---------------------------|----------|
| **new** (default) | (none) | `claude --session-id <new-uuid>` | Same UUID | Starting fresh work |
| **continue** | `--continue` | `claude -c` (continue last) | Not set (uses mtime latest) | Resuming recent work |
| **resume** | `--resume <id>` | `claude --resume <id>` | Set to `<id>` | Specific session |

**Known limitation**: `continue` mode uses mtime to find latest session — may follow wrong file if multiple sessions write concurrently. Use `resume <id>` for production workflows.

## Quick Start

### Start Flow Mode (Recommended)

From repo root:

```bash
ga doctor
ga flow
```

This launches the dual-pane flow session:
- **Left pane**: Native Claude Code interactive TUI
- **Right pane**: Flow timeline UI

### Continue Previous Session

```bash
ga flow --continue
```

Resumes your latest Claude Code session in the current project context.

### Resume Specific Session

```bash
ga flow --resume <session-id>
```

### Resume via Native Picker

```bash
ga flow --resume
```

### Specify Model

```bash
ga flow --model sonnet
ga flow --model opus "Analyze codebase structure"
```

### Legacy Script Entrypoints (Maintainers)

The following script-based launchers remain available for maintainers and internal debugging:

```bash
./scripts/flow-run.sh
./scripts/flow-run-zellij.sh
```

### Controls

#### Tmux Session

| Key | Action |
|-----|--------|
| `Ctrl+B D` | Detach from tmux session (flow continues in background) |
| `tmux attach -t flow-main` | Reattach to existing session |

#### Observer (Right Pane)

| Key | Action | Context |
|-----|--------|---------|
| `t` | Toggle `flow` / `tree` view | Global |
| `g` | Generate potential directions | Global |
| `w` | Open Wiki tab in ContextPanel | When Wiki match available |
| `i` | Open Inspiration tab | Global |
| `d` | Open Directions tab | Global |
| `Esc` | Close Context / safe quit | Global |
| `q` | Quit observer | Global |

> **心流提示**: ContextPanel (Wiki/Inspiration/Directions) only opens when explicitly requested or when there's a strong signal (Wiki match). Default view shows only the flow timeline to avoid interrupting your focus.

### Usage Examples

**Basic start:**
```bash
ga flow
```

**With initial prompt:**
```bash
ga flow "Refactor auth middleware to use JWT"
```

**Specify model:**
```bash
ga flow --model sonnet
ga flow --model opus "Analyze codebase structure"
ga flow --model qwen3.6-plus "Summarize this project"
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
cp docs/skills/flow/SKILL.md ~/.claude/skills/flow/SKILL.md
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

## Environment Variables & Contracts

### Core Flow Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOW_TMUX_SESSION` | `flow-main` | Tmux session name |
| `FLOW_KEEP_SESSION` | `0` | Set `1` to preserve session after exit |
| `FLOW_CLEAR_PANES` | `1` | Set `0` to skip initial clear |
| `FLOW_CLEAR_HISTORY` | `1` | Set `0` to skip history clear on exit |
| `FLOW_TMUX_HISTORY_LIMIT` | `5000` | Scrollback buffer size |
| `FLOW_PROJECT_DIR` | auto | Project directory override |
| `FLOW_SESSION_ID` | auto | Pin observer to specific session |
| `FLOW_ZELLIJ_SESSION` | auto-generated | Zellij session name for `flow-run-zellij.sh` |
| `FLOW_ZELLIJ_REUSE` | `0` | Set `1` to reuse existing Zellij session |
| `FLOW_ZELLIJ_OBSERVER_WIDTH` | auto | Right pane width (%) for `flow-run-zellij.sh` |
| `ZELLIJ_SOCKET_DIR` | `/tmp/zellij` | Short socket path (macOS TMPDIR fix) |

### UX Tuning Variables

| Variable | Values | Purpose |
|----------|--------|---------|
| `FLOW_QUIET` | `0` (default), `1` | Quiet mode: suppress Wiki banners, minimal status |
| `FLOW_INJECT_BACKEND` | `tmux`, `clipboard`, `none` | How to send text to Claude pane |

### Inject Strategy by Backend

| Backend | tmux | zellij | Command Bar Shows |
|---------|------|--------|-------------------|
| `tmux` | `injectToClaudeInput` available | N/A | "Press Enter to inject" |
| `clipboard` | N/A | `pbcopy` + manual paste | "Copied to clipboard — paste with Cmd+V" |
| `none` | No-op | No-op | "Manual input required" |

Default is backend-aware: tmux sessions default to `tmux`, zellij to `clipboard`.

## Modes (scheme/)

| Mode | Command | Description |
|------|---------|-------------|
| **Direct** | `bun run src/main.ts "<prompt>"` | One-shot TUI run |
| **Flow** | `bun run src/main.ts --flow "<prompt>"` | Flow observer mode |
| **Posthoc** | `bun run src/main.ts --posthoc [path]` | Analyze finished session |
| **Web API** | `bun run src/main.ts --web` | HTTP server at `:3000` |

## Architecture Boundaries

Flow is organized into layers with strict dependency directions (single source of truth per concern):

```
┌────────────────────────────────────────────────────────────┐
│  Shell Scripts (scripts/)                                    │
│  ├── Process orchestration                                   │
│  ├── Set FLOW_PROJECT_DIR / FLOW_SESSION_ID                  │
│  └── DO NOT implement session selection logic                │
├────────────────────────────────────────────────────────────┤
│  scheme/src/                                                 │
│  ├── app/        → UI and app composition                    │
│  ├── services/   → AI/session/wiki orchestration logic       │
│  ├── data/       → repository + protocol + env adapters      │
│  ├── domain/     → pure domain models and tree logic         │
│  ├── constants/  → stable config/constants                   │
│  └── utils/      → shared pure utilities                     │
├────────────────────────────────────────────────────────────┤
│  External Truth Sources                                      │
│  ├── Claude session JSONL (Claude Code writes)               │
│  ├── wiki/ file system                                       │
│  └── tmux / zellij / clipboard binaries                      │
└────────────────────────────────────────────────────────────┘
```

### Layer Rules

| Layer | Can Import | Cannot |
|-------|------------|--------|
| `app/` | `services/*`, `data/protocol/*`, `domain/*`, `constants/*`, `utils/*`, UI libs | direct file persistence logic |
| `services/` | `data/*`, `domain/*`, `constants/*`, `utils/*` | UI component code |
| `data/` | `domain/*`, `constants/*`, `utils/*`, `node:*` | React/OpenTUI imports |
| `domain/` | `constants/*`, `utils/*` | `app/*`, `services/*`, `data/*` |
| Shell scripts | N/A (bash) | duplicate parser/repository logic already in TS layers |

### Contracts (Source of Truth)

| Contract | Location | Consumers |
|----------|----------|-----------|
| Summary JSON shape | `scheme/src/services/ai/flow-summaries.ts` | summary generation, UI rendering, wiki persistence |
| Wiki storage structure | `docs/data-governance/data-flow.md` | `services/wiki/*`, `services/ai/summary-cache.ts`, observer hooks |
| Environment vars | This README table | `flow-run.sh`, `flow-run-zellij.sh`, observer |

Changes to contracts must update all consumers and this documentation.

## Code and Data Governance Rules

### Code Classification Rules

- UI rendering and keyboard behavior stay in `scheme/src/app/`.
- Business orchestration stays in `scheme/src/services/`.
- File/protocol/env adapters stay in `scheme/src/data/`.
- Pure models and flow logic stay in `scheme/src/domain/`.
- Cross-cutting constants and helpers stay in `scheme/src/constants/` and `scheme/src/utils/`.
- Avoid cross-layer shortcuts (for example, app code writing wiki files directly).

### Data Management Rules

- `wiki/evidence/{sessionId}.json` is the session evidence source.
- `wiki/runtime/{sessionId}-summaries.json` is transient AI summary cache.
- `wiki/knowledge-base/{type}/` holds long-lived knowledge entries.
- `.flow-runtime/` is for runtime layout/snapshot artifacts, not wiki knowledge.
- `wiki/` and `.flow-runtime/` are local runtime data and should stay out of Git.

## Troubleshooting

### "Cannot find module" errors

```bash
cd scheme
rm -rf node_modules bun.lock
bun install
```

### "tmux: command not found"

Install tmux for your platform (see Installation section above).

### "zellij: command not found"

Install Zellij:

```bash
brew install zellij
```

Then run:

```bash
./scripts/flow-run-zellij.sh
```

### `ga doctor` failure matrix

| Check | Meaning | How to fix |
|------|---------|------------|
| Claude CLI | `claude` is missing from `PATH` | Install Claude Code CLI and confirm `claude --version` works |
| Claude auth readiness | Login artifacts are missing | Run `claude` once and finish authentication |
| Bun runtime | `bun` is missing from `PATH` | Install Bun from [bun.sh](https://bun.sh) |
| Terminal backend | Neither zellij nor tmux is available | Install zellij (preferred) or tmux |
| Writable wiki directory | `wiki/` is not writable | Fix directory permissions |
| Writable flow runtime directory | `.flow-runtime/` is not writable | Fix directory permissions |

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
ps aux | awk '/claude --session-id|flow-run\.sh|flow-run-zellij\.sh/ && !/awk/'

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
