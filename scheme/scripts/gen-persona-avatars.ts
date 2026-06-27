/**
 * Batch-generate persona avatars with gpt-image-2.
 *
 *   OPENAI_API_KEY=sk-... bun run scripts/gen-persona-avatars.ts
 *
 * Flags:
 *   --dry-run        print each prompt, generate nothing
 *   --force          regenerate even if the avatar already exists
 *   --only <CODE>    only this archetype (repeatable), e.g. --only ARCH --only NIGHT
 *
 * Output: src/export/evolution/persona-avatars/<CODE>.webp (one consistent clay style).
 * Idempotent: existing files are skipped unless --force. Failures are per-item; the
 * run continues so a transient error never blocks the rest.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { ARCHETYPES, EGGS, AVATAR_BASE_PROMPT } from '../src/services/evolution/persona-archetypes';
import { PERSONA_AVATAR_DIR } from '../src/export/evolution/persona-avatar';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const MODEL = 'gpt-image-2';

interface Item {
  code: string;
  imgPrompt: string;
}

function parseArgs(argv: string[]) {
  const only = new Set<string>();
  let dryRun = false;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--force') force = true;
    else if (a === '--only') {
      const v = argv[++i];
      if (v) only.add(v.toUpperCase());
    }
  }
  return { only, dryRun, force };
}

async function generate(prompt: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: '1024x1024',
      n: 1,
      output_format: 'webp',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const entry = json.data?.[0];
  if (entry?.b64_json) return Buffer.from(entry.b64_json, 'base64');
  if (entry?.url) {
    const img = await fetch(entry.url);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error('no image in response');
}

async function main() {
  const { only, dryRun, force } = parseArgs(process.argv.slice(2));
  const items: Item[] = [
    ...ARCHETYPES.map((a) => ({ code: a.code, imgPrompt: a.imgPrompt })),
    ...EGGS.map((e) => ({ code: e.code, imgPrompt: e.imgPrompt })),
  ].filter((it) => only.size === 0 || only.has(it.code.toUpperCase()));

  fs.mkdirSync(PERSONA_AVATAR_DIR, { recursive: true });

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!dryRun && !apiKey) {
    console.error('✗ OPENAI_API_KEY is not set. Use --dry-run to preview prompts.');
    process.exit(1);
  }

  let made = 0;
  let skipped = 0;
  let failed = 0;
  for (const it of items) {
    const target = path.join(PERSONA_AVATAR_DIR, `${it.code}.webp`);
    const prompt = AVATAR_BASE_PROMPT + it.imgPrompt;

    if (dryRun) {
      console.log(`\n── ${it.code} ──\n${prompt}`);
      continue;
    }
    if (fs.existsSync(target) && !force) {
      console.log(`• ${it.code}: exists, skip (use --force to regenerate)`);
      skipped++;
      continue;
    }
    try {
      process.stdout.write(`→ ${it.code}: generating… `);
      const buf = await generate(prompt, apiKey);
      fs.writeFileSync(target, buf);
      console.log(`saved ${(buf.length / 1024).toFixed(0)}KB`);
      made++;
    } catch (e) {
      console.log(`FAILED — ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  if (dryRun) {
    console.log(`\n(dry run) ${items.length} prompts shown.`);
  } else {
    console.log(`\nDone: ${made} generated, ${skipped} skipped, ${failed} failed → ${PERSONA_AVATAR_DIR}`);
    if (failed) process.exitCode = 1;
  }
}

void main();
