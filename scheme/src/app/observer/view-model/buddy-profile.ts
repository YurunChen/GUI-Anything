import type { ObserverLocale } from '../../../constants/observer-locale';
import {
  SESSION_INTENT_GREETING,
  normalizeSessionIntentKey,
  type SessionIntentTaskKey,
} from '../../../constants/session-intent-keys';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

export const BUDDY_TYPE_CODES = ['ARC', 'VIB', 'DBG', 'SHIP', 'CUR', 'EXP'] as const;

export type BuddyTypeCode = (typeof BUDDY_TYPE_CODES)[number];

export interface BuddyProfile {
  code: BuddyTypeCode;
  name: string;
  devStyle: string;
  line: string;
  intentKey: string;
}

const INTENT_BUDDY_CODES: Record<SessionIntentTaskKey | typeof SESSION_INTENT_GREETING, BuddyTypeCode | null> = {
  [SESSION_INTENT_GREETING]: null,
  explore: 'EXP',
  project_design: 'ARC',
  implement: 'SHIP',
  refactor: 'VIB',
  debug: 'DBG',
  test_verify: 'SHIP',
  devops: 'EXP',
  research: 'CUR',
  general: null,
};

export function resolveBuddyProfileFromIntent(
  intentKey: string | null | undefined,
  locale: ObserverLocale = 'en',
): BuddyProfile | null {
  const normalizedIntentKey = normalizeSessionIntentKey(intentKey ?? '');
  const code = INTENT_BUDDY_CODES[normalizedIntentKey] ?? null;
  if (!code) return null;

  const display = getObserverMessages(locale).buddyProfiles[code];
  return {
    code,
    name: display.name,
    devStyle: display.devStyle,
    line: display.line,
    intentKey: normalizedIntentKey,
  };
}

export function resolveBuddyPromptLocale(prompt?: string): ObserverLocale {
  return /[\u3400-\u9fff]/u.test(prompt ?? '') ? 'zh-Hans' : 'en';
}
