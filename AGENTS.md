# GUI-Anything Agent Notes

This file provides fast project context for coding agents working in this repository.

## Purpose

`GUI-Anything` is a dual-pane Flow Observer for Claude Code:

- Left pane: Claude Code interactive session
- Right pane: live observer UI (`scheme/`) for explorations, summaries, and wiki persistence

Public CLI entrypoint is `ga` (`ga flow`, `ga doctor`).

## Repo Map

- `cli/`: public CLI command implementation
- `scheme/`: observer app and services
- `scripts/`: tmux/zellij launch scripts
- `docs/`: protocol/design/governance docs
- `wiki/`: local runtime knowledge data (root-only ignored by git)

## Session Binding Rules

- `new` mode binds observer to the same newly generated session id.
- `continue` mode may use latest-session discovery (`mtime`) when explicit id is unavailable.
- `resume` mode is strict replay: hydrate from cache/wiki only, no missing-summary regeneration.

## Data and Git Rules

- `/wiki/` at repo root is intentionally gitignored for local runtime data.
- `scripts/wiki/` is part of source code and must remain trackable.
- `.flow-runtime/` is local runtime state and should stay out of git.

## Verify After Changes

- Tests: `cd scheme && bun test`
- Typecheck: `cd scheme && bunx tsc --noEmit`
- CLI sanity: `ga doctor`, `ga flow --help`

