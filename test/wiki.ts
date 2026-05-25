#!/usr/bin/env bun
/**
 * Manual smoke test for wiki read path (knowledge + match + notes).
 *
 * Usage (from repo root):
 *   FLOW_WIKI_DIR=./wiki bun test/wiki.ts
 */

import { resolveWikiRoot } from '../scheme/src/data/env';
import { KnowledgeRepository } from '../scheme/src/data/wiki/knowledge-repository';
import { DefaultWikiMatchService } from '../scheme/src/services/wiki/match-service';
import { DefaultInspirationNoteService } from '../scheme/src/services/wiki/inspiration-note-service';

async function main(): Promise<void> {
  console.log(`Wiki root: ${resolveWikiRoot()}\n`);

  const repo = new KnowledgeRepository();
  const entries = await repo.listAll();
  console.log(`1️⃣ Knowledge entries: ${entries.length}`);
  for (const entry of entries.slice(0, 8)) {
    console.log(`   - ${entry.id}  ${entry.request.slice(0, 48)}`);
  }

  console.log('\n2️⃣ Wiki match');
  const matcher = new DefaultWikiMatchService(repo);
  const sampleQuery = entries[0]?.request || '分析下当前的项目';
  const match = matcher.searchByQuerySync(sampleQuery, 0.5);
  if (match) {
    console.log(`   ✅ ${match.entry.id}  score=${match.score.toFixed(2)}  request="${match.entry.request.slice(0, 40)}"`);
  } else {
    console.log(`   ℹ️  no match for "${sampleQuery.slice(0, 40)}"`);
  }

  console.log('\n3️⃣ Inspiration notes');
  const notes = new DefaultInspirationNoteService();
  const recent = notes.listRecentInspirations(5);
  console.log(`   ✅ recent: ${recent.length}`);
  for (const item of recent.slice(0, 3)) {
    console.log(`      - ${item.id}  ${item.title.slice(0, 36)}`);
  }

  console.log('\n✨ Done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
