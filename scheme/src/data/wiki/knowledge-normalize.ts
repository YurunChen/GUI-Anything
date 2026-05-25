/**
 * Research wiki type normalization — llm-wiki three-class (contexts / entities / summaries).
 * Summary Agent may still emit error|snippet|decision; disk uses context + facet or entity.
 */

import type { WikiPersistType } from '../protocol/wiki-types';
import type { KnowledgeType } from './knowledge-repository';
import { allocateSequentialId } from './id-allocation';

export type KnowledgeFacet = 'hypothesis' | 'protocol' | 'command' | 'failure' | 'note';

export type StorageKnowledgeType = 'context' | 'entity' | 'summary';

const ID_PREFIX: Record<StorageKnowledgeType, string> = {
  context: 'C',
  entity: 'N',
  summary: 'S',
};

/** Legacy persist types → storage type on disk. */
export function normalizeStorageType(
  persistType: WikiPersistType | string | undefined,
): StorageKnowledgeType | null {
  if (!persistType || persistType === 'none') return null;
  if (persistType === 'entity') return 'entity';
  if (persistType === 'context') return 'context';
  if (persistType === 'error' || persistType === 'snippet' || persistType === 'decision') {
    return 'context';
  }
  return null;
}

/** Facet for context pages (replaces top-level errors/snippets/decisions dirs). */
export function facetFromPersistType(
  persistType: WikiPersistType | string | undefined,
): KnowledgeFacet | undefined {
  switch (persistType) {
    case 'error':
      return 'failure';
    case 'snippet':
      return 'command';
    case 'decision':
      return 'protocol';
    case 'context':
      return 'hypothesis';
    default:
      return undefined;
  }
}

/** Parse on-disk frontmatter `type` (context | entity | summary only). */
export function parseStorageType(raw: string | undefined): StorageKnowledgeType {
  if (raw === 'entity') return 'entity';
  if (raw === 'summary') return 'summary';
  return 'context';
}

export function allocateId(
  type: StorageKnowledgeType,
  existingIds: string[],
): string {
  const prefix = ID_PREFIX[type];
  return allocateSequentialId(prefix, existingIds);
}

export { allocateSequentialId } from './id-allocation';

export function storageTypeToKnowledgeType(t: StorageKnowledgeType): KnowledgeType {
  return t;
}

export const RESEARCH_SCHEMA_TEMPLATE = `# Knowledge schema (research / llm-wiki)

> Read with \`index.md\` at the start of every Wiki Agent session.

## Scope

Covers:
- Research questions, hypotheses, Idea Evolution (\`contexts/{intent_key}/\`, optional deeper \`{topic}/\`)
- Papers, datasets, baselines, tools (\`entities/\`)
- Per-exploration distillates (\`summaries/\` → links to \`wiki/sessions/*\`)

Excludes:
- Raw terminal logs and full PDFs (stay in \`wiki/sessions/\`)
- Greetings and one-off lookups with no claim change

## Valuable ingest

Ingest or update when: claim/hypothesis changes; new entity; durable protocol or command; negative result worth remembering.
Skip when: greeting; no new facts; \`should_persist: false\`; duplicate with no delta.

## Directory layout (three classes)

- \`contexts/{intent_key}/\` — concepts, hypotheses, conclusions (session intent bucket; optional nested \`{topic}/\`)
- \`entities/\` — external objects (papers, data, tools)
- \`summaries/\` — agent-only; excluded from UI KNOWLEDGE card

Summary \`persistMeta\` types \`error|snippet|decision\` normalize to \`contexts/\` with \`facet:\` at ingest (not separate directories).

## ID prefixes

| Storage | Dir | Prefix |
|---------|-----|--------|
| context | contexts/ | C |
| entity | entities/ | N |
| summary | summaries/ | S |

## Frontmatter (main entries)

Required: id, slug, request, type (context|entity), category, tags, source, version, status
Optional: intent_key (session catalog key), facet (hypothesis|protocol|command|failure|note), evolution_parent, related

## Idea Evolution

Use \`contexts/{intent_key}/index.md\` for bucket overview and sub-pages per hypothesis/pivot.
Prior hit on the same research question → **update**, do not create a duplicate id.

## Maintenance

- Agent: entry markdown + optional summaries/
- Service: index.md, log/, outputs/progress/index.html
- Audit: user \`k\` → audit/*.md
`;
