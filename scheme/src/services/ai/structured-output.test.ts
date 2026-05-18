import { describe, expect, it } from 'bun:test';
import {
  toFlowchartHint,
  validateGraphConsolidationOutput,
  validateStructuredSummaryOutput,
} from './structured-output';

describe('validateStructuredSummaryOutput flowchart contract', () => {
  it('accepts valid flowchart fields', () => {
    const raw = JSON.stringify({
      summary: '用户希望重构 flowchart 的树结构展示。',
      solution_detail: '先重构提示词，再重构渲染。',
      persist: {
        should_persist: true,
        type: 'decision',
        confidence: 0.88,
      },
      flowchart: {
        node_id: 'refactor_tree_ui',
        node_title: '重构树形 flowchart',
        parent_id: null,
        branch_type: 'trunk',
        importance: 'high',
        drop_from_chart: false,
        intent_key: 'flowchart_refactor',
      },
    });
    const result = validateStructuredSummaryOutput(raw, { question: 'q', nodeCount: 3 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.flowchart?.node_id).toBe('refactor_tree_ui');
    expect(toFlowchartHint(result.data)?.intentKey).toBe('flowchart_refactor');
  });

  it('fails when required flowchart fields are missing', () => {
    const raw = JSON.stringify({
      summary: 'summary',
      solution_detail: '',
      persist: {
        should_persist: false,
        type: 'none',
        confidence: 0.5,
      },
      flowchart: {
        node_id: '',
        node_title: 'x',
        parent_id: null,
        branch_type: 'trunk',
        importance: 'medium',
        drop_from_chart: false,
        intent_key: '',
      },
    });
    const result = validateStructuredSummaryOutput(raw, { question: 'q', nodeCount: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fallbackReason).toBe('missing_flowchart_fields');
  });

  it('fails when cjk summary exceeds 200 chars', () => {
    const longSummary = '结论'.repeat(120);
    const raw = JSON.stringify({
      summary: longSummary,
      solution_detail: '',
      persist: {
        should_persist: false,
        type: 'none',
        confidence: 0.5,
      },
      flowchart: {
        node_id: 'x',
        node_title: '标题',
        parent_id: null,
        branch_type: 'trunk',
        importance: 'medium',
        drop_from_chart: false,
        intent_key: 'x',
      },
    });
    const result = validateStructuredSummaryOutput(raw, { question: 'q', nodeCount: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fallbackReason).toBe('summary_too_long');
  });
});

describe('validateGraphConsolidationOutput', () => {
  it('accepts valid graph patch list', () => {
    const raw = JSON.stringify({
      action: 'patch',
      graph_patch: [
        {
          op: 'merge_intents',
          source_intent_keys: ['a', 'b'],
          target_intent_key: 'ab',
          reason: 'duplicate intents',
          confidence: 0.8,
        },
      ],
    });
    const result = validateGraphConsolidationOutput(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.action).toBe('patch');
    expect(result.data.graph_patch[0].op).toBe('merge_intents');
  });

  it('fails when action is invalid', () => {
    const raw = JSON.stringify({
      action: 'rewrite',
      graph_patch: [],
    });
    const result = validateGraphConsolidationOutput(raw);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fallbackReason).toBe('invalid_action');
  });
});
