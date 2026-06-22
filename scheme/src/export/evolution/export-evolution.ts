/**
 * Project Evolution HTML — main export engine.
 * raw intent history (data) → evolution view-model (services) → self-contained HTML.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { defaultProjectEvolutionRepository } from '../../data/wiki/project-evolution-repository';
import type { ProjectEvolutionRaw } from '../../data/protocol/evolution-types';
import { buildEvolutionExport, type EraSynthesizer } from '../../services/evolution/evolution-service';
import { sanitizePath, redactSecrets } from '../shared/sanitize';
import { generateEvolutionHtml } from './template';
import type { ExportEvolutionOptions } from './types';

function redactRaw(raw: ProjectEvolutionRaw): ProjectEvolutionRaw {
  const clean = (s: string) => sanitizePath(redactSecrets(s));
  return {
    workspaceRoot: sanitizePath(raw.workspaceRoot),
    sessions: raw.sessions.map((session) => ({
      ...session,
      title: clean(session.title),
      revisions: session.revisions.map((rev) => ({
        ...rev,
        nodeTitle: clean(rev.nodeTitle),
        note: rev.note ? clean(rev.note) : rev.note,
      })),
      summaries: Object.fromEntries(
        Object.entries(session.summaries).map(([k, v]) => [k, clean(v)]),
      ),
    })),
  };
}

export async function exportEvolutionToHtml(options: ExportEvolutionOptions = {}): Promise<string> {
  const repo = defaultProjectEvolutionRepository();

  // Single-session scope: lift just that session into a one-session project.
  let raw: ProjectEvolutionRaw;
  if (options.scope === 'session' || options.sessionId) {
    if (!options.sessionId) {
      throw new Error('scope=session requires --session-id <id>');
    }
    const single = repo.loadSessionEvolution(options.sessionId);
    if (!single) {
      throw new Error(`No evolution data for session ${options.sessionId} (missing bundle or empty intent history).`);
    }
    raw = { workspaceRoot: single.workspaceRoot, sessions: [single] };
  } else {
    raw = repo.loadProjectEvolution({ workspaceRoot: options.workspaceRoot });
    if (raw.sessions.length === 0) {
      throw new Error('No project evolution data found. Run `ga flow` to build intent history first.');
    }
  }

  const eraSynthesizer: EraSynthesizer | undefined = options.noAi
    ? undefined
    : await loadAiSynthesizer();

  const data = await buildEvolutionExport({
    raw: redactRaw(raw),
    theme: options.theme || process.env.FLOW_THEME,
    eraSynthesizer,
  });

  const html = generateEvolutionHtml(data);

  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.outputPath, html, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    console.error(`✅ Exported evolution HTML: ${options.outputPath} (${(size / 1024).toFixed(1)}KB, ai=${data.aiUsed})`);
    return options.outputPath;
  }
  process.stdout.write(html);
  return 'stdout';
}

/** Lazy-load the AI era synthesizer; returns undefined if the module is unavailable. */
async function loadAiSynthesizer(): Promise<EraSynthesizer | undefined> {
  try {
    const mod = await import('../../services/ai/evolution-abstract');
    return mod.synthesizeEras;
  } catch {
    return undefined;
  }
}
