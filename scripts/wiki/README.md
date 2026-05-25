# Wiki layout (local `wiki/`)

Runtime data lives at repo `wiki/` (gitignored). Observer code uses **research three-class** knowledge:

| Chain | Folder | Contents |
|-------|--------|----------|
| Knowledge | `knowledge/contexts/` | Hypotheses, conclusions, Idea Evolution; engineering notes via `facet:` |
| Knowledge | `knowledge/entities/` | Papers, datasets, tools (`N` prefix ids) |
| Knowledge | `knowledge/summaries/` | Per-exploration distillates (agent-only; excluded from UI match) |
| Meta | `knowledge/SCHEMA.md`, `index.md`, `log/`, `audit/`, `outputs/progress/` | Service-maintained |
| Sessions | `sessions/` | `{sessionId}.json` (flow graph), `-summaries.json`, `-graph-patches.json`, `-evidence.json` |
| Notes | `notes/` | `{YYYY-MM-DD}.md` |

Summary Agent may still emit `persistMeta.type` of `error|snippet|decision`; the wiki layer normalizes those to `contexts/` with `facet:` (no top-level `errors/snippets/decisions/`).

Path helpers: `scheme/src/data/wiki/wiki-data-layout.ts`.

## llm-wiki skill

Tracked skill: `skills/llm-wiki/` at repo root (layout: `gui-anything-layout.md`, pages: `references/research-guide.md`).

Install to Claude Code:

```bash
./scripts/setup.sh   # symlinks .claude/skills/llm-wiki → skills/llm-wiki/
```

## Scaffold knowledge meta

```bash
./scripts/wiki/scaffold-knowledge-meta.sh
# or
bun run scripts/wiki/llm-wiki/scaffold.ts
```

## Purge legacy engineering layout

Removes `knowledge/errors|snippets|decisions/` and `E###`/`S###`/`D###` entry files (no migration). Also runs automatically via `ensureKnowledgeMetaLayout` when flow starts.

```bash
./scripts/wiki/purge-legacy-knowledge.sh
```

## Lint index consistency

```bash
bun run scripts/wiki/knowledge-lint.ts
# or
bun run scripts/wiki/llm-wiki/lint.ts
```

Scans `contexts/**`, `entities/`, `summaries/`; errors if legacy E/S/D dirs remain.

## Progress dashboard

```bash
bun run scripts/wiki/generate-progress-html.ts
```

Auto-regenerated after wiki saved/updated unless `FLOW_WIKI_SKIP_PROGRESS=1`.

## Knowledge maintenance (manual)

Single CLI entry for **Phase 2 maintain** (same `/llm-wiki` skill as Flow ingest). User files audit via observer hotkey `k` (KNOWLEDGE card).

```bash
./scripts/wiki/wiki-maintain.sh --help
./scripts/wiki/wiki-maintain.sh --list-audits   # open [severity] target_id + resolved paths
./scripts/wiki/wiki-maintain.sh --dry-run
./scripts/wiki/wiki-maintain.sh --json
./scripts/wiki/wiki-maintain.sh
```

| Flag | Action |
|------|--------|
| `--list-audits` | List open audits + `audit/resolved/` (no agent) |
| `--dry-run` | Maintenance report (audits + lint + buckets) |
| `--json` | Report as JSON |
| (default) | Run `/llm-wiki` Phase 2 agent pipeline |

`audit-review.sh` and `bun run scripts/wiki/llm-wiki/audit-review.ts` are backward-compat aliases for `--list-audits`.

| Variable | Effect |
|----------|--------|
| `FLOW_WIKI_MAINTAIN=0` | Agent disabled (use `--dry-run`) |
| `FLOW_WIKI_MAINTAIN_PRINT_ONLY=1` | Print JSON manifest only |
| `FLOW_WIKI_MAINTAIN_AFTER_INGEST=0` | Phase 1 后不自动 Phase 2 |
| `FLOW_WIKI_MAINTAIN_INTENTS=implement,debug` | Filter bucket stats in report |

## Migrate from old layout

If you still have `knowledge-base/`, `runtime/`, `evidence/`, or `daily-notes/`:

```bash
./scripts/wiki/migrate-wiki-layout.sh
```

The app does not read those directories after migration.

## Wiki Agent env

| Variable | Effect |
|----------|--------|
| `FLOW_WIKI_RULES_ONLY=1` | Rules + auto-extractor only |
| `FLOW_WIKI_AGENT=0` | Disable Wiki Agent |
| `FLOW_WIKI_PRINT_ONLY=1` | `--print` JSON instead of agentic skill |
| `FLOW_WIKI_SKIP_PROGRESS=1` | Skip progress HTML |

Agentic skill mode uses Claude tools **Read, Edit, Write** only (no Bash). Disk writes are verified before index/log/progress; unverified manifests fall back to rules-layer `save`.
