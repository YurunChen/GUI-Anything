/**
 * AI coding-persona namer (P5). The *scores* are computed deterministically in
 * services/evolution/persona-score.ts; the AI's only job is to give the result a
 * fun, memorable name + reading (like an MBTI flavour text). On any failure we
 * return the deterministic rule-based persona so the tab still renders.
 *
 * `--no-ai` is handled upstream by not loading this module at all.
 */

import type { CodingPersona, EvolutionNode } from '../../data/protocol/evolution-types';
import { runClaudePrintPrompt, resolveSummaryModel } from './flow-summaries';
import { extractJsonFromText } from './structured-output';
import { createLogger } from '../../utils/logger';
import {
  computePersonaAxes,
  ruleBasedPersona,
  signalsFromNodes,
  typeCodeFromAxes,
  type PersonaAxis,
} from '../evolution/persona-score';

const log = createLogger('summary');

export type PersonaSynthesizer = (
  nodes: EvolutionNode[],
  sessionCount: number,
) => Promise<CodingPersona | null>;

function axesPrompt(axes: PersonaAxis[], typeCode: string): string {
  const lines = axes
    .map((a) => `- ${a.axis}：${a.value}/100（0=${a.leftLabel}，100=${a.rightLabel}）`)
    .join('\n');
  return `你是「编程人格鉴定师」，风格像 MBTI 性格测试，要有趣、积极、有画面感，但不浮夸。

下面是从某位开发者**真实项目行为**里测出的四维编码人格分数（0–100，越高越偏右标签），以及由此拼出的人格代号。

${lines}

人格代号：${typeCode}

请基于这些分数，给出一个**好玩又贴切**的人格画像：
- title：人格名，6–14 字，要像个称号（如「精雕细琢的架构匠」「快速试错的拓荒者」）。
- tagline：一句话标语，≤20 字，朗朗上口。
- reading：性格解读，2–3 句、≤120 字，结合分数特征讲这个人怎么写代码、强在哪、要注意什么，语气像在夸朋友。

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "title": "...", "tagline": "...", "reading": "..." }`;
}

interface RawPersona {
  title?: unknown;
  tagline?: unknown;
  reading?: unknown;
}

/**
 * Merge the AI's naming over the deterministic scores. Exposed for unit testing
 * (no subprocess): given a raw model output + the base persona, returns a fully
 * populated persona, or null if the AI text is unusable.
 */
export function mergePersonaNaming(rawOutput: string, base: CodingPersona): CodingPersona | null {
  const json = extractJsonFromText(rawOutput);
  if (!json) return null;
  let parsed: RawPersona;
  try {
    parsed = JSON.parse(json) as RawPersona;
  } catch {
    return null;
  }
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const tagline = typeof parsed.tagline === 'string' ? parsed.tagline.trim() : '';
  const reading = typeof parsed.reading === 'string' ? parsed.reading.trim() : '';
  if (!title && !reading) return null; // nothing useful
  return {
    ...base,
    title: title || base.title,
    tagline: tagline || base.tagline,
    reading: reading || base.reading,
  };
}

/** PersonaSynthesizer implementation; falls back to the rule-based persona. */
export async function synthesizePersona(
  nodes: EvolutionNode[],
  sessionCount: number,
): Promise<CodingPersona | null> {
  if (nodes.length === 0) return null;

  const base = ruleBasedPersona(nodes, sessionCount);
  const axes = computePersonaAxes(signalsFromNodes(nodes, sessionCount));
  const typeCode = typeCodeFromAxes(axes);

  const result = await runClaudePrintPrompt(axesPrompt(axes, typeCode), {
    model: resolveSummaryModel(),
    timeoutMs: 60_000,
    taskIdPrefix: 'coding-persona',
  });

  if (!result.ok) {
    log.warn('persona naming fell back to rule-based', { reason: result.reason });
    return base; // deterministic persona still ships
  }

  const merged = mergePersonaNaming(result.output, base);
  return merged ?? base;
}
