/**
 * AI era synthesis for the Project Evolution view (left rail).
 *
 * Takes the chronological milestone nodes and asks a local `claude --print`
 * subagent to abstract them into 3–6 narrative "eras". Conforms to the
 * `EraSynthesizer` contract from services/evolution: returns null on any
 * failure (timeout / non-JSON / empty) so the caller uses the rule fallback.
 */

import type { EvolutionEra, EvolutionNode } from '../../data/protocol/evolution-types';
import { EVOLUTION_ICON_NAMES, isEvolutionIcon } from '../../data/protocol/evolution-types';
import { runClaudePrintPrompt, resolveSummaryModel } from './flow-summaries';
import { extractJsonFromText } from './structured-output';
import { createLogger } from '../../utils/logger';

const log = createLogger('summary');

const ICON_LIST = EVOLUTION_ICON_NAMES.join(', ');

const ERA_PROMPT = `你是「项目演进史叙事者」。下面是一个软件项目按时间排列的「里程碑」列表，每条含 id、标题、阶段(delta)、日期、一句话说明。

请把这些里程碑**归并成 3～6 个有叙事性的「纪元」**（abstract eras），刻画项目能力是如何一步步长出来的——像把散点连成一条主线。

要求：
- 每个纪元覆盖**连续**的若干里程碑（按时间不交叉、不重排）。
- title：4–12 字的纪元名（如「搭建观察底座」「沉淀知识」「可视化输出」）。
- abstract：一句话（≤40 字）概括这个阶段做成了什么。
- sceneAdds：该纪元**新引入的能力关键词** 1–4 个（如 ["双栏时间线","实时刷新"]）。
- icon：从下面这个固定图标表里挑一个**最能表达该纪元主题**的名字（必须原样、只能选其一）：
  ${ICON_LIST}
- nodeIds：归入该纪元的里程碑 id 数组，**必须用输入里给出的 id 原文**，覆盖全部里程碑、不重不漏。

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "eras": [ { "title": "...", "abstract": "...", "icon": "...", "sceneAdds": ["..."], "nodeIds": ["..."] } ] }`;

function formatNodesForPrompt(nodes: EvolutionNode[]): string {
  return nodes
    .map((n) => {
      const date = new Date(n.at);
      const ymd = isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
      const note = n.note ? ` — ${n.note}` : '';
      return `- id=${n.id} [${n.delta}] ${ymd} 《${n.title}》${note}`;
    })
    .join('\n');
}

interface RawEra {
  title?: unknown;
  abstract?: unknown;
  icon?: unknown;
  sceneAdds?: unknown;
  nodeIds?: unknown;
}

function coerceEras(parsed: unknown): EvolutionEra[] | null {
  const erasRaw = (parsed as { eras?: unknown })?.eras;
  if (!Array.isArray(erasRaw)) return null;
  const eras: EvolutionEra[] = [];
  erasRaw.forEach((item: RawEra, i) => {
    const nodeIds = Array.isArray(item.nodeIds)
      ? item.nodeIds.filter((x): x is string => typeof x === 'string')
      : [];
    if (nodeIds.length === 0) return;
    const sceneAdds = Array.isArray(item.sceneAdds)
      ? item.sceneAdds.filter((x): x is string => typeof x === 'string').slice(0, 4)
      : [];
    eras.push({
      id: `era_${i}`,
      order: i,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : nodeIds[0],
      abstract: typeof item.abstract === 'string' ? item.abstract.trim() : '',
      icon: isEvolutionIcon(item.icon) ? item.icon : undefined,
      sceneAdds,
      nodeIds,
    });
  });
  return eras.length > 0 ? eras : null;
}

/**
 * EraSynthesizer implementation. Returns null on any failure → rule fallback.
 * `--no-ai` is handled upstream by not loading this synthesizer at all.
 */
export async function synthesizeEras(
  nodes: EvolutionNode[],
  context: { scope: 'project' | 'session'; sessionId?: string },
): Promise<EvolutionEra[] | null> {
  if (nodes.length < 2) return null; // too few to abstract; rule fallback is fine

  const promptText = `${ERA_PROMPT}\n\n---\n\n# 里程碑（scope=${context.scope}${
    context.sessionId ? `, session=${context.sessionId}` : ''
  }）\n${formatNodesForPrompt(nodes)}`;

  const result = await runClaudePrintPrompt(promptText, {
    model: resolveSummaryModel(),
    timeoutMs: 60_000,
    taskIdPrefix: 'evolution',
  });

  if (!result.ok) {
    log.warn('era synthesis fell back', { reason: result.reason });
    return null;
  }

  const json = extractJsonFromText(result.output);
  if (!json) {
    log.warn('era synthesis: no JSON in output');
    return null;
  }
  try {
    return coerceEras(JSON.parse(json));
  } catch (e) {
    log.warn('era synthesis: JSON parse failed', { error: (e as Error).message });
    return null;
  }
}
