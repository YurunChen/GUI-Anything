import { describe, expect, it } from 'bun:test';
import {
  BUDDY_TYPE_CODES,
  resolveBuddyProfileFromIntent,
  resolveBuddyPromptLocale,
} from './buddy-profile';

describe('resolveBuddyProfileFromIntent', () => {
  it('maps intent keys to animal markers without reading prompt keywords', () => {
    expect(resolveBuddyProfileFromIntent('explore', 'zh-Hans')?.code).toBe('EXP');
    expect(resolveBuddyProfileFromIntent('project_design', 'zh-Hans')?.code).toBe('ARC');
    expect(resolveBuddyProfileFromIntent('implement', 'zh-Hans')?.code).toBe('SHIP');
    expect(resolveBuddyProfileFromIntent('debug', 'zh-Hans')?.code).toBe('DBG');
    expect(resolveBuddyProfileFromIntent('research', 'zh-Hans')?.code).toBe('CUR');
  });

  it('shares animals across related intents', () => {
    expect(resolveBuddyProfileFromIntent('refactor', 'zh-Hans')?.code).toBe('VIB');
    expect(resolveBuddyProfileFromIntent('test_verify', 'zh-Hans')?.code).toBe('SHIP');
    expect(resolveBuddyProfileFromIntent('devops', 'zh-Hans')?.code).toBe('EXP');
  });

  it('keeps every intent-bar animal reachable from at least one real task intent', () => {
    const reachableCodes = new Set(
      [
        'explore',
        'project_design',
        'implement',
        'refactor',
        'debug',
        'test_verify',
        'devops',
        'research',
      ].flatMap((intentKey) => {
        const profile = resolveBuddyProfileFromIntent(intentKey, 'zh-Hans');
        return profile ? [profile.code] : [];
      }),
    );

    expect(reachableCodes).toEqual(new Set(BUDDY_TYPE_CODES));
  });

  it('does not show an animal for idle or generic intent', () => {
    expect(resolveBuddyProfileFromIntent('greeting', 'zh-Hans')).toBeNull();
    expect(resolveBuddyProfileFromIntent('general', 'zh-Hans')).toBeNull();
    expect(resolveBuddyProfileFromIntent(undefined, 'zh-Hans')).toBeNull();
  });

  it('normalizes intent aliases before resolving the animal', () => {
    expect(resolveBuddyProfileFromIntent('project_analysis', 'zh-Hans')?.code).toBe('ARC');
    expect(resolveBuddyProfileFromIntent('fix', 'zh-Hans')?.code).toBe('DBG');
    expect(resolveBuddyProfileFromIntent('tooling', 'zh-Hans')?.code).toBe('EXP');
  });

  it('uses the latest request language only for localized animal copy', () => {
    expect(resolveBuddyPromptLocale('分析下项目代码')).toBe('zh-Hans');
    expect(resolveBuddyPromptLocale('review this architecture')).toBe('en');

    expect(resolveBuddyProfileFromIntent('project_design', 'zh-Hans')?.name).toBe('Luma 夜枭');
    expect(resolveBuddyProfileFromIntent('project_design', 'en')?.name).toBe('Luma Owl');
  });
});
