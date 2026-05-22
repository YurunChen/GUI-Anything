---
name: flow
description: Launch and manage the dual-pane flow workflow (Claude Code + scheme live observer) via Zellij. Supports new, continue, and resume session modes. Use when the user asks to start flow mode, continue a session, run flow-run.sh, or clean stale flow processes.
---

# Flow

Dual-pane workflow: Claude Code (left) + live observer (right).

## Prerequisites

- `claude`, `bun`, `zellij` in PATH
- `scripts/flow-run.sh` at repo root (or `ga flow`)

## Launch

| Intent | Command |
|--------|---------|
| New | `ga flow` or `./scripts/flow-run.sh` |
| Continue | `ga flow --continue` or `./scripts/flow-run.sh -c` |
| Resume picker | `ga flow --resume` or `./scripts/flow-run.sh -r` |
| Resume ID | `ga flow --resume <id>` or `./scripts/flow-run.sh -r <id>` |
| Model + prompt | `ga flow -m sonnet "your prompt"` |

## Cleanup

```bash
./scripts/flow-run.sh --cleanup
```

## Session semantics

- **new / continue**: observer may generate missing summaries (`bind_specific` or `auto_latest`)
- **continue with recovered id**: `claude --resume <id>` + `bind_specific`
- **continue without id**: `claude --continue` + `auto_latest`
- **resume**: strict replay only (`resume_specific` / `resume_picker`); flow body may stay hidden until graph/flowchart cache exists

## Environment

See `scripts/flow-run.sh --help` and `docs/development.md` (full env + layer map).
