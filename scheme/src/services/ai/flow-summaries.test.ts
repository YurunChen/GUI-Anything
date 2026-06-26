import { afterEach, describe, expect, it } from 'bun:test';
import { resolveSummaryModel } from './flow-summaries';

const ORIGINAL_FLOW_SUMMARY_MODEL = process.env.FLOW_SUMMARY_MODEL;
const ORIGINAL_CLAUDE_MODEL = process.env.CLAUDE_MODEL;

function restoreEnv(key: 'FLOW_SUMMARY_MODEL' | 'CLAUDE_MODEL', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FLOW_SUMMARY_MODEL', ORIGINAL_FLOW_SUMMARY_MODEL);
  restoreEnv('CLAUDE_MODEL', ORIGINAL_CLAUDE_MODEL);
});

describe('resolveSummaryModel', () => {
  it('uses explicit model before env defaults', () => {
    process.env.FLOW_SUMMARY_MODEL = 'haiku';
    process.env.CLAUDE_MODEL = 'sonnet';

    expect(resolveSummaryModel('opus')).toBe('opus');
  });

  it('prefers FLOW_SUMMARY_MODEL over CLAUDE_MODEL', () => {
    process.env.FLOW_SUMMARY_MODEL = 'opus';
    process.env.CLAUDE_MODEL = 'sonnet';

    expect(resolveSummaryModel()).toBe('opus');
  });

  it('falls back to CLAUDE_MODEL and then the Claude CLI default', () => {
    delete process.env.FLOW_SUMMARY_MODEL;
    process.env.CLAUDE_MODEL = 'haiku';

    expect(resolveSummaryModel()).toBe('haiku');

    delete process.env.CLAUDE_MODEL;
    expect(resolveSummaryModel()).toBeUndefined();
  });
});
