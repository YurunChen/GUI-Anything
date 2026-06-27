/**
 * AI intent-transition narrative for the Project Evolution view (P4).
 *
 * Takes the chronological milestone nodes and asks a local `claude --print`
 * subagent to explain *why* the project moved from each milestone to the next —
 * the "turning points" between pivots. Returns null on any failure (timeout /
 * non-JSON / empty) so the caller simply omits the narrative.
 *
 * `--no-ai` is handled upstream by not loading this synthesizer at all.
 */

import type { EvolutionNode, TransitionNarrative } from '../../data/protocol/evolution-types';
import { runClaudePrintPrompt, resolveSummaryModel } from './flow-summaries';
import { extractJsonFromText } from './structured-output';
import { createLogger } from '../../utils/logger';

const log = createLogger('summary');

export type TransitionSynthesizer = (
  nodes: EvolutionNode[],
) => Promise<TransitionNarrative | null>;

const TRANSITION_PROMPT = `你是「项目演进史的转折叙事者」。下面是一个软件项目按时间排列的「里程碑」列表，每条含 id、标题、阶段(delta)、日期、一句话说明，以及该里程碑的行为指标（工具调用数、报错数、耗时、是否复用/沉淀知识）。

请为**每一对相邻里程碑**（前→后）写一句「转折说明」：解释项目为什么会从前一个里程碑走到后一个——是遇到了什么、想通了什么、还是自然推进。要像在讲故事，点出动因，而非复述标题。

要求：
- fromNodeId / toNodeId：必须用输入里给出的 id 原文。
- why：≤60 字，说清「为什么转」，避免空话套话。
- evidence：可选，≤30 字，指向能佐证的信号（如「连续报错后改方向」「沿用上一程的知识」）。没有就省略。
- 只覆盖**相邻**里程碑对，按时间顺序，不跳跃不重排。

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "edges": [ { "fromNodeId": "...", "toNodeId": "...", "why": "...", "evidence": "..." } ] }`;

function formatNodesForPrompt(nodes: EvolutionNode[]): string {
  return nodes
    .map((n) => {
      const date = new Date(n.at);
      const ymd = isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
      const note = n.note ? ` — ${n.note}` : '';
      const m = n.metrics;
      const metricBits: string[] = [];
      if (m) {
        if (m.toolCount) metricBits.push(`工具${m.toolCount}`);
        if (m.errorCount) metricBits.push(`报错${m.errorCount}`);
        if (m.retrievals) metricBits.push(`复用知识${m.retrievals}`);
        if (m.writes) metricBits.push(`沉淀知识${m.writes}`);
      }
      const metrics = metricBits.length ? ` {${metricBits.join('·')}}` : '';
      return `- id=${n.id} [${n.delta}] ${ymd} 《${n.title}》${note}${metrics}`;
    })
    .join('\n');
}

interface RawEdge {
  fromNodeId?: unknown;
  toNodeId?: unknown;
  why?: unknown;
  evidence?: unknown;
}

/**
 * Parse a raw model response into a validated narrative. Exposed for unit testing
 * the coercion contract (id filtering, required `why`, optional `evidence`) without
 * spawning a subprocess. Returns null when no usable edge survives.
 */
export function parseTransitionNarrative(
  rawOutput: string,
  validIds: Iterable<string>,
): TransitionNarrative | null {
  const json = extractJsonFromText(rawOutput);
  if (!json) return null;
  try {
    return coerceNarrative(JSON.parse(json), new Set(validIds));
  } catch {
    return null;
  }
}

function coerceNarrative(parsed: unknown, validIds: Set<string>): TransitionNarrative | null {
  const edgesRaw = (parsed as { edges?: unknown })?.edges;
  if (!Array.isArray(edgesRaw)) return null;
  const edges: TransitionNarrative['edges'] = [];
  edgesRaw.forEach((item: RawEdge) => {
    const from = typeof item.fromNodeId === 'string' ? item.fromNodeId : '';
    const to = typeof item.toNodeId === 'string' ? item.toNodeId : '';
    const why = typeof item.why === 'string' ? item.why.trim() : '';
    if (!validIds.has(from) || !validIds.has(to) || !why) return;
    const evidence = typeof item.evidence === 'string' && item.evidence.trim()
      ? item.evidence.trim()
      : undefined;
    edges.push({ fromNodeId: from, toNodeId: to, why, evidence });
  });
  return edges.length > 0 ? { edges } : null;
}

/** TransitionSynthesizer implementation. Returns null on any failure. */
export async function synthesizeTransitions(
  nodes: EvolutionNode[],
): Promise<TransitionNarrative | null> {
  if (nodes.length < 2) return null; // need at least one transition

  const promptText = `${TRANSITION_PROMPT}\n\n---\n\n# 里程碑\n${formatNodesForPrompt(nodes)}`;

  const result = await runClaudePrintPrompt(promptText, {
    model: resolveSummaryModel(),
    timeoutMs: 60_000,
    taskIdPrefix: 'evolution-transitions',
  });

  if (!result.ok) {
    log.warn('transition synthesis fell back', { reason: result.reason });
    return null;
  }

  const narrative = parseTransitionNarrative(result.output, nodes.map((n) => n.id));
  if (!narrative) {
    log.warn('transition synthesis: no usable edges in output');
    return null;
  }
  return narrative;
}
