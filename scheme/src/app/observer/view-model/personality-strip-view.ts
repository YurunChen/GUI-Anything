import type { CodingPersona } from '../../../data/protocol/evolution-types';
import type { ObserverLocale } from '../../../constants/observer-locale';
import { pickLocalizedText } from '../../../constants/observer-locale';

export type PersonalityRarity = NonNullable<CodingPersona['rarity']>;

export interface PersonalityStripInfo {
  name: string;
  rarity?: PersonalityRarity;
  intro?: string;
  catchphrase?: string;
  devStyle?: string;
}

export function buildPersonalityStripInfo(
  persona?: CodingPersona | null,
  locale: ObserverLocale = 'zh-Hans',
): PersonalityStripInfo | null {
  if (!persona) return null;

  const name = pickLocalizedText(persona.name, locale).trim();
  if (!name) return null;

  const intro = pickLocalizedText(persona.intro, locale).trim() || undefined;
  const catchphrase = pickLocalizedText(persona.catchphrase, locale).trim() || undefined;
  const devStyle = pickLocalizedText(persona.devStyle, locale).trim() || undefined;

  return {
    name,
    rarity: persona.rarity,
    intro,
    catchphrase,
    devStyle,
  };
}
