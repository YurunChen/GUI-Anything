/**
 * AI coding-persona namer (P5). The *scores* are computed deterministically in
 * services/evolution/persona-score.ts; the AI's only job is to give the result a
 * fun, memorable name + reading (like an MBTI flavour text). On any failure we
 * return the deterministic rule-based persona so the tab still renders.
 *
 * `--no-ai` is handled upstream by not loading this module at all.
 */

import type { CodingPersona, EvolutionNode } from '../../data/protocol/evolution-types';
import { pickLocalizedText, type LocalizedText } from '../../constants/observer-locale';
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
    .map((a) => `- ${pickLocalizedText(a.axis, 'zh-Hans')} / ${pickLocalizedText(a.axis, 'en')}: ${a.value}/100 `
      + `(0=${pickLocalizedText(a.leftLabel, 'zh-Hans')} / ${pickLocalizedText(a.leftLabel, 'en')}, `
      + `100=${pickLocalizedText(a.rightLabel, 'zh-Hans')} / ${pickLocalizedText(a.rightLabel, 'en')})`)
    .join('\n');
  return `你是「编程人格鉴定师」，风格像 MBTI 性格测试，要有趣、积极、有画面感，但不浮夸。

这位开发者的人格已由**真实项目行为**判定为「${pickLocalizedText(base.name, 'zh-Hans')} / ${pickLocalizedText(base.name, 'en')}」（${pickLocalizedText(base.devStyle, 'zh-Hans')} / ${pickLocalizedText(base.devStyle, 'en')}，代号 ${base.archetypeCode}）。
六维编码人格分数（0–100，越高越偏右标签）：

${lines}

人格代号已定，**不要改名**。请只写两段贴合「${pickLocalizedText(base.name, 'zh-Hans')} / ${pickLocalizedText(base.name, 'en')}」这个人设的性格解读：
- reading：中文，2–3 句、≤120 字，结合分数特征讲这个人怎么写代码、强在哪、要注意什么，语气像在夸朋友。
- reading.en：English, 2-3 concise sentences, same meaning and tone as reading["zh-Hans"].

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "reading": { "zh-Hans": "...", "en": "..." } }`;
}

interface RawPersona {
  reading?: unknown;
}

function parseLocalizedText(value: unknown): LocalizedText | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const en = typeof record.en === 'string' ? record.en.trim() : '';
  const zh = typeof record['zh-Hans'] === 'string' ? record['zh-Hans'].trim() : '';
  if (!en || !zh) return null;
  return { en, 'zh-Hans': zh };
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
  const reading = parseLocalizedText(parsed.reading);
  if (!reading) return null; // nothing useful
  return {
    ...base,
    reading,
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
