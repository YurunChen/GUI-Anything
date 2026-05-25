import { describe, expect, it } from 'bun:test';
import {
  buildTrivialGreetingSummaryResult,
  isTrivialGreetingExploration,
  parseExplorationSummaryAIOutput,
} from './flow-summaries';
import {
  buildExplorationRoundRecord,
  distillAssistantGist,
} from './exploration-round-record';

describe('Apple-style summary UX', () => {
  it('short-circuits trivial hello with distilled Hero, not assistant paste', () => {
    expect(isTrivialGreetingExploration('hello', [{
      timestamp: 1,
      type: 'response',
      label: 'Hello! What can I help you with?',
    }])).toBe(true);

    const result = buildTrivialGreetingSummaryResult('hello', [{
      timestamp: 1,
      type: 'response',
      label: 'Hello! What can I help you with?',
    }]);
    expect(result.displaySummary).toMatch(/就绪|Ready/);
    expect(result.displaySummary).not.toContain('Hello! What can I help');
    expect(result.displaySummary).not.toContain('格式异常');
    expect(result.persist?.should_persist).toBe(false);
    expect(result.persist?.reason).toBe('skip');
    expect(result.persist?.solution_detail).toContain('Hello');
    expect(result.flowchart?.dropFromChart).toBe(true);
  });

  it('parse failure distills gist instead of raw assistant reply as Hero', () => {
    const raw = '{"persist":{"should_persist":false,"type":"none","confidence":1}}';
    const result = parseExplorationSummaryAIOutput('fix the test', [{
      timestamp: 1,
      type: 'response',
      label: 'All tests are green now.',
    }], raw);
    expect(result.displaySummary).toBe('All tests are green now');
    expect(result.displaySummary).not.toContain('你提出');
    expect(result.persist?.solution_detail).toContain('green');
    expect(result.validationError).toBe('missing_summary');
  });

  it('buildExplorationRoundRecord prefers gist over archival template', () => {
    expect(distillAssistantGist('Done — all green.\nMore detail.')).toBe('Done — all green');
    const record = buildExplorationRoundRecord('fix tests', [{
      timestamp: 1,
      type: 'response',
      label: 'Done — all green.',
    }]);
    expect(record).toBe('Done — all green');
  });
});
