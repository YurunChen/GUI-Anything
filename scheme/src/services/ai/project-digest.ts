/**
 * AI project-digest enricher (P6). The *structure* and reliable sections of the
 * one-page "全景 Summary" are built deterministically in
 * services/evolution/digest-build.ts; the AI's only job is to (re)write the prose:
 *   - headline (一句话主旨)
 *   - each chapter's narrative line
 *   - nextSteps (下一步 / 待决策 — the only AI-exclusive section)
 * Everything else (chapter spans, outputs KPI, turningPoints, learned) stays
 * deterministic. On any failure we return the deterministic base unchanged.
 *
 * `--no-ai` is handled upstream by not loading this module at all.
 */

import type { EvolutionExport, ProjectDigest } from '../../data/protocol/evolution-types';
import { buildBaseDigest } from '../evolution/digest-build';
import { runClaudePrintPrompt, resolveSummaryModel } from './flow-summaries';
import { extractJsonFromText } from './structured-output';
import { createLogger } from '../../utils/logger';

const log = createLogger('summary');

export type DigestSynthesizer = (data: EvolutionExport) => Promise<ProjectDigest | null>;

function digestPrompt(base: ProjectDigest): string {
  const chapters = base.chapters.map((c, i) => `${i + 1}. 《${c.era}》（${c.span}）：${c.line}`).join('\n');
  const outputs = base.outputs.map((o) => `${o.label} ${o.value}`).join(' · ');
  const turns = base.turningPoints.length
    ? base.turningPoints.map((t) => `- ${t.title}：${t.why}`).join('\n')
    : '（无）';
  const learned = base.learned.length ? base.learned.map((l) => `- ${l}`).join('\n') : '（无）';
  return `你是「项目全景小结的执笔人」。下面是一个软件项目的确定性数据快照（章节、累计产出、关键转折、沉淀的知识）。请基于它写出可读、克制、有洞察的小结文字。

# 已有章节（按时间）
${chapters}

# 累计产出
${outputs}

# 关键转折
${turns}

# 沉淀的知识
${learned}

请输出三部分文字：
- headline：一句话主旨，≤30 字，说清「这个项目正在长成什么」，有判断、不流水账。
- chapters：与上面**同样数量、同样顺序**的章节，每条给一句更自然的叙述 line（≤40 字），不要复述标题，讲这一阶段在做什么、推进了什么。
- nextSteps：2–4 条「下一步 / 待决策」，只列**真问题**（从转折与沉淀里能合理推断的待办或风险），每条 ≤30 字，可执行。没有把握就少写，不要硬凑。

**只输出一段 JSON**（无 Markdown 围栏、无前后说明）：
{ "headline": "...", "chapters": [ { "era": "纪元名", "line": "..." } ], "nextSteps": ["...", "..."] }`;
}

interface RawDigest {
  headline?: unknown;
  chapters?: unknown;
  nextSteps?: unknown;
}

/**
 * Merge AI prose over the deterministic base. Exposed for unit testing (no
 * subprocess): keeps every reliable section, overrides only headline, chapter
 * lines (matched by era name), and nextSteps. Returns null when the AI text is
 * unusable so the caller can fall back to the base.
 */
export function mergeDigest(rawOutput: string, base: ProjectDigest): ProjectDigest | null {
  const json = extractJsonFromText(rawOutput);
  if (!json) return null;
  let parsed: RawDigest;
  try {
    parsed = JSON.parse(json) as RawDigest;
  } catch {
    return null;
  }

  const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';

  // Map era → line from the AI chapters, override matching base chapters only.
  const lineByEra = new Map<string, string>();
  if (Array.isArray(parsed.chapters)) {
    for (const c of parsed.chapters) {
      const era = typeof (c as { era?: unknown })?.era === 'string' ? (c as { era: string }).era.trim() : '';
      const line = typeof (c as { line?: unknown })?.line === 'string' ? (c as { line: string }).line.trim() : '';
      if (era && line) lineByEra.set(era, line);
    }
  }
  const chapters = base.chapters.map((ch) => {
    const line = lineByEra.get(ch.era);
    return line ? { ...ch, line } : ch;
  });

  const nextSteps = Array.isArray(parsed.nextSteps)
    ? parsed.nextSteps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : [];

  // Nothing useful at all ⇒ signal fallback.
  if (!headline && nextSteps.length === 0 && lineByEra.size === 0) return null;

  return {
    ...base,
    headline: headline || base.headline,
    chapters,
    nextSteps: nextSteps.length ? nextSteps : base.nextSteps,
  };
}

/** DigestSynthesizer implementation; falls back to the deterministic base. */
export async function synthesizeDigest(data: EvolutionExport): Promise<ProjectDigest | null> {
  const base = buildBaseDigest(data);
  if (base.chapters.length === 0 && data.project.nodes.length === 0) return null;

  const result = await runClaudePrintPrompt(digestPrompt(base), {
    model: resolveSummaryModel(),
    timeoutMs: 60_000,
    taskIdPrefix: 'project-digest',
  });

  if (!result.ok) {
    log.warn('project digest fell back to deterministic', { reason: result.reason });
    return base;
  }

  const merged = mergeDigest(result.output, base);
  return merged ?? base;
}
