/**
 * Deterministic project-digest builder (P6) — the reliable half of the one-page
 * "全景 Summary". Fills sections 1/2/4/5 (headline / chapters / outputs / learned)
 * purely from the evolution view-model, and reuses the P4 narrative for section 3
 * (turningPoints) when it is present. Section 6 (nextSteps) is AI-only and stays
 * empty here. The AI layer (services/ai/project-digest.ts) only *rewrites* the
 * prose (headline / chapter lines / nextSteps); on failure this base ships as-is.
 */

import type {
  EvolutionExport,
  EvolutionMetrics,
  EvolutionNode,
  ProjectDigest,
} from '../../data/protocol/evolution-types';

/** Short human duration ("~3天" / "~5小时" / "~12分钟"); '' when unknown. */
function humanSpan(ms: number | undefined): string {
  if (typeof ms !== 'number' || ms <= 0) return '';
  const min = ms / 60000;
  if (min < 60) return `~${Math.max(1, Math.round(min))}分钟`;
  const hr = min / 60;
  if (hr < 24) return `~${Math.round(hr)}小时`;
  return `~${Math.round(hr / 24)}天`;
}

function nodeTitleMap(nodes: EvolutionNode[]): Map<string, string> {
  return new Map(nodes.map((n) => [n.id, n.title]));
}

/** Section 1 — one-line thesis: how many stages/milestones, where it is heading. */
function buildHeadline(data: EvolutionExport): string {
  const eraCount = data.project.eras.length;
  const milestones = data.project.nodes.length;
  const lastEra = data.project.eras[data.project.eras.length - 1];
  const heading = lastEra ? `「${lastEra.title}」` : '持续演进';
  const span = humanSpan(data.project.metrics?.elapsedMs);
  const spanBit = span ? `、跨度 ${span}` : '';
  return `历经 ${eraCount} 个阶段 / ${milestones} 个里程碑${spanBit}，项目正长成 ${heading}。`;
}

/** Section 2 — one line per era (title + abstract + span). */
function buildChapters(data: EvolutionExport): ProjectDigest['chapters'] {
  return data.project.eras.map((era) => ({
    era: era.title,
    line: era.abstract || `${era.nodeIds.length} 个里程碑`,
    span: humanSpan(era.metrics?.elapsedMs) || `${era.nodeIds.length} 里程碑`,
  }));
}

/** Section 3 — reuse the P4 transition narrative (top edges) when available. */
function buildTurningPoints(data: EvolutionExport, limit = 5): ProjectDigest['turningPoints'] {
  if (!data.narrative) return [];
  const titles = nodeTitleMap(data.project.nodes);
  return data.narrative.edges.slice(0, limit).map((e) => {
    const from = titles.get(e.fromNodeId) ?? '前一里程碑';
    const to = titles.get(e.toNodeId) ?? '后一里程碑';
    return { title: `${from} → ${to}`, why: e.why };
  });
}

/** Section 4 — cumulative outputs (project-level KPI). */
function buildOutputs(data: EvolutionExport): ProjectDigest['outputs'] {
  const m: EvolutionMetrics | undefined = data.project.metrics;
  const out: ProjectDigest['outputs'] = [
    { label: '会话', value: String(data.sessions.length) },
    { label: '里程碑', value: String(data.project.nodes.length) },
  ];
  if (m) {
    if (m.toolCount) out.push({ label: '工具调用', value: String(m.toolCount) });
    if (m.errorCount) out.push({ label: '报错', value: String(m.errorCount) });
    if (m.retrievals) out.push({ label: '复用知识', value: String(m.retrievals) });
    if (m.writes) out.push({ label: '沉淀知识', value: String(m.writes) });
    const span = humanSpan(m.elapsedMs);
    if (span) out.push({ label: '时间跨度', value: span });
    if (typeof m.tokens === 'number' && m.tokens > 0) {
      out.push({ label: 'Token', value: m.tokens.toLocaleString('en-US') });
    }
    if (m.files && m.files.length) out.push({ label: '触碰文件', value: String(m.files.length) });
  }
  return out;
}

/** Section 5 — what was learned (knowledge deposited back, deduped). */
function buildLearned(data: EvolutionExport, limit = 8): string[] {
  const flow = data.knowledge;
  if (!flow || !flow.outflow.length) return [];
  const seen = new Set<string>();
  const learned: string[] = [];
  for (const w of flow.outflow) {
    const label = w.nodeTitle || w.targetId || w.targetPath || '';
    const text = label.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    learned.push(text);
    if (learned.length >= limit) break;
  }
  return learned;
}

/**
 * Build the fully deterministic digest. Always safe to ship (used directly under
 * `--no-ai`, and as the AI-failure fallback). Sections 1/2/4/5 always present;
 * section 3 present iff a narrative exists; section 6 (nextSteps) empty.
 */
export function buildBaseDigest(data: EvolutionExport): ProjectDigest {
  return {
    headline: buildHeadline(data),
    chapters: buildChapters(data),
    turningPoints: buildTurningPoints(data),
    outputs: buildOutputs(data),
    learned: buildLearned(data),
    nextSteps: [],
  };
}
