# Karpathy llm-wiki → Flow Observer mapping

Upstream reference: [`reference/llm-wiki-skill/llm-wiki/SKILL.md`](../../../reference/llm-wiki-skill/llm-wiki/SKILL.md) (five operations: **compile**, **ingest**, **query**, **lint**, **audit**).

Flow Observer adapts the pattern for any workspace: session JSONL-derived state stays in `wiki/sessions/`; long-lived knowledge stays in `wiki/knowledge/`.

## Five operations here

| Upstream op | Flow Observer phase | Who runs | Entry |
|-------------|-------------------|----------|-------|
| **ingest** | Phase 1 — create/update context pages | Observer (automatic) | `/llm-wiki` on pivot / session sweep |
| **compile** | Phase 2 — split/merge, bucket `index.md`, flat→intent | Human CLI | `./scripts/wiki/wiki-maintain.sh` |
| **lint** | Phase 2 — `knowledge-lint.ts` + report | Human CLI | `--dry-run` or maintain agent |
| **audit** | Phase 2 — resolve `knowledge/audit/` after user `k` | Human CLI | same skill + `audits_resolved` |
| **query** | — (read-only prior match) | Observer | `match-service` — **not** wiki agent |

All agentic wiki work uses **one skill** (`/llm-wiki`): Phase 1 first when digest present, then Phase 2.

**Not ported (by design):** `raw/` corpus, Obsidian plugin, web viewer, `outputs/queries/` promotion loop. Flow explorations + `wiki/sessions/*-evidence.json` are the immutable source chain.

## Session start (agent)

Upstream: read `CLAUDE.md` + `wiki/index.md`.

Here:

1. `wiki/knowledge/SCHEMA.md` — scope, types, intent buckets (see [`schema-guide.md`](schema-guide.md))
2. `wiki/knowledge/index.md` — service-maintained catalog (do not hand-edit during ingest)
3. Task prompt: digest (Phase 1) and/or maintenance report (Phase 2)

## Directory mapping

| Upstream | Flow Observer |
|----------|--------------|
| `CLAUDE.md` | `knowledge/SCHEMA.md` |
| `wiki/concepts/` | `knowledge/contexts/{intent_key}/` |
| `wiki/entities/` | `knowledge/entities/` |
| `wiki/summaries/` | `knowledge/summaries/` (agent-only) |
| `audit/` | `knowledge/audit/` + `resolved/` |
| `log/` | `knowledge/log/` |
| `wiki/index.md` | `knowledge/index.md` |

## When to run which phase

```text
Normal coding flow     →  Phase 1 only (automatic on pivot/sweep)
Open audits / lint fail →  Phase 2 via wiki-maintain.sh
Repo housekeeping      →  wiki-maintain.sh --dry-run first
Full manual session    →  Phase 1 (if digest) then Phase 2 in one /llm-wiki run
```

## Reference docs (read-only)

- [`reference/llm-wiki-skill/llm-wiki/references/schema-guide.md`](../../../reference/llm-wiki-skill/llm-wiki/references/schema-guide.md)
- [`reference/llm-wiki-skill/llm-wiki/references/audit-guide.md`](../../../reference/llm-wiki-skill/llm-wiki/references/audit-guide.md)

Use upstream for **workflow shape**; use [`knowledge-layout.md`](../knowledge-layout.md) for **paths and manifests**.
