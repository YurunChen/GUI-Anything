import { describe, expect, it } from 'bun:test';
import { validateWikiAgentDecision } from './validate';

describe('validateWikiAgentDecision', () => {
  it('parses update JSON', () => {
    const raw = JSON.stringify({
      action: 'update',
      target_id: 'C001',
      type: 'context',
      slug: 'project-analysis',
      sections: { summary: '新摘要', solution: '新方案细节' },
      related_ids: [],
      tags: ['proj:test'],
      reason: 'compound update',
    });
    const result = validateWikiAgentDecision(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('update');
      expect(result.data.target_id).toBe('C001');
    }
  });

  it('parses skip', () => {
    const result = validateWikiAgentDecision('{"action":"skip","type":"context","slug":"x","sections":{"summary":"","solution":""},"related_ids":[],"tags":[],"reason":"greeting"}');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.action).toBe('skip');
  });

  it('rejects summary type on print path', () => {
    const raw = JSON.stringify({
      action: 'create',
      type: 'summary',
      slug: 'distill',
      sections: { summary: 'a', solution: 'b' },
      related_ids: [],
      tags: [],
      reason: 'distill',
    });
    const result = validateWikiAgentDecision(raw);
    expect(result.success).toBe(false);
  });
});
