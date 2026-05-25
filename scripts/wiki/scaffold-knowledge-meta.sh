#!/usr/bin/env bash
# Initialize wiki/knowledge meta (research three-class layout)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI="${FLOW_WIKI_DIR:-$ROOT/wiki}"
KNOW="$WIKI/knowledge"

mkdir -p "$KNOW/log" "$KNOW/audit/resolved"
mkdir -p "$KNOW/contexts" "$KNOW/entities" "$KNOW/summaries"
mkdir -p "$KNOW/outputs/progress" "$KNOW/outputs/queries"

SCHEMA="$KNOW/SCHEMA.md"
if [[ ! -f "$SCHEMA" ]]; then
  cat > "$SCHEMA" <<'EOF'
# Knowledge schema (research / llm-wiki)

> Read with `index.md` at the start of every Wiki Agent session.

## Scope

Covers:
- Research questions, hypotheses, Idea Evolution (`contexts/{topic}/`)
- Papers, datasets, baselines, tools (`entities/`)
- Per-exploration distillates (`summaries/` → links to `wiki/sessions/*`)

Excludes:
- Raw terminal logs and full PDFs (stay in `wiki/sessions/`)
- Greetings and one-off lookups with no claim change

## Valuable ingest

Ingest or update when: claim/hypothesis changes; new entity; durable protocol or command; negative result worth remembering.
Skip when: greeting; no new facts; `should_persist: false`; duplicate with no delta.

## Directory layout (three classes)

- `contexts/` — concepts, hypotheses, conclusions (recursive `{topic}/` OK)
- `entities/` — external objects (papers, data, tools)
- `summaries/` — agent-only; excluded from UI KNOWLEDGE card

Legacy engineering types (`error` / `snippet` / `decision` from Summary) normalize to `contexts/` with `facet:` in frontmatter.

## ID prefixes

| Storage | Dir | Prefix |
|---------|-----|--------|
| context | contexts/ | C |
| entity | entities/ | N |
| summary | summaries/ | S |

## Idea Evolution

Use `contexts/{topic}/index.md` for the tree overview (mermaid) and sub-pages per hypothesis/pivot.
Prior hit on the same research question → **update**, do not create a duplicate id.

## Maintenance

- Agent: entry markdown + optional summaries/
- Service: index.md, log/, outputs/progress/index.html
- Audit: user `k` → audit/*.md
EOF
fi

INDEX="$KNOW/index.md"
if [[ ! -f "$INDEX" ]]; then
  cat > "$INDEX" <<'EOF'
# Knowledge index

(empty — run flow observer to populate)
EOF
fi

echo "Research knowledge meta scaffolded under $KNOW"
