/**
 * Rebuild wiki/knowledge/index.md from on-disk entries.
 */

import * as fs from 'node:fs';
import {
  ensureDir,
  ensureKnowledgeMetaLayout,
  knowledgeIndexPath,
  wikiKnowledgeDir,
} from './wiki-data-layout';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
  type KnowledgeType,
} from './knowledge-repository';
import { resolveWikiRoot } from '../env';

const TYPE_ORDER: KnowledgeType[] = ['context', 'entity', 'summary'];

function formatIndexRow(entry: KnowledgeEntry): string {
  const slug = entry.slug || entry.id;
  const request = entry.request.replace(/\|/g, '\\|').slice(0, 80);
  return `| ${entry.id} | ${entry.type} | ${slug} | ${request} |`;
}

export function buildKnowledgeIndexMarkdown(entries: KnowledgeEntry[]): string {
  const sorted = [...entries].sort((a, b) => {
    const typeDiff = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (typeDiff !== 0) return typeDiff;
    return a.id.localeCompare(b.id);
  });

  const lines = [
    '# Knowledge index',
    '',
    'Auto-generated — do not edit by hand. Run `bun run scripts/wiki/knowledge-lint.ts` to verify.',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    '| ID | Type | Slug | Request |',
    '| --- | --- | --- | --- |',
    ...sorted.map(formatIndexRow),
    '',
    `Total: ${sorted.length}`,
    '',
  ];
  return lines.join('\n');
}

export async function rebuildKnowledgeIndex(
  repo?: KnowledgeRepository,
  wikiRoot?: string,
): Promise<string> {
  const root = wikiRoot ?? resolveWikiRoot();
  ensureKnowledgeMetaLayout(root);
  const knowledgeRepo = repo ?? new KnowledgeRepository(root);
  const entries = await knowledgeRepo.listAll();
  const markdown = buildKnowledgeIndexMarkdown(entries);
  const indexPath = knowledgeIndexPath(root);
  ensureDir(wikiKnowledgeDir(root));
  fs.writeFileSync(indexPath, markdown, 'utf-8');
  return indexPath;
}
