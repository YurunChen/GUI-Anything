import { describe, expect, it } from 'bun:test';
import { buildProgressHtml, shouldSkipProgressPage } from './progress-html-service';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';

function entry(partial: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: 'C001',
    slug: 'test',
    sessionId: 's',
    explorationId: 'e',
    type: 'context',
    request: 'test request',
    content: '',
    confidence: 0.8,
    tags: [],
    createdAt: Date.now(),
    ...partial,
  };
}

describe('progress-html-service', () => {
  it('builds HTML with type counts', () => {
    const html = buildProgressHtml([
      entry({ id: 'C001', type: 'context' }),
      entry({ id: 'N001', type: 'entity' }),
    ]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('C001');
    expect(html).toContain('Knowledge progress');
  });

  it('respects FLOW_WIKI_SKIP_PROGRESS', () => {
    const prev = process.env.FLOW_WIKI_SKIP_PROGRESS;
    process.env.FLOW_WIKI_SKIP_PROGRESS = '1';
    expect(shouldSkipProgressPage()).toBe(true);
    if (prev === undefined) delete process.env.FLOW_WIKI_SKIP_PROGRESS;
    else process.env.FLOW_WIKI_SKIP_PROGRESS = prev;
  });
});
