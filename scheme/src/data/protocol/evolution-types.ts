/**
 * Project Evolution — cross-layer shapes for the "项目功能演进史" HTML export.
 *
 * Source of truth: each session bundle's `session.intent.history` (a chronological
 * list of intent title revisions). This module defines both the raw extraction
 * shapes (data layer output) and the final domain view-model (services → export).
 */

import type { TitleDelta } from './observer-protocol';

export type { TitleDelta } from './observer-protocol';

// ─── Icon vocabulary (shared by AI synthesis, rule heuristic, and HTML rendering) ───

/**
 * The closed set of semantic icon names a node/era may carry. The SVG markup for
 * each lives in the export layer (`export/evolution/icons.ts`); this list is the
 * contract the AI synthesizer and the keyword heuristic must choose from so the
 * inline (offline) SVG catalog can always resolve them.
 */
export const EVOLUTION_ICON_NAMES = [
  'eye', 'book', 'bar-chart', 'git-branch', 'wrench', 'rocket', 'search',
  'code', 'database', 'layout', 'terminal', 'bug', 'sparkles', 'flag',
  'check-circle', 'alert-triangle', 'refresh', 'arrow-right', 'file-text',
  'folder', 'zap', 'shield', 'package', 'compass',
] as const;

export type EvolutionIcon = (typeof EVOLUTION_ICON_NAMES)[number];

export function isEvolutionIcon(value: unknown): value is EvolutionIcon {
  return typeof value === 'string' && (EVOLUTION_ICON_NAMES as readonly string[]).includes(value);
}

// ─── Raw extraction (produced by data/wiki/project-evolution-repository.ts) ───

/** One intent title revision lifted from a bundle's intent history. */
export interface EvolutionRevision {
  explorationId: string;
  at: number;
  intentKey: string;
  nodeTitle: string;
  delta: TitleDelta;
  note?: string;
}

/** Raw per-session evolution lifted from a single bundle. */
export interface SessionEvolutionRaw {
  sessionId: string;
  workspaceRoot: string;
  startedAt: number;
  updatedAt: number;
  title: string;
  revisions: EvolutionRevision[];
  /** explorationId → summary text, for combinedSummary fallback. */
  summaries: Record<string, string>;
}

/** Raw project-wide evolution: all matching sessions sorted by startedAt asc. */
export interface ProjectEvolutionRaw {
  workspaceRoot: string;
  sessions: SessionEvolutionRaw[];
}

// ─── Domain view-model (produced by services/evolution/evolution-service.ts) ───

/** A refine/continue step folded under a milestone node. */
export interface EvolutionSubStep {
  title: string;
  note?: string;
  at: number;
  delta: TitleDelta;
}

/** Right-rail milestone node (one per pivot). */
export interface EvolutionNode {
  id: string;
  eraId: string;
  sessionId: string;
  title: string;
  note: string;
  at: number;
  delta: TitleDelta;
  /** Semantic icon name (from EVOLUTION_ICON_NAMES) for "what this milestone is about". */
  icon?: EvolutionIcon;
  children: EvolutionSubStep[];
}

/** Left-rail era (a synthesized capability stage). */
export interface EvolutionEra {
  id: string;
  order: number;
  title: string;
  abstract: string;
  /** Semantic icon name (from EVOLUTION_ICON_NAMES) representing the era's theme. */
  icon?: EvolutionIcon;
  /** Capability keywords introduced at this era — drives left-rail enter animation. */
  sceneAdds: string[];
  nodeIds: string[];
}

/** Single-session drill-down view. */
export interface SessionEvolution {
  sessionId: string;
  title: string;
  startedAt: number;
  eras: EvolutionEra[];
  nodes: EvolutionNode[];
}

/** Project overview view. */
export interface ProjectEvolution {
  workspaceRoot: string;
  eras: EvolutionEra[];
  nodes: EvolutionNode[];
}

/** Top-level payload embedded into the self-contained HTML. */
export interface EvolutionExport {
  version: '1.0';
  generatedAt: number;
  aiUsed: boolean;
  project: ProjectEvolution;
  sessions: SessionEvolution[];
  theme?: string;
}
