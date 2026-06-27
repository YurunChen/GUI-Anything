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
  type PersonaAxis,
} from '../evolution/persona-score';

const log = createLogger('summary');

export type PersonaSynthesizer = (
  nodes: EvolutionNode[],
  sessionCount: number,
) => Promise<CodingPersona | null>;

function axesPrompt(axes: PersonaAxis[], base: CodingPersona): string {
  const lines = axes
    .map((a) => `- ${a.axis}：${a.value}/100（0=${a.leftLabel}，100=${a.rightLabel}）`)
    .join('\n');
  return `你是「编程人格鉴定师」，风格像 MBTI 性格测试，要有趣、积极、有画面感，但不浮夸。

这位开发者的人格已由**真实项目行为**判定为「${base.cnName}」（${base.devStyle}，代号 ${base.archetypeCode}）。
六维编码人格分数（0–100，越高越偏右标签）：

${lines}

人格代号已定，**不要改名**。请只写一段贴合「${base.cnName}」这个人设的性格解读：
- reading：2–3 句、≤120 字，结合分数特征讲这个人怎么写代码、强在哪、要注意什么，语气像在夸朋友。

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "reading": "..." }`;
}

interface RawPersona {
  reading?: unknown;
}

/**
 * Merge the AI's reading over the deterministic persona. The archetype name/code
 * is fixed by the matcher; the AI only rewrites the flavour `reading`.
 * Exposed for unit testing (no subprocess).
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
  const reading = typeof parsed.reading === 'string' ? parsed.reading.trim() : '';
  if (!reading) return null; // nothing useful
  return { ...base, reading };
}

/** PersonaSynthesizer implementation; falls back to the rule-based persona. */
export async function synthesizePersona(
  nodes: EvolutionNode[],
  sessionCount: number,
): Promise<CodingPersona | null> {
  if (nodes.length === 0) return null;

  const base = ruleBasedPersona(nodes, sessionCount);
  const axes = computePersonaAxes(signalsFromNodes(nodes, sessionCount));

  const result = await runClaudePrintPrompt(axesPrompt(axes, base), {
    model: resolveSummaryModel(),
    timeoutMs: 60_000,
  });

  if (!result.ok) {
    log.warn('persona naming fell back to rule-based', { reason: result.reason });
    return base; // deterministic persona still ships
  }

  const merged = mergePersonaNaming(result.output, base);
  return merged ?? base;
}
