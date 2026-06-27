/**
 * Deterministic coding-persona scoring (P5, v2) — the reliable, testable half of
 * the SBTI/ABTI feature. Computes six 0–100 axes from behavioural signals already
 * present in the evolution view-model, then judges the nearest archetype by
 * Euclidean distance (SBTI-Buddy-style: NO questionnaire, real behaviour only).
 * The AI layer (services/ai/coding-persona.ts) only writes the flavour reading;
 * if the AI is unavailable we still ship the full archetype + scores.
 *
 * Axis order (shared with persona-archetypes.ts; value = lean toward RIGHT label):
 *   0. 思维广度  聚焦 / 发散
 *   1. 工作节奏  规划 / 试错
 *   2. 知识取向  原创 / 复用
 *   3. 产出倾向  探索 / 交付
 *   4. 节律      昼间 / 夜行
 *   5. 路线      坚守 / 漂移
 */

import type { CodingPersona, EvolutionNode } from '../../data/protocol/evolution-types';
import {
  ARCHETYPES,
  EGGS,
  archetypeByCode,
  type EggSignals,
  type PersonaArchetype,
  type PersonaEgg,
} from './persona-archetypes';

export interface PersonaSignals {
  milestoneCount: number;
  substepCount: number;
  sessionCount: number;
  toolCount: number;
  errorCount: number;
  retrievals: number;
  writes: number;
  /** Share of milestones whose timestamp falls in 00:00–05:00. */
  nightShare: number;
  /** Share of milestones that are pivots (route churn). */
  pivotShare: number;
  /** Σ interrupted explorations ÷ total milestones+substeps. */
  interruptedShare: number;
  /** Σ tokens ÷ session count (raw intensity; not part of the 6-dim vector). */
  intensity: number;
}

export interface PersonaAxis {
  axis: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
  /** Single-letter codes for the left/right poles, used to assemble the type code. */
  leftCode: string;
  rightCode: string;
}

export interface ArchetypeMatch {
  code: string;
  spectrum: { code: string; cn: string; similarity: number }[];
}

function clamp(n: number): number {
  if (!isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Collapse the project view-model into the compact signal bundle the scorer needs. */
export function signalsFromNodes(nodes: EvolutionNode[], sessionCount: number): PersonaSignals {
  let substepCount = 0;
  let toolCount = 0;
  let errorCount = 0;
  let retrievals = 0;
  let writes = 0;
  let interrupted = 0;
  let tokens = 0;
  let nightNodes = 0;
  let pivotNodes = 0;
  for (const n of nodes) {
    substepCount += n.children?.length ?? 0;
    if (n.delta === 'pivot') pivotNodes += 1;
    const hour = new Date(n.at).getHours();
    if (!Number.isNaN(hour) && hour >= 0 && hour < 5) nightNodes += 1;
    const m = n.metrics;
    if (m) {
      toolCount += m.toolCount;
      errorCount += m.errorCount;
      retrievals += m.retrievals;
      writes += m.writes;
      interrupted += m.interrupted;
      tokens += m.tokens ?? 0;
    }
  }
  const explorations = Math.max(1, nodes.length + substepCount);
  return {
    milestoneCount: nodes.length,
    substepCount,
    sessionCount,
    toolCount,
    errorCount,
    retrievals,
    writes,
    nightShare: nodes.length > 0 ? nightNodes / nodes.length : 0,
    pivotShare: nodes.length > 0 ? pivotNodes / nodes.length : 0,
    interruptedShare: interrupted / explorations,
    intensity: tokens / Math.max(1, sessionCount),
  };
}

/** Compute the six persona axes from raw signals. Pure + deterministic. */
export function computePersonaAxes(s: PersonaSignals): PersonaAxis[] {
  const milestones = Math.max(1, s.milestoneCount);

  // 1. Divergent if mostly standalone pivots; focused if each milestone is drilled deep.
  const divergent = clamp((100 * s.milestoneCount) / (s.milestoneCount + s.substepCount));
  // 2. Tinkerer scales with error density over tool calls (40% errors ≈ full tinker).
  const errorDensity = s.toolCount > 0 ? s.errorCount / s.toolCount : 0;
  const tinker = clamp(errorDensity * 250);
  // 3. Reuser if it leans on prior knowledge; originator if it mostly writes new.
  const knowledgeTotal = s.retrievals + s.writes;
  const reuse = knowledgeTotal > 0 ? clamp((100 * s.retrievals) / knowledgeTotal) : 50;
  // 4. Shipper if it deposits knowledge per milestone; explorer if it rarely does.
  const ship = clamp((100 * s.writes) / milestones);
  // 5. Night owl by share of late-night milestones.
  const night = clamp(s.nightShare * 100);
  // 6. Drifter by share of pivots among milestones.
  const drift = clamp(s.pivotShare * 100);

  return [
    { axis: '思维广度', value: divergent, leftLabel: '聚焦', rightLabel: '发散', leftCode: 'F', rightCode: 'D' },
    { axis: '工作节奏', value: tinker, leftLabel: '规划', rightLabel: '试错', leftCode: 'P', rightCode: 'T' },
    { axis: '知识取向', value: reuse, leftLabel: '原创', rightLabel: '复用', leftCode: 'O', rightCode: 'R' },
    { axis: '产出倾向', value: ship, leftLabel: '探索', rightLabel: '交付', leftCode: 'E', rightCode: 'S' },
    { axis: '节律', value: night, leftLabel: '昼间', rightLabel: '夜行', leftCode: 'U', rightCode: 'N' },
    { axis: '路线', value: drift, leftLabel: '坚守', rightLabel: '漂移', leftCode: 'K', rightCode: 'V' },
  ];
}

/** Assemble the 6-letter pole code (e.g. "DTRSNV") from the axes' dominant poles. */
export function typeCodeFromAxes(axes: PersonaAxis[]): string {
  return axes.map((a) => (a.value >= 50 ? a.rightCode : a.leftCode)).join('');
}

/** Human-readable DNA string of dominant pole labels, e.g. "聚焦·试错·复用·交付·夜行·坚守". */
export function dnaFromAxes(axes: PersonaAxis[]): string {
  return axes.map((a) => (a.value >= 50 ? a.rightLabel : a.leftLabel)).join('·');
}

const MAX_DIST = Math.sqrt(6 * 100 * 100); // farthest possible distance in 6-dim 0–100 space

/**
 * Judge the nearest archetype from the six axis values, SBTI-Buddy-style.
 * Hidden eggs (extreme behaviour) take precedence over the nearest-centroid match.
 */
export function matchArchetype(axes: PersonaAxis[], eggSignals: EggSignals): ArchetypeMatch {
  const vec = axes.map((a) => a.value);

  const egg = EGGS.find((e) => e.egg(eggSignals));
  const ranked = ARCHETYPES.map((a) => {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += (vec[i] - a.dims[i]) ** 2;
    const dist = Math.sqrt(sum);
    return { code: a.code, cn: a.cn, similarity: Math.round((1 - dist / MAX_DIST) * 100) / 100 };
  }).sort((x, y) => y.similarity - x.similarity);

  if (egg) {
    // Egg becomes the headline; spectrum still shows the closest real archetypes.
    return { code: egg.code, spectrum: ranked.slice(0, 3) };
  }
  return { code: ranked[0].code, spectrum: ranked.slice(0, 3) };
}

/** Deterministic, fully self-contained persona (also the AI-failure fallback). */
export function ruleBasedPersona(nodes: EvolutionNode[], sessionCount: number): CodingPersona {
  const signals = signalsFromNodes(nodes, sessionCount);
  const axes = computePersonaAxes(signals);
  const typeCode = typeCodeFromAxes(axes);
  const dna = dnaFromAxes(axes);

  const match = matchArchetype(axes, {
    nightShare: signals.nightShare,
    interruptedShare: signals.interruptedShare,
    writes: signals.writes,
    milestoneCount: signals.milestoneCount,
  });
  const arch = (archetypeByCode(match.code) ?? ARCHETYPES[0]) as PersonaArchetype | PersonaEgg;

  const signature = [...nodes].sort(
    (a, b) => (b.metrics?.toolCount ?? 0) - (a.metrics?.toolCount ?? 0),
  )[0];

  return {
    scores: axes.map(({ axis, value, leftLabel, rightLabel }) => ({ axis, value, leftLabel, rightLabel })),
    typeCode,
    archetypeCode: arch.code,
    cnName: arch.cn,
    intro: arch.intro,
    catchphrase: arch.catchphrase,
    devStyle: arch.devStyle,
    rarity: arch.rarity,
    dna,
    spectrum: match.spectrum,
    title: arch.cn,
    tagline: arch.intro,
    reading:
      `基于本项目的真实行为推导出「${arch.cn}」（${arch.devStyle}）：` +
      axes.map((a) => `${a.axis}偏${a.value >= 50 ? a.rightLabel : a.leftLabel}`).join('、') + '。',
    signatureNodeId: signature?.id,
  };
}
