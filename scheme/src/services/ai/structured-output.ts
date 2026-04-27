/**
 * Structured Output - AI 结构化输出校验器
 * 
 * 目标：提升 AI summary 质量，减少 fallback 和弱结构解析。
 * 策略：
 * - Prompt 明确要求严格 JSON
 * - 手写 validator 校验必要字段
 * - 校验失败时 fallback，并在 provenance/reason 中标注
 */

import type { WikiPersistMeta, WikiPersistType } from '../wiki/auto-extractor';

/**
 * 结构化 Summary 输出格式
 * 这是 AI 被要求输出的严格 JSON 结构
 */
export interface StructuredSummaryOutput {
  /** 一句话心流摘要（UI 显示用，≤160 字） */
  summary: string;
  /** 用于写入 Wiki"解决方案"的详细过程 */
  solution_detail: string;
  /** 持久化决策元数据 */
  persist: {
    should_persist: boolean;
    type: WikiPersistType;
    confidence: number;
    reason?: string;
  };
  /** 可选标签，最多 6 个 */
  tags?: string[];
  /** 若有值得固化的单条命令则填字符串，否则 null */
  key_command?: string | null;
}

/**
 * 校验结果类型
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fallbackReason: string };

/**
 * 从原始文本中提取 JSON 对象
 * 处理 Claude 可能包裹在 Markdown 代码块中的情况
 */
export function extractJsonFromText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 尝试直接解析
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  // 查找代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      return content;
    }
  }

  // 查找第一个 { 和最后一个 }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

/**
 * 校验并解析结构化 Summary 输出
 * 
 * 校验规则：
 * 1. 必须是有效的 JSON
 * 2. summary 必须是存在的非空字符串
 * 3. persist 必须是存在的对象
 * 4. persist.should_persist 必须是布尔值
 * 5. persist.type 必须是有效的 WikiPersistType
 * 6. persist.confidence 必须是 0-1 之间的数字
 */
export function validateStructuredSummaryOutput(
  raw: string,
  context: { question: string; nodeCount: number }
): ValidationResult<StructuredSummaryOutput> {
  const jsonText = extractJsonFromText(raw);
  if (!jsonText) {
    return {
      success: false,
      error: 'No JSON object found in response',
      fallbackReason: 'json_not_found',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`,
      fallbackReason: 'json_parse_error',
    };
  }

  // 基础结构校验
  if (!isObject(parsed)) {
    return {
      success: false,
      error: 'Response is not an object',
      fallbackReason: 'not_an_object',
    };
  }

  // 校验 summary
  const summary = parsed.summary;
  if (!isNonEmptyString(summary)) {
    return {
      success: false,
      error: 'Missing or empty "summary" field',
      fallbackReason: 'missing_summary',
    };
  }

  // summary 长度限制（UI 可读性）
  if (summary.length > 220) {
    return {
      success: false,
      error: `Summary too long (${summary.length} chars, max 220)`,
      fallbackReason: 'summary_too_long',
    };
  }

  // 校验 persist 对象
  const persist = parsed.persist;
  if (!isObject(persist)) {
    return {
      success: false,
      error: 'Missing or invalid "persist" object',
      fallbackReason: 'missing_persist',
    };
  }

  // 校验 should_persist
  if (typeof persist.should_persist !== 'boolean') {
    return {
      success: false,
      error: 'persist.should_persist must be a boolean',
      fallbackReason: 'invalid_should_persist',
    };
  }

  // 校验 type
  const validTypes: WikiPersistType[] = ['error', 'snippet', 'decision', 'context', 'none'];
  if (!validTypes.includes(persist.type as WikiPersistType)) {
    return {
      success: false,
      error: `Invalid persist.type: "${persist.type}"`,
      fallbackReason: 'invalid_persist_type',
    };
  }

  // 校验 confidence
  const confidence = typeof persist.confidence === 'number'
    ? Math.min(1, Math.max(0, persist.confidence))
    : 0.5;

  // 校验 tags（可选）
  let tags: string[] | undefined;
  if (parsed.tags !== undefined) {
    if (!Array.isArray(parsed.tags)) {
      return {
        success: false,
        error: 'tags must be an array',
        fallbackReason: 'invalid_tags',
      };
    }
    tags = parsed.tags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .slice(0, 6)
      .map((t) => t.trim());
  }

  // 校验 key_command（可选）
  let keyCommand: string | null | undefined;
  if (parsed.key_command !== undefined) {
    if (parsed.key_command !== null && typeof parsed.key_command !== 'string') {
      return {
        success: false,
        error: 'key_command must be string or null',
        fallbackReason: 'invalid_key_command',
      };
    }
    keyCommand = parsed.key_command === null ? null : parsed.key_command.trim() || null;
  }

  // 构建有效的输出对象
  const validated: StructuredSummaryOutput = {
    summary: summary.trim().replace(/\s+/g, ' '),
    solution_detail: isNonEmptyString(parsed.solution_detail)
      ? parsed.solution_detail.trim()
      : '',
    persist: {
      should_persist: persist.should_persist,
      type: persist.type as WikiPersistType,
      confidence,
      reason: isNonEmptyString(persist.reason) ? persist.reason.trim() : undefined,
    },
    tags,
    key_command: keyCommand,
  };

  return { success: true, data: validated };
}

/**
 * 将验证后的结构化输出转换为 WikiPersistMeta
 */
export function toWikiPersistMeta(output: StructuredSummaryOutput): WikiPersistMeta {
  return {
    should_persist: output.persist.should_persist,
    type: output.persist.type,
    confidence: output.persist.confidence,
    reason: output.persist.reason,
    solution_detail: output.solution_detail,
    tags: output.tags,
    key_command: output.key_command,
  };
}

/**
 * 生成 fallback 摘要（当结构化输出校验失败时使用）
 */
export function generateFallbackSummary(
  question: string,
  context: {
    toolCount: number;
    errorCount: number;
    responseCount: number;
    hasOutput: boolean;
    outputPreview?: string;
  },
  validationError?: string
): string {
  const { toolCount, errorCount, hasOutput, outputPreview } = context;

  let base: string;
  if (toolCount === 0 && !hasOutput) {
    base = `探索"${truncate(question, 30)}"信息不足，需查看节点详情`;
  } else if (outputPreview) {
    base = `围绕"${truncate(question, 30)}"，进行了${toolCount}次工具调用${errorCount > 0 ? `（出现${errorCount}次错误）` : ''}，形成输出：${outputPreview}`;
  } else {
    base = `围绕"${truncate(question, 30)}"完成探索，包含${toolCount}次工具调用`;
  }

  if (validationError) {
    return `${base} [AI输出格式错误: ${truncate(validationError, 20)}]`;
  }

  return base;
}

// -------- 类型守卫 --------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
