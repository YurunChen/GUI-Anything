---
name: llm-wiki-maintain
description: >-
  Deprecated alias — use llm-wiki (Phase 2 maintain). Same skill, two phases:
  ingest then maintain. Entry: ./scripts/wiki/wiki-maintain.sh
---

# llm-wiki-maintain (deprecated)

**Merged into [`llm-wiki`](../llm-wiki/SKILL.md).** One skill, two phases:

1. **Phase 1 — Ingest** — create/update (Flow Observer automatic)
2. **Phase 2 — Maintain** — compile + lint + audit (manual CLI)

Read [`../llm-wiki/SKILL.md`](../llm-wiki/SKILL.md) and [`../llm-wiki/references/maintenance-guide.md`](../llm-wiki/references/maintenance-guide.md).

```bash
./scripts/wiki/wiki-maintain.sh --dry-run
./scripts/wiki/wiki-maintain.sh
```
