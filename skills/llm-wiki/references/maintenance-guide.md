# Wiki maintenance guide (Phase 2)

Decision tree for **llm-wiki Phase 2** — upstream **compile + lint + audit**. Phase 1 ingest: same [`SKILL.md`](../SKILL.md). Ops map: [`karpathy-ops-map.md`](karpathy-ops-map.md).

## Session start

1. Read `wiki/knowledge/SCHEMA.md` + `wiki/knowledge/index.md`
2. Complete **Phase 1 ingest** first if the task prompt includes a digest (create/update before structural fixes)
3. Read maintenance report (`./scripts/wiki/wiki-maintain.sh --dry-run`)

## Lifecycle

```text
Flow pivot/sweep        →  Phase 1 ingest (automatic, same /llm-wiki skill)
KNOWLEDGE prior wrong   →  user `k`  →  knowledge/audit/*.md (open)
       ↓
wiki-maintain.sh        →  Phase 2 maintain (same /llm-wiki skill)
       ↓
compile / lint / audit  →  audit/resolved/*.md + index rebuild
```

## Three maintain operations

### `audit` (process feedback)

1. Sort open audits: **high → medium → low**
2. Read target entry (`target_id` → `C###` file)
3. Locate anchor text in body; if stale → **defer** (skip `audits_resolved`)
4. Decide: accept / partial / reject / defer (see [`audit-guide.md`](audit-guide.md))
5. Append `# Resolution` to audit body; list filename in `audits_resolved`

### `lint` (health check)

Run `bun run scripts/wiki/knowledge-lint.ts` or use report issues:

1. **Errors first** — duplicate id, missing index entry
2. **Warnings** — duplicate request, stale draft
3. Propose fix, apply via entry update or `entries_merged`

### `compile` (structure)

1. **Flat migration** — `contexts/C*.md` → `contexts/{intent_key}/` via `files_moved`
2. **Near-duplicates** — `entries_merged` (no delete)
3. **Bucket index** — create `contexts/{intent_key}/index.md` when ≥4 entries

Do not hand-edit `knowledge/index.md`; service rebuilds after apply.

## Priority order (combined pass)

1. High-severity open audits
2. Lint errors
3. Lint warnings (duplicate request)
4. Flat contexts migration
5. Bucket index creation

## Merge policy (no delete)

1. Pick **keep_id**
2. Update keep page with merged facts
3. `entries_merged`: stamp slaves with `merged_into` (service adds banner)

## Skip

`"action": "skip"` when report is clean or fixes would be speculative.

## Example manifest

```json
{
  "action": "apply",
  "reason": "audit: accepted C001; lint: merged duplicate request",
  "files_written": ["knowledge/contexts/debug/C001-fix-tests.md"],
  "audits_resolved": ["2026-05-25T08-00-00-C001.md"],
  "entries_merged": [{ "keep_id": "C001", "remove_ids": ["C003"] }]
}
```

## Env

| Variable | Effect |
|----------|--------|
| `FLOW_WIKI_MAINTAIN=0` | Phase 2 agent disabled |
| `FLOW_WIKI_MAINTAIN_PRINT_ONLY=1` | Print JSON only |
| `FLOW_WIKI_MAINTAIN_AFTER_INGEST=0` | Skip Phase 2 auto-run after ingest |
| `FLOW_WIKI_MAINTAIN_INTENTS=implement,debug` | Filter bucket stats |
