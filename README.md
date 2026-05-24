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
| `scripts/` | **Runtime scripts** — Zellij flow launcher (`flow-run.sh`) and setup |
| `reference/` | **Reference implementations** — OpenTUI, tail-claude, and other UI patterns |
| `docs/` | **Documentation** — protocol specs, design docs, release checklist |
| `wiki/` | **Local runtime knowledge data** — knowledge base, evidence, runtime cache, notes (gitignored) |

## 🔔 Flow Notification Harness (New!)

Push critical Flow events to **WeChat / Feishu / DingTalk** — stay informed anywhere:

| Feature | What you get |
|---------|-------------|
| 🚨 **Error Alerts** | Instant notification when errors detected |
| ✅ **Completion Notices** | Know when long-running tasks finish |
| 💡 **Knowledge Extraction** | Auto-push important discoveries |
| 📊 **Progress Reports** | Periodic updates or manual snapshots (press `s`) |

**Quick start**: 
1. Start WeChat service: `./scripts/start-weixin-service.sh`
2. Login: `./scripts/weixin-login.sh` 
3. Set `FLOW_NOTIFY_WECHAT_USER_ID` and run `./scripts/flow-run.sh`

See [Notification Guide](docs/NOTIFICATION.md) | [WeChat Setup](docs/NOTIFICATION_WECHAT.md) for full setup.

## 🎬 HTML Integration (New!)

GUI-Anything now exports rich HTML artifacts from Flow sessions:

| Feature | Command | Output |
|---------|---------|--------|
| 🎬 **Session Replay** | `--export-html -o replay.html` | Interactive timeline replay (single HTML, ~63KB) |
| 🌐 **Web Mirror** | `--web-mirror` | Real-time browser viewer via WebSocket |
| 📊 **Knowledge Graph** | `--knowledge-graph -o graph.html` | Force-directed graph of Wiki entries |
| 🎨 **30 Theme Support** | `--theme catppuccin` | All 30 themes available in exported HTML |

### Session Replay
```bash
# Export latest session as interactive HTML
bun run src/main.ts --export-html -o replay.html

# With options
bun run src/main.ts --export-html --strip-thinking --max-detail-length 500 --theme nord
```
Features: Play/Pause/Speed control, timeline navigation, full-text search, keyboard shortcuts, theme switcher.

### Web Mirror
```bash
# Start real-time mirror server
bun run src/main.ts --web-mirror --port 3001

# Open on phone: http://<your-ip>:3001
```
Features: WebSocket real-time updates, phase indicator, live stats, auto-reconnect, mobile-friendly.

### Knowledge Graph
```bash
# Generate interactive graph from Wiki entries
bun run src/main.ts --knowledge-graph -o graph.html --since 7d
```
Features: Canvas force-directed layout, type-based coloring, shared-tag edges, hover tooltips, search.

See [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) and [Ideas](docs/IDEAS_HTML_INTEGRATION.md) for full roadmap.

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
1. Checks and installs **Bun** (if not found)
2. Checks **Zellij** (required for `ga flow`)
3. Installs project dependencies (`bun install`)
4. Sets executable permissions
5. Installs Claude Code skill to `~/.claude/skills/`

After setup, run:
```bash
ga doctor
ga flow
```

## Using Claude Code Skill

The setup script automatically installs the Flow skill to `~/.claude/skills/flow/`.

### Verify Installation

```bash
ls ~/.claude/skills/flow/SKILL.md
```

### How to Use

Flow needs an **interactive terminal** (Zellij attaches in your shell). From Claude Code, ask it to run `ga flow` in a terminal you control, or start flow yourself:

| What you want | Say this in Claude Code |
|---------------|------------------------|
| Start flow | "start flow mode" |
| With model | "start flow with sonnet" |
| With prompt | "start flow with prompt 'analyze codebase'" |

#### Cleanup and Fixes

These operations work fully inside Claude Code:

| Task | Say this |
|------|----------|
| Clean sessions | "clean stale flow sessions" |
| Fix display | "fix scrollback duplication in flow" |
| Check status | "what flow sessions are running?" |

#### Direct terminal use

```bash
ga flow
ga flow --model sonnet "Your prompt"
# or: ./scripts/flow-run.sh -m sonnet "Your prompt"
```

### Manual Setup

If you prefer manual installation:

#### Zellij (required)

```bash
brew install zellij   # macOS
zellij --version
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

## Flow launcher (Zellij)

All flow sessions use **`scripts/flow-run.sh`** (invoked by `ga flow`): dual-pane Zellij in the current terminal.

| Aspect | Behavior |
|--------|----------|
| Session name | Unique (`f-mmdd-HHMMSS-xxxx`) unless `FLOW_ZELLIJ_SESSION` is set |
| Layout | `.flow-runtime/layouts/zellij-layout-{sessionId}.kdl` (generated per launch) |
| Inject to Claude | Clipboard (`pbcopy` on macOS); see `FLOW_INJECT_BACKEND` |
| Cleanup | `./scripts/flow-run.sh --cleanup` or exit trap + watchdog |

### Session lifecycle modes

| Mode | Flag | Left pane (Claude) | Observer binding | Summary policy |
|------|------|-------------------|------------------|----------------|
| **new** | (none) | `claude --session-id <uuid>` | `bind_specific` + same UUID | Hydrate + regen missing |
| **continue** | `-c` / `--continue` | `claude --resume <id>` if ID recovered from layout, else `claude -c` | `bind_specific` if ID known, else `auto_latest` | Hydrate + regen missing |
| **resume** | `-r` / `--resume [id]` | `claude --resume` / picker | `resume_specific` / `resume_picker` | Strict replay only |

Binding and summary policy are implemented in `scheme/src/services/session/session-binding-policy.ts` — do not duplicate this logic in shell or UI.

Summary generation policy by mode:

| Mode | Observer behavior |
|------|-------------------|
| **new** / **continue** | Hydrate from cache/wiki, then generate missing summaries when needed |
| **resume** (`--resume <id>` or picker) | Strict replay: hydrate from cache/wiki only, do not regenerate missing summaries |

**Resume UI**: until `wiki/runtime/{id}-graph.json` exists or flowchart hints are ready, the flow body may stay hidden (`bindingState.visibility === 'hide'`). Missing summaries show a replay-only hint instead of regenerating.

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

### Script entrypoint (maintainers)

```bash
./scripts/flow-run.sh [--cleanup] [-c|-r] [-m MODEL] [prompt...]
```

### Controls

#### Zellij

| Key | Action |
|-----|--------|
| `Ctrl+O` then `d` | Detach (session keeps running if configured) |
| `zellij attach <name>` | Reattach to a named session |

#### Observer (right pane)

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

**Debug (skip auto-cleanup on exit):**
```bash
FLOW_ZELLIJ_AUTOCLEANUP=0 ./scripts/flow-run.sh
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
| `FLOW_PROJECT_DIR` | auto | Project directory (Claude JSONL discovery) |
| `FLOW_ROOT_DIR` | repo root | Wiki and runtime data root |
| `FLOW_DATA_DIR` | `.flow-runtime` | Layouts and local runtime artifacts |
| `FLOW_WIKI_DIR` | `{FLOW_ROOT_DIR}/wiki` | Override wiki root (see `data/env.ts`) |
| `FLOW_LAYOUT_DIR` | `{FLOW_DATA_DIR}/layouts` | Override Zellij layout directory |
| `FLOW_RESUME_MODE` | set by launcher | `bind_specific` / `auto_latest` / `resume_*` |
| `FLOW_SESSION_ID` | auto | Pin observer to Claude session UUID |
| `FLOW_ZELLIJ_SESSION` | auto-generated | Zellij session name |
| `FLOW_ZELLIJ_REUSE` | `0` | Set `1` to reuse existing Zellij session |
| `FLOW_ZELLIJ_OBSERVER_WIDTH` | auto | Right pane width (%) |
| `FLOW_ZELLIJ_AUTOCLEANUP` | `1` | Set `0` to skip cleanup on exit |
| `FLOW_ZELLIJ_ON_FORCE_CLOSE` | `quit` | `quit` kills session on terminal close; `detach` leaves it |
| `ZELLIJ_SOCKET_DIR` | `/tmp/zellij` | Short socket path (macOS TMPDIR fix) |

### UX Tuning Variables

| Variable | Values | Purpose |
|----------|--------|---------|
| `FLOW_QUIET` | `0` (default), `1` | Quiet mode: suppress Wiki banners, minimal status |
| `FLOW_INJECT_BACKEND` | `clipboard`, `none` | How to send text to Claude pane (macOS: `pbcopy`) |

Default: `clipboard` when `pbcopy` is available, otherwise `none`.

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
│  ├── Set FLOW_PROJECT_DIR / FLOW_RESUME_MODE / FLOW_SESSION_ID │
│  └── Map CLI flags → env only (binding rules in TypeScript)   │
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
│  └── zellij / clipboard binaries                             │
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
| Environment vars | This README + `docs/development.md` | `flow-run.sh`, observer |

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

### "zellij: command not found"

```bash
brew install zellij   # macOS
ga doctor
```

### `ga doctor` failure matrix

| Check | Meaning | How to fix |
|------|---------|------------|
| Claude CLI | `claude` is missing from `PATH` | Install Claude Code CLI and confirm `claude --version` works |
| Claude auth readiness | Login artifacts are missing | Run `claude` once and finish authentication |
| Bun runtime | `bun` is missing from `PATH` | Install Bun from [bun.sh](https://bun.sh) |
| Zellij | `zellij` is missing from `PATH` | Install zellij (e.g. `brew install zellij`) |
| Writable wiki directory | `wiki/` is not writable | Fix directory permissions |
| Writable flow runtime directory | `.flow-runtime/` is not writable | Fix directory permissions |

### Stale Zellij / orphan processes

```bash
./scripts/flow-run.sh --cleanup
zellij list-sessions
ps aux | awk '/claude --session-id|flow-run\.sh|zellij/ && !/awk/'
```

### Scrollback glitches in the left pane

Press `Ctrl+L` or run `clear`, then relaunch `ga flow`.

### Permission denied on scripts

```bash
chmod +x scripts/flow-run.sh
```

## Development

Architecture, data layout, and how to extend the observer: **[docs/development.md](docs/development.md)**.

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