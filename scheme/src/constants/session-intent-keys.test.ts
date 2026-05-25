import { describe, expect, it } from 'bun:test';
import {
  normalizeSessionIntentKey,
  SESSION_INTENT_GREETING,
  isSessionIntentTaskKey,
  shouldCurateWikiForIntent,
  DEFAULT_WIKI_CURATE_INTENT_KEYS,
} from './session-intent-keys';

describe('normalizeSessionIntentKey', () => {
  it('preserves greeting', () => {
    expect(normalizeSessionIntentKey('greeting')).toBe(SESSION_INTENT_GREETING);
  });

  it('maps aliases to catalog keys', () => {
    expect(normalizeSessionIntentKey('wiki_intent_curator')).toBe('project_design');
    expect(normalizeSessionIntentKey('project_analysis')).toBe('project_design');
  });

  it('falls back unknown keys to general', () => {
    expect(normalizeSessionIntentKey('random_topic_xyz')).toBe('general');
  });

  it('recognizes catalog keys', () => {
    expect(isSessionIntentTaskKey('project_design')).toBe(true);
    expect(isSessionIntentTaskKey('explore')).toBe(true);
  });
});

describe('shouldCurateWikiForIntent', () => {
  it('allows project_design by default', () => {
    expect(shouldCurateWikiForIntent('project_design')).toBe(true);
  });

  it('skips explore and test_verify by default', () => {
    expect(shouldCurateWikiForIntent('explore')).toBe(false);
    expect(shouldCurateWikiForIntent('test_verify')).toBe(false);
    expect(shouldCurateWikiForIntent('greeting')).toBe(false);
  });

  it('default list matches wikiCurateOnClose flags', () => {
    expect(DEFAULT_WIKI_CURATE_INTENT_KEYS).toContain('project_design');
    expect(DEFAULT_WIKI_CURATE_INTENT_KEYS).not.toContain('explore');
  });
});
