# GUI-Anything

A Claude Code Flow Observer with dual-pane terminal UI — designed for **心流 (flow state)**, **按需知识 (knowledge on-demand)**, and **无感使用 (seamless UX)**.

## Design Principles

Three core principles guide every design decision:

| Principle | What it means | In Practice |
|-----------|---------------|-------------|
| **心流 (Flow State)** | Don't interrupt the left pane (Claude) | Observer stays a single timeline; notes/help open only on explicit keys; wiki matches inline per exploration card |
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
5. Symlinks **llm-wiki** to `.claude/skills/llm-wiki/` (and optionally `~/.claude/skills/llm-wiki/`)

After setup, run:
```bash
ga doctor
ga flow
```

## Running Flow Observer

Flow needs an **interactive terminal** (Zellij). Start from the repo root:

```bash
ga flow
ga flow --continue
ga flow --model sonnet "Your prompt"
# or: ./scripts/flow-run.sh -m sonnet "Your prompt"
```

Cleanup stale sessions: `./scripts/flow-run.sh --cleanup`

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
| Cleanup | `--cleanup`; on start kills **other** stale launchers; on exit TERM→KILL for zellij/claude/observer; panes use `setsid` / `setpgrp` |

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

**Resume UI**: replay mode shows the timeline when explorations exist; summaries load from cache/wiki or fall back to rule-based excerpts (no AI regen). Stale cache is shown read-only. See [docs/data-governance/display-policy.md](docs/data-governance/display-policy.md).

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

**Focus this pane first** (click the right pane or switch Zellij focus) — shortcuts do not run while Claude has keyboard focus.

| Key | Action |
|-----|--------|
| `g` | Toggle exploration ↔ flowchart |
| `i` | Toggle notes sidebar (inspiration capture; needs enough terminal width) |
| `/` or `Ctrl-K` | Toggle keyboard help (same list as `?`) |
| `?` / `F1` / `Ctrl+/` | Toggle keyboard help overlay |
| `c` | Toggle calm layout (off by default): latest card shows summary; older cards collapse to one line |
| `s` | Send notification snapshot (only when notify is configured) |
| `[` / `]` | Previous / next theme |
| `J` | Cycle morandi themes |
| `l` | Toggle light ↔ dark pair |
| `Enter` | Save note (when notes input is focused) |
| `Esc` | Close help or notes sidebar / cancel note input — does not quit |
| `q` / `Ctrl+Q` | Quit observer |

Wiki knowledge appears **inline** on each exploration card when a match is found. Default is full expanded detail; press `c` for calm mode (latest summary only; older turns fold to one line).

While the help overlay is open, the bottom hotkey bar is hidden. Set `FLOW_LOCALE=zh-Hans` for Chinese chrome strings.

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

## llm-wiki skill (Wiki Agent)

Skill source: `skills/llm-wiki/`. Claude loads `.claude/skills/llm-wiki/` (committed symlink). `./scripts/setup.sh` refreshes links.

```bash
ls .claude/skills/llm-wiki/SKILL.md
ls skills/llm-wiki/SKILL.md
```

See `gui-anything-layout.md` for the knowledge layout contract.

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
| `FLOW_NO_ANIMATIONS` | `0`, `1` | Low-motion: slower spinner interval |
| `FLOW_LOCALE` | `zh-Hans`, … | Localized observer chrome strings |

Default: `clipboard` when `pbcopy` is available, otherwise `none`.

## Modes (scheme/)

| Mode | Command | Description |
|------|---------|-------------|
| **Direct** | `bun run src/main.ts "<prompt>"` | One-shot TUI run |
| **Flow** | `bun run src/main.ts --flow "<prompt>"` | Flow observer mode |
| **Live observer** | `bun run src/main.ts --live` | Right pane in `ga flow` (replaces legacy `--posthoc` tree UI) |
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

- `wiki/sessions/{sessionId}-evidence.json` is the session evidence source.
- `wiki/sessions/{sessionId}-summaries.json` is transient AI summary cache.
- `wiki/knowledge/{type}/` holds long-lived knowledge entries.
- `wiki/notes/{YYYY-MM-DD}.md` holds user daily notes.
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