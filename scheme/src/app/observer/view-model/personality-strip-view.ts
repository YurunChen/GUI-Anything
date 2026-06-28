import type { CodingPersona } from '../../../data/protocol/evolution-types';

export type PersonalityRarity = NonNullable<CodingPersona['rarity']>;

export interface PersonalityStripInfo {
  name: string;
  rarity?: PersonalityRarity;
  intro?: string;
  catchphrase?: string;
  devStyle?: string;
}

export function buildPersonalityStripInfo(persona?: CodingPersona | null): PersonalityStripInfo | null {
  if (!persona) return null;

  const name = (persona.cnName || persona.title || '').trim();
  if (!name) return null;

  const intro = persona.intro?.trim() || undefined;
  const catchphrase = persona.catchphrase?.trim() || undefined;
  const devStyle = persona.devStyle?.trim() || undefined;

  return {
    name,
    rarity: persona.rarity,
    intro,
    catchphrase,
    devStyle,
  };
}
