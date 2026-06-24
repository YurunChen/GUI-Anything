/**
 * Deterministic coding-persona scoring (P5) — the reliable, testable half of the
 * SBTI feature. Computes four 0–100 axes from behavioural signals already present
 * in the evolution view-model (milestones, substeps, tool/error/retrieval/write
 * counts). The AI layer (services/ai/coding-persona.ts) only *names* the result;
 * if the AI is unavailable we still ship these scores plus a rule-based type code.
 *
 * Axes (value = lean toward the RIGHT label, 0 = full LEFT, 100 = full RIGHT):
 *   1. 聚焦 ↔ 发散   (Focused / Divergent)  — milestone vs substep mix
 *   2. 规划 ↔ 试错   (Planner / Tinkerer)   — error density over tool calls
 *   3. 原创 ↔ 复用   (Originator / Reuser)  — retrieval vs write balance
 *   4. 探索 ↔ 交付   (Explorer / Shipper)   — knowledge deposited per milestone
 */

import type { CodingPersona, EvolutionNode } from '../../data/protocol/evolution-types';

export interface PersonaSignals {
  milestoneCount: number;
  substepCount: number;
  sessionCount: number;
  toolCount: number;
  errorCount: number;
  retrievals: number;
  writes: number;
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
  for (const n of nodes) {
    substepCount += n.children?.length ?? 0;
    const m = n.metrics;
    if (m) {
      toolCount += m.toolCount;
      errorCount += m.errorCount;
      retrievals += m.retrievals;
      writes += m.writes;
    }
  }
  return {
    milestoneCount: nodes.length,
    substepCount,
    sessionCount,
    toolCount,
    errorCount,
    retrievals,
    writes,
  };
}

/** Compute the four persona axes from raw signals. Pure + deterministic. */
export function computePersonaAxes(s: PersonaSignals): PersonaAxis[] {
  const milestones = Math.max(1, s.milestoneCount);

  // 1. Divergent if mostly standalone pivots; focused if each milestone is drilled
  //    deep with many substeps.
  const divergent = clamp((100 * s.milestoneCount) / (s.milestoneCount + s.substepCount));

  // 2. Tinkerer scales with error density over tool calls (40% errors ≈ full tinker).
  const errorDensity = s.toolCount > 0 ? s.errorCount / s.toolCount : 0;
  const tinker = clamp(errorDensity * 250);

  // 3. Reuser if it leans on prior knowledge; originator if it mostly writes new.
  const knowledgeTotal = s.retrievals + s.writes;
  const reuse = knowledgeTotal > 0 ? clamp((100 * s.retrievals) / knowledgeTotal) : 50;

  // 4. Shipper if it deposits knowledge per milestone; explorer if it rarely does.
  const ship = clamp((100 * s.writes) / milestones);

  return [
    { axis: '思维广度', value: divergent, leftLabel: '聚焦', rightLabel: '发散', leftCode: 'F', rightCode: 'D' },
    { axis: '工作节奏', value: tinker, leftLabel: '规划', rightLabel: '试错', leftCode: 'P', rightCode: 'T' },
    { axis: '知识取向', value: reuse, leftLabel: '原创', rightLabel: '复用', leftCode: 'O', rightCode: 'R' },
    { axis: '产出倾向', value: ship, leftLabel: '探索', rightLabel: '交付', leftCode: 'E', rightCode: 'S' },
  ];
}

/** Assemble a 4-letter type code (e.g. "DTRS") from the axes' dominant poles. */
export function typeCodeFromAxes(axes: PersonaAxis[]): string {
  return axes.map((a) => (a.value >= 50 ? a.rightCode : a.leftCode)).join('');
}

/** A readable, fully deterministic persona used as the AI-failure fallback. */
export function ruleBasedPersona(nodes: EvolutionNode[], sessionCount: number): CodingPersona {
  const axes = computePersonaAxes(signalsFromNodes(nodes, sessionCount));
  const typeCode = typeCodeFromAxes(axes);
  // Title from the two strongest leanings (largest distance from the 50 midpoint).
  const ranked = [...axes].sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50));
  const lead = ranked.slice(0, 2).map((a) => (a.value >= 50 ? a.rightLabel : a.leftLabel));
  const signature = [...nodes].sort((a, b) => (b.metrics?.toolCount ?? 0) - (a.metrics?.toolCount ?? 0))[0];
  return {
    scores: axes.map(({ axis, value, leftLabel, rightLabel }) => ({ axis, value, leftLabel, rightLabel })),
    typeCode,
    title: `${lead.join('·')}型开发者`,
    tagline: `代号 ${typeCode}`,
    reading: '基于本项目的真实行为信号推导：' +
      axes.map((a) => `${a.axis}偏${a.value >= 50 ? a.rightLabel : a.leftLabel}`).join('、') + '。',
    signatureNodeId: signature?.id,
  };
}
