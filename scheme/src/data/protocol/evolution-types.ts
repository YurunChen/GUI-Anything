/**
 * Project Evolution — cross-layer shapes for the "项目功能演进史" HTML export.
 *
 * Source of truth: each session bundle's `session.intent.history` (a chronological
 * list of intent title revisions). This module defines both the raw extraction
 * shapes (data layer output) and the final domain view-model (services → export).
 */

import type { TitleDelta } from './observer-protocol';
import type { LocalizedText, ObserverLocale } from '../../constants/observer-locale';

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

/** Per-exploration behavioural metrics lifted from explorations[].meta + retrieval/write. */
export interface ExplorationMetricsRaw {
  toolCount: number;
  errorCount: number;
  interrupted: boolean;
  tokens?: number;
  files?: string[];
  durationMs?: number;
  retrieval: boolean;
  write: boolean;
}

/** A prior-knowledge retrieval lifted from one exploration's KNOWLEDGE card. */
export interface KnowledgeRetrievalRaw {
  explorationId: string;
  request: string;
  excerpt: string;
  tags: string[];
  score: number;
  type: string;
}

/** A wiki entry written/curated from one exploration. */
export interface KnowledgeWriteRaw {
  explorationId: string;
  targetId?: string;
  targetPath?: string;
  status: string;
  /** Curator persist reason, e.g. "knowledge_saved:C002" — carries the context key. */
  reason?: string;
  /** The exploration's question — human-readable label for what this knowledge is about. */
  question?: string;
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
  /** explorationId → behavioural metrics (P0). Absent keys ⇒ no reliable data. */
  metricsByExp: Record<string, ExplorationMetricsRaw>;
  /** Prior knowledge the session stood on (P3). */
  retrievals: KnowledgeRetrievalRaw[];
  /** Knowledge the session deposited back (P3). */
  writes: KnowledgeWriteRaw[];
}

/** Raw project-wide evolution: all matching sessions sorted by startedAt asc. */
export interface ProjectEvolutionRaw {
  workspaceRoot: string;
  sessions: SessionEvolutionRaw[];
}

// ─── Domain view-model (produced by services/evolution/evolution-service.ts) ───

/**
 * Aggregated behavioural metrics for a node / era / session / project.
 * Built only from reliable signals (explorations[].meta + history[].at + retrieval/write).
 */
export interface EvolutionMetrics {
  toolCount: number;
  errorCount: number;
  retrievals: number;
  writes: number;
  interrupted: number;
  /** Wall-clock span: node = next milestone at − this at; session/project = first→last at. */
  elapsedMs?: number;
  /** Σ tokens across explorations (P-extra). Absent ⇒ no reliable token data. */
  tokens?: number;
  /** Deduped file paths touched (P-extra). */
  files?: string[];
}

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
  /** Aggregated metrics for this milestone (pivot + folded children). */
  metrics?: EvolutionMetrics;
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
  /** Aggregated metrics across this era's nodes. */
  metrics?: EvolutionMetrics;
}

/** Single-session drill-down view. */
export interface SessionEvolution {
  sessionId: string;
  title: string;
  startedAt: number;
  eras: EvolutionEra[];
  nodes: EvolutionNode[];
  metrics: EvolutionMetrics;
}

/** Project overview view. */
export interface ProjectEvolution {
  workspaceRoot: string;
  eras: EvolutionEra[];
  nodes: EvolutionNode[];
  metrics: EvolutionMetrics;
}

// ─── Knowledge flow (P3): what the project stood on / deposited back ───

/** One prior-knowledge hit, mapped (best-effort) to the milestone that used it. */
export interface KnowledgeInflow {
  sessionId: string;
  nodeId?: string;
  nodeTitle?: string;
  request: string;
  excerpt: string;
  tags: string[];
  score: number;
  type: string;
}

/** One wiki entry deposited by the project. */
export interface KnowledgeOutflow {
  sessionId: string;
  nodeId?: string;
  nodeTitle?: string;
  targetId?: string;
  targetPath?: string;
  status: string;
  /** Human-readable knowledge body — the exploration's AI summary (what was figured out). */
  summary?: string;
  /** The exploration's question — what this deposit is about. */
  question?: string;
  /** Context key the knowledge was saved into, e.g. "C002" (parsed from write reason). */
  contextKey?: string;
}

/** Two-sided knowledge flow for the "知识流" tab. */
export interface KnowledgeFlow {
  inflow: KnowledgeInflow[];
  outflow: KnowledgeOutflow[];
}

// ─── AI narrative payloads (filled by services/ai/* synthesizers; optional) ───

/** Intent transition narrative: why the project pivoted from one milestone to the next. */
export interface TransitionNarrative {
  edges: { fromNodeId: string; toNodeId: string; why: string; evidence?: string }[];
}

/** Coding personality (SBTI/ABTI) derived from behavioural metrics — no questionnaire. */
export interface CodingPersona {
  scores: {
    axis: LocalizedText;
    value: number;
    leftLabel: LocalizedText;
    rightLabel: LocalizedText;
  }[];
  /** 6-letter pole code (e.g. "DTRSNV"). */
  typeCode: string;
  name: LocalizedText;
  intro: LocalizedText;
  reading: LocalizedText;
  signatureNodeId?: string;
  /** Matched archetype short code, e.g. "ARCH" / "NIGHT" / "OWL". */
  archetypeCode?: string;
  catchphrase: LocalizedText;
  devStyle: LocalizedText;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'hidden';
  /** Human-readable dominant-pole DNA string. */
  dna: LocalizedText;
  /** Avatar image: a server path (/persona/CODE.webp) live, or an inlined data URI for static export. */
  avatar?: string;
  /** Top-3 nearest archetypes for a "spectrum" display. */
  spectrum?: { code: string; name: LocalizedText; similarity: number }[];
}

/** Provenance for the work-canvas footer. */
export interface EvolutionProvenance {
  agent: string;
  model?: string;
  builtAt: number;
}

/** Top-level payload embedded into the self-contained HTML. */
export interface EvolutionExport {
  version: '1.0';
  /** Display locale for static HTML and live mirror snapshots. */
  locale?: ObserverLocale;
  generatedAt: number;
  aiUsed: boolean;
  project: ProjectEvolution;
  sessions: SessionEvolution[];
  theme?: string;
  /** Two-sided knowledge flow (P3). */
  knowledge?: KnowledgeFlow;
  /** AI intent-transition narrative (P4). */
  narrative?: TransitionNarrative;
  /** Coding personality SBTI (P5). */
  persona?: CodingPersona;
  /** Provenance footer (P2). */
  generatedBy?: EvolutionProvenance;
  /**
   * When true, the page is served by the live evolution server: the client opens
   * a WebSocket and re-renders in place on each pushed snapshot (no page reload).
   * Absent for static exports, which are fully self-contained and never poll/connect.
   */
  liveServer?: boolean;
  /**
   * Content-addressed token: a hash of the deterministic view-model (excludes
   * wall-clock provenance). The server uses it to skip pushing unchanged snapshots.
   */
  contentVersion?: string;
}
