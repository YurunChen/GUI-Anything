import { describe, expect, it } from 'bun:test';

import { SESSION_INTENT_KEYS } from '../src/constants/session-intent-keys';
import { resolveBuddyProfileFromIntent } from '../src/app/observer/view-model/buddy-profile';
import { INTENT_BUDDY_PREVIEW_ITEMS } from './buddy-preview-items';

describe('INTENT_BUDDY_PREVIEW_ITEMS', () => {
  it('tracks every visible task intent in catalog order', () => {
    const visibleIntentKeys = SESSION_INTENT_KEYS
      .map((item) => item.key)
      .filter((key) => key !== 'general');

    expect(INTENT_BUDDY_PREVIEW_ITEMS.map((item) => item.intentKey)).toEqual(visibleIntentKeys);
    for (const item of INTENT_BUDDY_PREVIEW_ITEMS) {
      expect(resolveBuddyProfileFromIntent(item.intentKey, 'en')).toBeTruthy();
      expect(item.badge.length).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });
});
