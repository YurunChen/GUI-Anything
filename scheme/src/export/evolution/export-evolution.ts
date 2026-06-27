/**
 * Project Evolution HTML — main export engine.
 * raw intent history (data) → evolution view-model (services) → self-contained HTML.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { defaultProjectEvolutionRepository } from '../../data/wiki/project-evolution-repository';
import { resolveWorkspaceRootForCache } from '../../data/session/workspace-root';
import type { EvolutionExport, ProjectEvolutionRaw } from '../../data/protocol/evolution-types';
import { buildEvolutionExport, type EraSynthesizer } from '../../services/evolution/evolution-service';
import { ruleBasedPersona } from '../../services/evolution/persona-score';
import type { TransitionSynthesizer } from '../../services/ai/evolution-transitions';
import type { PersonaSynthesizer } from '../../services/ai/coding-persona';
import { sanitizePath, redactSecrets } from '../shared/sanitize';
import { generateEvolutionHtml } from './template';
import { generateEmptyEvolutionHtml } from './empty-state';
import { personaAvatarExists, personaAvatarDataUri } from './persona-avatar';
import type { ExportEvolutionOptions } from './types';

/**
 * Write via a unique temp file + atomic rename, so a concurrent reader (the open
 * page polling the sidecar) never observes a half-written file, and concurrent
 * watchers — one per co-developing session — never tear each other's writes.
 */
function writeFileAtomic(targetPath: string, content: string): void {
  const tmp = `${targetPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, targetPath);
}

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
      retrievals: session.retrievals.map((r) => ({
        ...r,
        request: clean(r.request),
        excerpt: clean(r.excerpt),
        tags: r.tags.map(clean),
      })),
      writes: session.writes.map((w) => ({
        ...w,
        targetPath: w.targetPath ? sanitizePath(w.targetPath) : w.targetPath,
        question: w.question ? clean(w.question) : w.question,
      })),
    })),
  };
}

export interface BuildEvolutionModelOptions {
  scope?: 'project' | 'session';
  sessionId?: string;
  noAi?: boolean;
  theme?: string;
  workspaceRoot?: string;
  /** Explicit wiki root — the long-lived server resolves this once and passes it down. */
  wikiRoot?: string;
  /** Mark the model as served by the live WS server (client opens a socket instead of polling). */
  liveServer?: boolean;
}

/**
 * Build the full evolution view-model (the in-memory model the server holds and
 * the static export renders). Returns null for an empty project (no milestones yet).
 */
export async function buildEvolutionModel(
  options: BuildEvolutionModelOptions = {},
): Promise<EvolutionExport | null> {
  const repo = defaultProjectEvolutionRepository(options.wikiRoot ? { wikiRoot: options.wikiRoot } : undefined);

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
    if (raw.sessions.length === 0) return null;
  }

  const eraSynthesizer: EraSynthesizer | undefined = options.noAi
    ? undefined
    : await loadAiSynthesizer();

  const data = await buildEvolutionExport({
    raw: redactRaw(raw),
    theme: options.theme || process.env.FLOW_THEME,
    eraSynthesizer,
  });

  // P4: AI intent-transition narrative (best-effort; omitted on failure or --no-ai).
  if (!options.noAi) {
    const synthesizeTransitions = await loadTransitionSynthesizer();
    if (synthesizeTransitions) {
      const narrative = await synthesizeTransitions(data.project.nodes);
      if (narrative) data.narrative = narrative;
    }
  }

  // P5: coding persona — deterministic archetype always; AI only enriches the reading.
  if (data.project.nodes.length > 0) {
    data.persona = ruleBasedPersona(data.project.nodes, data.sessions.length);
    if (!options.noAi) {
      const synthesizePersona = await loadPersonaSynthesizer();
      if (synthesizePersona) {
        const persona = await synthesizePersona(data.project.nodes, data.sessions.length);
        if (persona) data.persona = persona;
      }
    }
    // Avatar: server serves a path; static export inlines a data URI. Missing → icon fallback.
    const code = data.persona?.archetypeCode;
    if (code) {
      if (options.liveServer) {
        if (personaAvatarExists(code)) data.persona!.avatar = `/persona/${code}.webp`;
      } else {
        const uri = personaAvatarDataUri(code);
        if (uri) data.persona!.avatar = uri;
      }
    }
  }

  // Content-addressed token. Hash only the meaningful timeline, dropping per-run
  // wall-clock fields (generatedAt) so the server only pushes when content truly changes.
  const { generatedAt: _ga, ...stableForHash } = data;
  data.contentVersion = createHash('sha1').update(JSON.stringify(stableForHash)).digest('hex').slice(0, 16);

  // Provenance footer (work-canvas non-negotiable): who/what/when built this.
  data.generatedBy = {
    agent: 'GUI-Anything · Flow Observer',
    model: data.aiUsed ? (process.env.FLOW_SUMMARY_MODEL || process.env.CLAUDE_MODEL || 'sonnet') : undefined,
    builtAt: Date.now(),
  };

  if (options.liveServer) data.liveServer = true;

  return data;
}

export async function exportEvolutionToHtml(options: ExportEvolutionOptions = {}): Promise<string> {
  const data = await buildEvolutionModel(options);

  // Empty project (no milestones yet): write a friendly placeholder so there is
  // always something to open. Static export stays fully self-contained/offline.
  if (data === null) {
    const html = generateEmptyEvolutionHtml({
      workspaceRoot: options.workspaceRoot ?? resolveWorkspaceRootForCache(),
    });
    if (options.outputPath) {
      const dir = path.dirname(options.outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      writeFileAtomic(options.outputPath, html);
      console.error(`📭 No milestones yet — wrote evolution placeholder: ${options.outputPath}`);
      return options.outputPath;
    }
    process.stdout.write(html);
    return 'stdout';
  }

  const html = generateEvolutionHtml(data);

  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeFileAtomic(options.outputPath, html);
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

/** Lazy-load the AI transition synthesizer; returns undefined if unavailable. */
async function loadTransitionSynthesizer(): Promise<TransitionSynthesizer | undefined> {
  try {
    const mod = await import('../../services/ai/evolution-transitions');
    return mod.synthesizeTransitions;
  } catch {
    return undefined;
  }
}

/** Lazy-load the AI persona synthesizer; returns undefined if unavailable. */
async function loadPersonaSynthesizer(): Promise<PersonaSynthesizer | undefined> {
  try {
    const mod = await import('../../services/ai/coding-persona');
    return mod.synthesizePersona;
  } catch {
    return undefined;
  }
}
