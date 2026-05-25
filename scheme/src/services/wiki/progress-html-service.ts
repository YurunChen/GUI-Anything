/**
 * Static progress dashboard — wiki/knowledge/outputs/progress/index.html
 * Service post-process only; Wiki Agent does not write HTML.
 */

import * as fs from 'node:fs';
import {
  ensureKnowledgeMetaLayout,
  knowledgeProgressIndexPath,
} from '../../data/wiki/wiki-data-layout';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
  type KnowledgeType,
} from '../../data/wiki/knowledge-repository';
import { resolveWikiRoot } from '../../data/env';

const TYPE_LABELS: Record<KnowledgeType, string> = {
  context: 'Context',
  entity: 'Entity',
  summary: 'Summary',
};

function countByType(entries: KnowledgeEntry[]): Record<KnowledgeType, number> {
  const counts: Record<KnowledgeType, number> = {
    context: 0,
    entity: 0,
    summary: 0,
  };
  for (const entry of entries) {
    counts[entry.type]++;
  }
  return counts;
}

function recentRows(entries: KnowledgeEntry[], limit = 12): string {
  const sorted = [...entries].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return bTime - aTime;
  });
  return sorted.slice(0, limit).map((e) => {
    const when = new Date(e.updatedAt ?? e.createdAt).toISOString().slice(0, 16).replace('T', ' ');
    const req = e.request.replace(/</g, '&lt;').slice(0, 72);
    return `<tr><td>${e.id}</td><td>${TYPE_LABELS[e.type]}</td><td>${req}</td><td>${when}</td></tr>`;
  }).join('\n');
}

export function buildProgressHtml(entries: KnowledgeEntry[]): string {
  const counts = countByType(entries);
  const total = entries.length;
  const updated = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Knowledge progress</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; background: #fafafa; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .stat { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 0.75rem 1rem; min-width: 5rem; }
    .stat strong { display: block; font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    th { background: #f3f3f3; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Knowledge progress</h1>
  <p class="meta">Auto-generated · ${updated}</p>
  <div class="stats">
    <div class="stat"><strong>${total}</strong>Total</div>
    <div class="stat"><strong>${counts.context}</strong>Context</div>
    <div class="stat"><strong>${counts.entity}</strong>Entity</div>
    <div class="stat"><strong>${counts.summary}</strong>Summary</div>
  </div>
  <h2>Recent updates</h2>
  <table>
    <thead><tr><th>ID</th><th>Type</th><th>Request</th><th>Updated</th></tr></thead>
    <tbody>
${recentRows(entries)}
    </tbody>
  </table>
</body>
</html>`;
}

export function shouldSkipProgressPage(): boolean {
  const v = (process.env.FLOW_WIKI_SKIP_PROGRESS || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function regenerateProgressPage(
  repo?: KnowledgeRepository,
  wikiRoot?: string,
): Promise<string | null> {
  if (shouldSkipProgressPage()) return null;

  const root = wikiRoot ?? resolveWikiRoot();
  ensureKnowledgeMetaLayout(root);
  const knowledgeRepo = repo ?? new KnowledgeRepository(root);
  const entries = await knowledgeRepo.listAll();
  const html = buildProgressHtml(entries);
  const outPath = knowledgeProgressIndexPath(root);
  fs.writeFileSync(outPath, html, 'utf-8');
  return outPath;
}
