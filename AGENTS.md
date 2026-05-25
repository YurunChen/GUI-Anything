# GUI-Anything Agent Notes

## Purpose

Dual-pane Flow Observer for Claude Code: left = Claude, right = live observer (`scheme/`).

Public entry: **`ga flow`**, **`ga doctor`**.

## Repo Map

| Path | Role |
|------|------|
| `cli/` | `ga` CLI |
| `scheme/` | Observer app + services + data adapters |
| `docs/development.md` | Layering, launcher, extension guide |
| `scripts/flow-run.sh` | **Only** flow launcher (Zellij) |
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
cd scheme && bun test && bun run tsc --noEmit
ga doctor && ga flow --help
```

## Wiki Agent (无感沉淀)

- **Summary Agent** (`services/ai/flow-summaries.ts`): session 摘要 + `persistMeta` 候选信号
- **Wiki Agent** (`services/wiki/wiki-agent/` + `wiki-maintenance-service.ts`): agentic `/llm-wiki` skill（`runClaudeAgentPrompt` + acceptEdits + Read/Edit/Write/Bash）写 knowledge 条目；manifest JSON 收尾；服务层 post-process：`rebuildKnowledgeIndex` / `appendKnowledgeLog` / `regenerateProgressPage`；失败回退 `--print` JSON 或规则层
- 默认启用 Claude；仅规则：`FLOW_WIKI_RULES_ONLY=1`；禁用：`FLOW_WIKI_AGENT=0`；仅 print JSON：`FLOW_WIKI_PRINT_ONLY=1`；跳过 progress HTML：`FLOW_WIKI_SKIP_PROGRESS=1`；模型：`FLOW_WIKI_MODEL` 或 `CLAUDE_MODEL`
- Skill 源码：`skills/llm-wiki/`；Claude 发现路径：`.claude/skills/llm-wiki/`（仓库 symlink，`setup.sh` 可链到 `~/.claude/skills/`）
- 用户无额外步骤；每张探索卡片 meta 显示 `wiki saved` / `updated` / `skipped` / `pending`
- 每轮 exploration：AI summary ready 后调用 Wiki Agent 判断是否落盘（`wiki-persist-policy.ts`）；skip 由 `low_value` / Agent 决策，不用 `title_delta` 门禁
- KNOWLEDGE 卡片 = 仅 prior 检索（`summaries/` 不参与 UI match pool）；`k` = 标记有误 → `wiki/knowledge/audit/`

Scaffold meta: `scripts/wiki/scaffold-knowledge-meta.sh` · Lint: `bun run scripts/wiki/knowledge-lint.ts` · Progress: `bun run scripts/wiki/generate-progress-html.ts` · llm-wiki scripts: `scripts/wiki/llm-wiki/`

## UI Layer Rules

Presentation code under `scheme/src/app/ui/flow/` must not import services or repositories. See [docs/data-governance/ui-layer-rules.md](docs/data-governance/ui-layer-rules.md).

Observer chrome (`FlowObserverShell`):

| Zone | Component | Shows |
|------|-----------|--------|
| Top | `ObserverStatusBar` | Row 1: model, tokens, done/errors, hot files; row 2: intent title — **no session id**, no activity line |
| Middle | `LiveObserverFlowBody` | Timeline / flowchart; `WikiMatchCard` + per-card `wiki saved/skipped/…` meta |
| Bottom | `CommandBar` | Hotkeys with action labels (`FLOW_LOCALE` for zh) |
| Help overlay | `HelpOverlay` | `?` / F1 / Ctrl+/ / `/` / Ctrl-K = shortcuts — **hide CommandBar** while help open |
| Notes sidebar | `NotesSidePanel` (`i`) | Right column: recent notes + capture; timeline shrinks — CommandBar stays visible |

No separate command palette: `/` and Ctrl-K open the same shortcut list as `?`. Calm compact layout is **off by default**; `c` toggles it. Wiki matches stay inline on expanded cards. Shortcuts apply when the observer pane is focused; `Esc` closes overlays only; `q` / Ctrl+Q quits. Keyboard logic: `observer-key-dispatch.ts`.

**Launcher cleanup** (`flow-run.sh`): panes spawn with `setsid` / `perl setpgrp`; exit uses SIGTERM then SIGKILL; new starts call `cleanup_stale_launchers` (other launcher PIDs only). Stale orphans: `./scripts/flow-run.sh --cleanup`.

**Wiki**: agentic llm-wiki — `wiki-maintenance-service.ts`（agent 写盘 + index/log/progress post-process）；prior hit updates existing page (`wiki updated`)。`knowledge/` 含 `contexts/**`、`entities/`、`summaries/`（UI match 排除 summaries）。Audit: `k` hotkey → `knowledge/audit/`。Meta: `SCHEMA.md`, `index.md`, `log/`, `outputs/progress/`。Skill: `skills/llm-wiki/`。`match-service.ts` CJK filler normalize；`auto-extractor.ts` fallback。Legacy E/S/D layout purged on ensure; `scripts/wiki/purge-legacy-knowledge.sh`. Old `knowledge-base/`: `scripts/wiki/migrate-wiki-layout.sh`。

Optional env:
- `FLOW_NO_ANIMATIONS=1` — slower spinner interval (400ms) for low-motion
- `FLOW_LOCALE=zh-Hans` — localized chrome strings (summary body stays model language)
