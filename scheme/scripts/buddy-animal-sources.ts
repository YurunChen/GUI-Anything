import { BUDDY_TYPE_CODES, type BuddyTypeCode } from '../src/app/observer/view-model/buddy-profile';

export type BuddyAnimalKind = 'dog' | 'owl' | 'swallow' | 'butterfly' | 'fox' | 'squirrel';

export interface BuddyAnimalSource {
  code: BuddyTypeCode;
  kind: BuddyAnimalKind;
  filename: string;
  accent: string;
  promptSubject: string;
}

export const BUDDY_ANIMAL_IMAGE_DIR = '../assets/buddy/source';

export const BUDDY_IMAGE_BASE_PROMPT =
  'Small terminal buddy animal icon for a developer TUI. ' +
  'Use a clean centered animal bust, readable silhouette, front-facing or clear three-quarter view, ' +
  'high contrast, simple dark transparent-looking background, crisp edges, no text, no UI, no logo, ' +
  'square composition, charming but not childish. The animal must remain recognizable after conversion ' +
  'to a 20 columns by 3 rows terminal glyph preview. Subject: ';

export const BUDDY_ANIMAL_SOURCES: readonly BuddyAnimalSource[] = [
  {
    code: 'ARC',
    kind: 'owl',
    filename: 'owl.webp',
    accent: 'cool cyan and steel blue',
    promptSubject: 'a thoughtful owl with sharp ear tufts and a tiny blueprint-shaped chest mark',
  },
  {
    code: 'VIB',
    kind: 'butterfly',
    filename: 'butterfly.webp',
    accent: 'violet wings with cyan highlights',
    promptSubject: 'a symmetrical butterfly with strong wing outline and a slim bright body',
  },
  {
    code: 'DBG',
    kind: 'fox',
    filename: 'fox.webp',
    accent: 'warm orange with gold eyes',
    promptSubject: 'an alert fox head with pointed ears, narrow eyes, and a clean angular snout',
  },
  {
    code: 'SHIP',
    kind: 'swallow',
    filename: 'swallow.webp',
    accent: 'sea green and pale blue',
    promptSubject: 'a swift sea swallow with spread wings and a small forward beak',
  },
  {
    code: 'CUR',
    kind: 'squirrel',
    filename: 'squirrel.webp',
    accent: 'golden tail with teal detail',
    promptSubject: 'a clever squirrel with curled tail and a tiny square cache marker on its chest',
  },
  {
    code: 'EXP',
    kind: 'dog',
    filename: 'dog.webp',
    accent: 'soft blue with cyan trail marks',
    promptSubject: 'a curious trail dog with floppy ears and a clear search-mark collar',
  },
] as const;

export function formatBuddyAnimalImagePrompt(source: BuddyAnimalSource): string {
  return `${BUDDY_IMAGE_BASE_PROMPT}${source.promptSubject}. Palette: ${source.accent}.`;
}

export function resolveBuddyAnimalSource(kindOrCode: string): BuddyAnimalSource | undefined {
  const normalized = kindOrCode.toLowerCase();
  return BUDDY_ANIMAL_SOURCES.find(
    (source) => source.kind === normalized || source.code.toLowerCase() === normalized,
  );
}

export function assertBuddyAnimalSourcesCoverCodes(): void {
  const sourceCodes = BUDDY_ANIMAL_SOURCES.map((source) => source.code);
  const missing = BUDDY_TYPE_CODES.filter((code) => !sourceCodes.includes(code));
  if (missing.length > 0) {
    throw new Error(`missing buddy animal image sources for ${missing.join(', ')}`);
  }
}
