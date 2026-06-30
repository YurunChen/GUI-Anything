# SCHEMA.md guide

`wiki/knowledge/SCHEMA.md` is the **schema document** for the current workspace wiki. Read it at the start of every **ingest** or **maintain** session, together with `wiki/knowledge/index.md`.

Adapted from [Karpathy schema-guide](../../../reference/llm-wiki-skill/llm-wiki/references/schema-guide.md).

## What SCHEMA.md covers

- **Scope** — what belongs in `contexts/` vs `entities/` vs `summaries/`
- **Intent buckets** — `contexts/{intent_key}/` aligned with session intent catalog
- **ID prefixes** — C / N / S
- **Frontmatter** — required fields, optional `facet`, `intent_key`
- **Ingest vs maintain** — Phase 1 vs Phase 2 in one [`llm-wiki` SKILL](../../SKILL.md) (see [`karpathy-ops-map.md`](karpathy-ops-map.md))

## Co-evolve with the wiki

Update SCHEMA.md when:

- Intent catalog changes (`session-intent-keys.ts`)
- New bucket layout convention (e.g. mandatory `index.md` threshold)
- Audit or lint policy changes

The Wiki Agent does **not** rewrite SCHEMA.md during Phase 1 ingest; Phase 2 may propose SCHEMA updates only when scope genuinely changed (rare).

## Audit backlog (Phase 2)

Upstream tracks open audit counts in CLAUDE.md. Here:

1. `./scripts/wiki/wiki-maintain.sh --list-audits` — list open vs resolved
2. Glance before **Phase 2**; process `high` / blocking lint first
3. After maintain pass, open count should drop; resolved files live under `audit/resolved/`

## Open questions

Use SCHEMA.md or bucket `index.md` **Open questions** sections for contradictions deferred during audit (upstream: leave audit open + add to CLAUDE.md). Do not silently drop stale anchors — note in resolution or defer.

## Naming

- Context slugs: kebab-case in filename (`C001-my-slug.md`)
- Display title: frontmatter `request` + body headings
- Wikilinks: optional; Flow KNOWLEDGE card uses id + request match, not wikilinks

See [`research-guide.md`](research-guide.md) for page length and Idea Evolution splits.
