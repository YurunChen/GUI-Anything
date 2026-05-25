import {
  isGreetingIntentKey,
  sessionIntentDisplayLabel,
} from '../../../constants/session-intent-keys';
import type { ObserverLocale } from '../../../constants/observer-locale';

export interface IntentChromeDisplay {
  badge: string | null;
  title: string;
  isIdle: boolean;
}

/** Shared intent badge + title chrome for status bar and flow graph nodes. */
export function resolveIntentChromeDisplay(input: {
  intentKey: string;
  title: string;
  locale: ObserverLocale;
  idleTitle?: string;
}): IntentChromeDisplay {
  const isIdle = isGreetingIntentKey(input.intentKey);
  const badge = sessionIntentDisplayLabel(input.intentKey, input.locale);
  const title = input.title.trim() || input.idleTitle || '';
  return { badge, title, isIdle };
}
