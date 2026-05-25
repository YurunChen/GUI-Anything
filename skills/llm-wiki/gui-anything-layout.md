# GUI-Anything knowledge layout (research / llm-wiki)

Adaptation of [llm-wiki](SKILL.md) for Flow Observer. Aligned with [research-guide.md](references/research-guide.md).

## Top-level (three chains only)

```
wiki/
├── knowledge/     ← long-lived markdown
├── sessions/      ← summaries, graph, evidence (immutable source)
└── notes/         ← user daily notes
```

No `raw/` under `wiki/knowledge/`. Evidence: `wiki/sessions/{id}-evidence.json`.

## knowledge/ tree (three classes)

```
wiki/knowledge/
├── SCHEMA.md
├── index.md              ← service rebuilds (do not hand-edit)
├── log/YYYY-MM-DD.md
├── audit/ + audit/resolved/
├── contexts/             ← ≈ llm-wiki concepts (hypotheses, Idea Evolution, conclusions)
│   └── {intent_key}/     ← session intent bucket (project_design, implement, debug, …)
│       └── {topic}/      ← optional divide-and-conquer when >1200 words
├── entities/             ← ≈ llm-wiki entities (papers, data, tools)
├── summaries/            ← ≈ llm-wiki summaries (agent-only; excluded from UI match)
└── outputs/
    ├── progress/index.html
    └── queries/
```

**Removed:** top-level `errors/`, `snippets/`, `decisions/`. Summary `error|snippet|decision` → `contexts/` + `facet:` in frontmatter.

## ID prefixes

| Storage | Directory | Prefix |
|---------|-----------|--------|
| context | contexts/ | C |
| entity | entities/ | N |
| summary | summaries/ | S |

## Valuable ingest

| Signal | Action | Where |
|--------|--------|-------|
| Prior hit + new facts | update | existing context/entity |
| New hypothesis / conclusion | create | contexts/{intent_key}/ or nested {topic}/ |
| New paper / dataset / tool | create | entities/ |
| Per-exploration distillate | create (optional) | summaries/ |
| persist error/snippet/decision | create/update | contexts/{intent_key}/ + facet |
| No value / opt_out | skip | — |

## Agent vs service

| Who | Writes |
|-----|--------|
| Wiki Agent (`/llm-wiki`) | contexts/{intent_key}/, entities/, summaries/ markdown |
| WikiMaintenanceService | index.md, log/, outputs/progress/index.html |

## Env

| Variable | Effect |
|----------|--------|
| `FLOW_WIKI_RULES_ONLY=1` | Rules + auto-extractor only |
| `FLOW_WIKI_AGENT=0` | Disable Wiki Agent |
| `FLOW_WIKI_PRINT_ONLY=1` | `--print` JSON instead of agentic skill |
| `FLOW_WIKI_SKIP_PROGRESS=1` | Skip progress HTML |
