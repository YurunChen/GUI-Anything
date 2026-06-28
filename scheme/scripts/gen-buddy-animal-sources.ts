/**
 * Batch-generate Buddy animal source images with gpt-image-2.
 *
 *   OPENAI_API_KEY=sk-... bun run gen:buddy:images
 *   bun run gen:buddy:images -- --dry-run
 *   bun run gen:buddy:images -- --only owl --only DBG
 *
 * Output defaults to ../assets/buddy/source/<animal>.webp.
 * Chafa review:
 *   bun run export:buddy:chafa -- --slots --image-dir=../assets/buddy/source
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  BUDDY_ANIMAL_IMAGE_DIR,
  BUDDY_ANIMAL_SOURCES,
  assertBuddyAnimalSourcesCoverCodes,
  formatBuddyAnimalImagePrompt,
  resolveBuddyAnimalSource,
  type BuddyAnimalSource,
} from './buddy-animal-sources';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const MODEL = 'gpt-image-2';

interface GenerateBuddyImageArgs {
  dryRun: boolean;
  force: boolean;
  only: ReadonlySet<string>;
  outputDir: string;
}

function parseArgs(argv: readonly string[]): GenerateBuddyImageArgs {
  const only = new Set<string>();
  let dryRun = false;
  let force = false;
  let outputDir = BUDDY_ANIMAL_IMAGE_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--only') {
      const value = argv[index + 1];
      index += 1;
      if (value) only.add(value.toLowerCase());
    } else if (arg === '--out-dir') {
      const value = argv[index + 1];
      index += 1;
      if (value) outputDir = value;
    }
  }

  return { dryRun, force, only, outputDir };
}

async function generateBuddyAnimalImage(prompt: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: '1024x1024',
      n: 1,
      output_format: 'webp',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${redactApiErrorBody(body).slice(0, 300)}`);
  }

  const json = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const image = json.data?.[0];
  if (image?.b64_json) return Buffer.from(image.b64_json, 'base64');
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error('no image in response');
}

export function redactApiErrorBody(body: string): string {
  return body.replace(/sk-[A-Za-z0-9_*.-]*[A-Za-z0-9_*-]/g, 'sk-[redacted]');
}

function selectSources(only: ReadonlySet<string>): readonly BuddyAnimalSource[] {
  if (only.size === 0) return BUDDY_ANIMAL_SOURCES;

  return Array.from(only).flatMap((value) => {
    const source = resolveBuddyAnimalSource(value);
    return source ? [source] : [];
  });
}

async function main(): Promise<void> {
  assertBuddyAnimalSourcesCoverCodes();

  const args = parseArgs(process.argv.slice(2));
  const sources = selectSources(args.only);
  const targetDir = path.resolve(process.cwd(), args.outputDir);

  if (sources.length === 0) {
    console.error('No matching Buddy animal sources. Use --only owl or --only DBG.');
    process.exit(1);
  }

  if (args.dryRun) {
    for (const source of sources) {
      console.log(`\n-- ${source.code} / ${source.kind} --\n${formatBuddyAnimalImagePrompt(source)}`);
    }
    console.log(`\n(dry run) ${sources.length} Buddy image prompts shown.`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set. Use --dry-run to preview prompts.');
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const source of sources) {
    const target = path.join(targetDir, source.filename);
    if (fs.existsSync(target) && !args.force) {
      console.log(`${source.code}/${source.kind}: exists, skip (use --force to regenerate)`);
      skipped += 1;
      continue;
    }

    try {
      process.stdout.write(`${source.code}/${source.kind}: generating... `);
      const buffer = await generateBuddyAnimalImage(formatBuddyAnimalImagePrompt(source), apiKey);
      fs.writeFileSync(target, buffer);
      console.log(`saved ${(buffer.length / 1024).toFixed(0)}KB`);
      generated += 1;
    } catch (error) {
      console.log(`FAILED - ${error instanceof Error ? error.message : String(error)}`);
      failed += 1;
    }
  }

  console.log(`Done: ${generated} generated, ${skipped} skipped, ${failed} failed -> ${targetDir}`);
  if (failed > 0) process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}
