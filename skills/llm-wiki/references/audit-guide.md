# Audit (Flow Observer)

User flags a KNOWLEDGE card mismatch with hotkey **`k`**. The app writes `wiki/knowledge/audit/{timestamp}-{targetId}.md`.

Workflow shape follows [upstream audit-guide](../../../reference/llm-wiki-skill/llm-wiki/references/audit-guide.md); filing is Observer-native (no Obsidian plugin).

## Layout

```
wiki/knowledge/audit/
├── 2026-05-25T12-00-00-C001.md   ← open
└── resolved/                     ← processed (never delete)
```

## Typical frontmatter (service-generated)

```yaml
---
target_id: "C001"
severity: medium
filed_at: "2026-05-25T12:00:00.000Z"
session_id: "..."
exploration_id: "..."
status: open
---
```

Body: **Anchor** (card excerpt), optional **Context request**, **Notes**.

### Severity (GUI-Anything)

| Value | Treat as | Process order |
|-------|----------|---------------|
| `high` | factual error | 1st |
| `medium` | likely wrong / stale | 2nd |
| `low` | suggestion / note | 3rd |

(Map upstream `error`/`warn` → high/medium; `suggest`/`info` → low.)

## Anchor strategy

Upstream uses `anchor_before` / `anchor_text` / `anchor_after`. Observer stores a single **Anchor** excerpt from the KNOWLEDGE hit. During maintain:

1. Open `target_id` entry under `knowledge/contexts/**` or `entities/`
2. Search body for anchor text (or related request)
3. If anchor stale, **defer** — do not resolve audit; note in maintain manifest reason

## Processing workflow (maintain lane)

1. `./scripts/wiki/wiki-maintain.sh --list-audits` — list open + resolved
2. `./scripts/wiki/wiki-maintain.sh --dry-run` — report bundles audits + lint
3. For each open audit (high → medium → low):
   - **Accept** — fix target entry; add filename to `audits_resolved`
   - **Partial** — fix what is clear; resolution notes the rest
   - **Reject** — out of scope or contradicts session evidence; still move to `resolved/` with rationale
   - **Defer** — leave in `audit/` (do **not** list in `audits_resolved`)
4. Service moves resolved audits to `audit/resolved/`, sets `status: resolved`, appends `# Resolution`

## Resolution section (append before move)

```markdown
# Resolution

2026-05-25 · accepted.
Corrected summary in contexts/implement/C001-slug.md per anchor.
Updated target_id C001.
```

Rejected example:

```markdown
# Resolution

2026-05-25 · rejected.
Prior hit was acceptable for exploration scope; audit reflected preference not factual error.
```

## Loop

Phase 1 ingest does not process audits. Close the loop with Phase 2 (same `/llm-wiki` skill):

1. User `k` → open audit
2. `wiki-maintain.sh --list-audits` (optional)
3. `wiki-maintain.sh` → Phase 2 fix + `audits_resolved`

## CLI

```bash
./scripts/wiki/wiki-maintain.sh --list-audits
./scripts/wiki/wiki-maintain.sh --dry-run
./scripts/wiki/wiki-maintain.sh
```
