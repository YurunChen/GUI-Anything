#!/usr/bin/env bun
/**
 * Regenerate wiki/knowledge/outputs/progress/index.html
 */

import { resolveWikiRoot } from '../../scheme/src/data/env';
import { KnowledgeRepository } from '../../scheme/src/data/wiki/knowledge-repository';
import { regenerateProgressPage } from '../../scheme/src/services/wiki/progress-html-service';

const wikiRoot = process.env.FLOW_WIKI_DIR ?? resolveWikiRoot();
const repo = new KnowledgeRepository(wikiRoot);
const out = await regenerateProgressPage(repo, wikiRoot);

if (out) {
  console.log(`Progress page: ${out}`);
} else {
  console.log('Skipped (FLOW_WIKI_SKIP_PROGRESS=1)');
}
