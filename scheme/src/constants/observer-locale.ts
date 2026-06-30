/** Observer/display locale — shared by i18n, view-model, and exports. */
export type ObserverLocale = 'en' | 'zh-Hans';
export type LocalizedText = Record<ObserverLocale, string>;

export const DEFAULT_OBSERVER_LOCALE: ObserverLocale = 'en';

export function normalizeObserverLocale(raw?: string | null): ObserverLocale {
  const value = (raw || DEFAULT_OBSERVER_LOCALE).trim().toLowerCase();
  if (value.startsWith('zh')) return 'zh-Hans';
  return 'en';
}

export function resolveObserverLocale(raw?: string | null): ObserverLocale {
  return normalizeObserverLocale(raw ?? process.env.FLOW_LOCALE ?? process.env.LANG);
}

export function observerHtmlLang(locale: ObserverLocale = resolveObserverLocale()): 'en' | 'zh-CN' {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en';
}

export function isChineseObserverLocale(locale: ObserverLocale = resolveObserverLocale()): boolean {
  return locale === 'zh-Hans';
}

export function localizedText(en: string, zhHans: string): LocalizedText {
  return { en, 'zh-Hans': zhHans };
}

export function pickLocalizedText(text: LocalizedText, locale: ObserverLocale = resolveObserverLocale()): string {
  return text[locale];
}
