---
name: llm-wiki
description: >-
  GUI-Anything wiki knowledge: Phase 1 ingest (create/update contexts/{intent_key},
  entities, summaries) then Phase 2 maintain (compile, lint, audit). One skill for
  Flow Observer pivot/sweep and manual wiki-maintain.sh. Read gui-anything-layout.md.
  Not for session JSONL, flow launcher, or observer UI.
---

# llm-wiki (GUI-Anything)

Karpathy five ops adapted for Flow Observer. Map: [`references/karpathy-ops-map.md`](references/karpathy-ops-map.md). Upstream: [`reference/llm-wiki-skill`](../../reference/llm-wiki-skill/llm-wiki/SKILL.md).

**One skill, two phases — always in order when both apply:**

1. **Phase 1 — Ingest** (`create` / `update` / `skip`) — compound session knowledge into entry pages
2. **Phase 2 — Maintain** (`apply` / `skip`) — audit resolve, lint fix, compile (moves, merges, bucket index)

Write entry markdown only; the app rebuilds index, log, and progress.

## Start here

1. Read `wiki/knowledge/SCHEMA.md` + `wiki/knowledge/index.md` ([`references/schema-guide.md`](references/schema-guide.md)).
2. Read `gui-anything-layout.md`.
3. Read the task prompt — digest (Phase 1) and/or maintenance report (Phase 2).

## When to run which phase

| Trigger | Phase 1 | Phase 2 |
|---------|---------|---------|
| Flow pivot / session idle sweep | **yes** (automatic) | **yes** when report has work (`FLOW_WIKI_MAINTAIN_AFTER_INGEST`, default on) |
| `./scripts/wiki/wiki-maintain.sh` | skip unless digest in prompt | **yes** |
| Open audits / lint errors | — | **yes** (after any needed entry fixes) |

Phase 1 during flow **does not** resolve audits or migrate flat paths — that is Phase 2.

---

## Phase 1 — Ingest

Prior hit → **update**; new durable fact → **create**; else **skip**.

### Principles

- **Respect attention**: skip when this round adds no durable value.
- **Compound**: same topic → update existing id, do not duplicate.
- **Same shape as the card**: `## 摘要` + `## 解决方案` in each entry.

### Steps

1. Use prior hit + candidates from the task prompt.
2. Write `{id}-{slug}.md` under `knowledge/contexts/{intent_key}/`, `entities/`, or `summaries/`.
   - **intent_key** from task digest (session catalog: `project_design`, `implement`, `debug`, …).
   - Do not create pages at `contexts/` root.
3. End Phase 1 with **one JSON object** (no fence):

```json
{
  "action": "create",
  "target_id": "C001",
  "files_written": ["knowledge/contexts/implement/C001-slug.md"],
  "reason": "brief user-facing rationale"
}
```

| Field | skip | create | update |
|-------|------|--------|--------|
| action, reason | required | required | required |
| files_written | omit | **required** | **required** |
| target_id | omit | from filename | **required** |

Each listed file must exist before you finish. Updates keep the entry's existing path.

---

## Phase 2 — Maintain

Upstream **compile + lint + audit**. Guide: [`references/maintenance-guide.md`](references/maintenance-guide.md). Audit filing: user **`k`** on KNOWLEDGE card → open audit; resolution is Phase 2 only.

### Priority

1. High-severity open audits → medium → low
2. Lint errors, then warnings
3. Flat `contexts/C*.md` → `contexts/{intent_key}/`
4. Bucket `index.md` when ≥4 entries

### Allowed

- **audit** — fix target entry; `audits_resolved` with `# Resolution` on audit body
- **lint** — duplicate id/request, index gaps
- **compile** — `files_moved`, `entries_merged` (no delete)

### Forbidden

- Delete knowledge or audit files
- Hand-edit `index.md`, `log/`, `sessions/`, `outputs/`

### Manifest (Phase 2)

After disk edits, output **one JSON object** (no fence):

```json
{
  "action": "apply",
  "reason": "audit accepted C001; compile: migrated flat entry",
  "files_written": ["knowledge/contexts/implement/C001-slug.md"],
  "files_moved": [{ "from": "knowledge/contexts/C002-old.md", "to": "knowledge/contexts/refactor/C002-old.md" }],
  "audits_resolved": ["2026-05-25T12-00-00-C001.md"],
  "entries_merged": [{ "keep_id": "C001", "remove_ids": ["C003"] }]
}
```

Defer stale anchors — do not list in `audits_resolved`.

---

## References

- `gui-anything-layout.md` — layout contract
- `references/karpathy-ops-map.md` — five ops → phases
- `references/schema-guide.md` — SCHEMA.md role
- `references/research-guide.md` — pages, Idea Evolution, facet
- `references/maintenance-guide.md` — Phase 2 decision tree
- `references/audit-guide.md` — user `k` → Phase 2 loop

## CLI

```bash
./scripts/wiki/wiki-maintain.sh --list-audits
./scripts/wiki/wiki-maintain.sh --dry-run
./scripts/wiki/wiki-maintain.sh
bun run scripts/wiki/knowledge-lint.ts
scripts/wiki/scaffold-knowledge-meta.sh
```
