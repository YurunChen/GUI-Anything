# GUI-Anything Agent Notes

## Purpose

Dual-pane Flow Observer for Claude Code: left = Claude, right = live observer (`scheme/`).

Public entry: **`ga flow`**, **`ga doctor`**.

## Repo Map

| Path | Role |
|------|------|
| `cli/` | `ga` CLI |
| `scheme/` | Observer app + services + data adapters |
| `docs/development.md` | Layering + extension guide |
| `scripts/flow-run.sh` | **Only** flow launcher (Zellij) |
| `docs/development.md` | Architecture & how to extend |
| `wiki/` | Local runtime data (gitignored at repo root) |
| `scripts/wiki/` | Wiki helper scripts (tracked) |

## Session Binding

| Mode | `FLOW_RESUME_MODE` | Summary regen |
|------|-------------------|---------------|
| new | `bind_specific` + `FLOW_SESSION_ID` | yes |
| continue (pinned id) | `bind_specific` + `FLOW_SESSION_ID` | yes |
| continue (no id) | `auto_latest` | yes |
| resume id | `resume_specific` | no (strict replay) |
| resume picker | `resume_picker` | no |

Policy: `scheme/src/services/session/session-binding-policy.ts`

## Data Rules

- **No SQL DB** — JSONL + `wiki/` + `.flow-runtime/` files
- Root `/wiki/` gitignored; `scripts/wiki/` tracked
- File IO: `scheme/src/data/**` repositories only (summaries: `data/wiki/summary-repository.ts`)
- Session JSONL: `data/session/claude-project.ts`, `jsonl-session.ts`, `repository.ts` (not `services/session/posthoc.ts` for new code)
- Resume UI may hide flow body until graph cache or flowchart ready (`session-binding-policy.ts`)

## Verify

```bash
cd scheme && bun test
cd scheme && bunx tsc --noEmit
ga doctor && ga flow --help
```
