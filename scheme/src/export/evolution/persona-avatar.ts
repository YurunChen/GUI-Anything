/**
 * Persona avatar resolution. Avatars are generated offline by
 * scripts/gen-persona-avatars.ts (gpt-image-2) into ./persona-avatars/<CODE>.webp.
 *
 * - Live server: avatars are served at /persona/<CODE>.webp (see server.ts).
 * - Static export: the avatar is inlined as a data URI so the file stays offline
 *   and self-contained.
 * Missing avatars resolve to undefined; the client falls back to an icon.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PERSONA_AVATAR_DIR = path.join(HERE, 'persona-avatars');

function safeCode(code: string): string | null {
  return /^[A-Za-z0-9_-]{1,16}$/.test(code) ? code : null;
}

export function personaAvatarFile(code: string): string | null {
  const c = safeCode(code);
  if (!c) return null;
  const p = path.join(PERSONA_AVATAR_DIR, `${c}.webp`);
  return fs.existsSync(p) ? p : null;
}

export function personaAvatarExists(code: string): boolean {
  return personaAvatarFile(code) !== null;
}

/** Read the avatar as a data URI for inlining into a static export. Undefined if absent. */
export function personaAvatarDataUri(code: string): string | undefined {
  const file = personaAvatarFile(code);
  if (!file) return undefined;
  try {
    const b64 = fs.readFileSync(file).toString('base64');
    return `data:image/webp;base64,${b64}`;
  } catch {
    return undefined;
  }
}
