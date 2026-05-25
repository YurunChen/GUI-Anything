# Research wiki writing guide (GUI-Anything)

Page length and mermaid rules for GUI-Anything research wiki (`contexts/{intent_key}/` ≈ session intent buckets).

## Page types

| Page | Path | Length |
|------|------|--------|
| Intent bucket index (optional) | `contexts/{intent_key}/index.md` | 150–400 words |
| Topic index (Idea Evolution) | `contexts/{intent_key}/{topic}/index.md` | 150–400 words |
| Hypothesis / conclusion | `contexts/{intent_key}/*.md` or `…/{topic}/*.md` | 400–1200 words |
| Entity (paper, dataset, tool) | `entities/N001-slug.md` | 200–500 words |
| Exploration distillate | `summaries/{session}-{exploration}.md` | 150–400 words |

**intent_key** must be from the session catalog (`project_design`, `implement`, `refactor`, `debug`, `devops`, `research`, `explore`, `test_verify`, `general`). The Wiki Curator task prompt includes the bucket key for closed intents.

## Idea Evolution index template

```markdown
---
title: "<Research topic>"
type: context
intent_key: "<catalog key>"
status: active
---

# <Topic>

One-sentence research question.

## Current belief

What we believe now (1–3 sentences).

## Evolution (mermaid)

\`\`\`mermaid
flowchart LR
  H1[Hypothesis v1] --> E1[Evidence exp_1]
  E1 --> P1[Pivot or dead]
\`\`\`

## Sub-pages

- [[C012-hypothesis-v1]] — ...
- [[N003-paper-name]] — entity link

## Open questions

- ...
```

## Facet (replaces errors/snippets/decisions dirs)

When ingest carries engineering persist types, use `facet` on **context** pages:

| facet | Use for |
|-------|---------|
| hypothesis | default research claim |
| protocol | method / metric / ADR |
| command | reproducible shell |
| failure | negative or reproduction failure |
| note | general context note |

## Wikilinks

- `[[C002]]` or `[[entities/N003-slug]]` per `gui-anything-layout.md`
- Link first mention; avoid link walls in KNOWLEDGE card excerpts (keep ## 摘要 short)
