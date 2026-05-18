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
import type {
  FlowchartBranchType,
  FlowchartHint,
  FlowchartImportance,
  GraphPatch,
  GraphPatchOp,
} from '../../data/protocol/observer-protocol';

/**
 * 结构化 Summary 输出格式
 * 这是 AI 被要求输出的严格 JSON 结构
 */
export interface StructuredSummaryOutput {
  /** 一句话心流摘要（UI 显示用，中文≤200字，英文≤300词） */
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
  /** Optional intent-tree hints used by flowchart view */
  flowchart?: {
    node_id: string;
    node_title: string;
    parent_id: string | null;
    branch_type: FlowchartBranchType;
    importance: FlowchartImportance;
    drop_from_chart: boolean;
    intent_key: string;
  };
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

  // summary 长度限制（中文≤200字，英文≤300词）
  const summaryLengthError = getSummaryLengthError(summary);
  if (summaryLengthError) {
    return {
      success: false,
      error: summaryLengthError,
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

  const flowchart = validateFlowchartHint(parsed.flowchart);
  if (!flowchart.success) {
    return flowchart.error;
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
    flowchart: flowchart.data,
  };

  return { success: true, data: validated };
}

function validateFlowchartHint(flowchartRaw: unknown):
  | { success: true; data: StructuredSummaryOutput['flowchart'] | undefined }
  | { success: false; error: ValidationResult<StructuredSummaryOutput> } {
  if (flowchartRaw === undefined) {
    return { success: true, data: undefined };
  }
  if (!isObject(flowchartRaw)) {
    return {
      success: false,
      error: {
        success: false,
        error: 'flowchart must be an object',
        fallbackReason: 'invalid_flowchart',
      },
    };
  }

  const nodeId = isNonEmptyString(flowchartRaw.node_id) ? flowchartRaw.node_id.trim() : '';
  const nodeTitle = isNonEmptyString(flowchartRaw.node_title) ? flowchartRaw.node_title.trim() : '';
  const parentId = flowchartRaw.parent_id === null
    ? null
    : (isNonEmptyString(flowchartRaw.parent_id) ? flowchartRaw.parent_id.trim() : null);
  const intentKey = isNonEmptyString(flowchartRaw.intent_key) ? flowchartRaw.intent_key.trim() : '';
  const branchType = normalizeBranchType(flowchartRaw.branch_type);
  const importance = normalizeImportance(flowchartRaw.importance);
  const dropFromChart = typeof flowchartRaw.drop_from_chart === 'boolean'
    ? flowchartRaw.drop_from_chart
    : false;

  if (!nodeId || !nodeTitle || !intentKey) {
    return {
      success: false,
      error: {
        success: false,
        error: 'flowchart requires non-empty node_id, node_title, intent_key',
        fallbackReason: 'missing_flowchart_fields',
      },
    };
  }
  if (nodeTitle.length > 48) {
    return {
      success: false,
      error: {
        success: false,
        error: 'flowchart.node_title too long (max 48)',
        fallbackReason: 'flowchart_title_too_long',
      },
    };
  }
  return {
    success: true,
    data: {
      node_id: nodeId,
      node_title: nodeTitle,
      parent_id: parentId,
      branch_type: branchType,
      importance,
      drop_from_chart: dropFromChart,
      intent_key: intentKey,
    },
  };
}

export function toFlowchartHint(output: StructuredSummaryOutput): FlowchartHint | undefined {
  if (!output.flowchart) return undefined;
  return {
    nodeId: output.flowchart.node_id,
    nodeTitle: output.flowchart.node_title,
    parentId: output.flowchart.parent_id,
    branchType: output.flowchart.branch_type,
    importance: output.flowchart.importance,
    dropFromChart: output.flowchart.drop_from_chart,
    intentKey: output.flowchart.intent_key,
  };
}

function normalizeBranchType(value: unknown): FlowchartBranchType {
  if (value === 'trunk' || value === 'parallel' || value === 'repair' || value === 'merge') {
    return value;
  }
  return 'trunk';
}

function normalizeImportance(value: unknown): FlowchartImportance {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
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
  if (!hasOutput) {
    base = `针对"${question}"，当前证据不足，建议继续补充关键信息后再给出结论。`;
  } else if (outputPreview) {
    base = `针对"${question}"，当前可得结论为：${outputPreview}`;
  } else if (errorCount > 0) {
    base = `针对"${question}"，执行中出现错误，建议先修复关键问题再收敛结论。`;
  } else if (toolCount > 0) {
    base = `针对"${question}"，已形成初步结论，建议继续验证后确认最终方案。`;
  } else {
    base = `针对"${question}"，已形成初步结论。`;
  }

  if (validationError) {
    return `${base}（AI输出格式异常：${validationError}）`;
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

function getSummaryLengthError(summary: string): string | null {
  if (!summary.trim()) return null;
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(summary);
  if (hasCjk && summary.length > 200) {
    return `Summary too long (${summary.length} chars, max 200 for CJK text)`;
  }
  if (!hasCjk) {
    const words = summary.trim().split(/\s+/).filter(Boolean).length;
    if (words > 300) {
      return `Summary too long (${words} words, max 300 for non-CJK text)`;
    }
  }
  return null;
}

export interface GraphConsolidationOutput {
  action: 'keep_incremental' | 'patch';
  graph_patch: GraphPatch[];
}

export function validateGraphConsolidationOutput(raw: string): ValidationResult<GraphConsolidationOutput> {
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
  if (!isObject(parsed)) {
    return {
      success: false,
      error: 'Response is not an object',
      fallbackReason: 'not_an_object',
    };
  }
  const actionRaw = parsed.action;
  const action = actionRaw === 'patch' ? 'patch' : actionRaw === 'keep_incremental' ? 'keep_incremental' : null;
  if (!action) {
    return {
      success: false,
      error: 'Invalid action field',
      fallbackReason: 'invalid_action',
    };
  }
  const rawPatches = parsed.graph_patch;
  if (!Array.isArray(rawPatches)) {
    return {
      success: false,
      error: 'graph_patch must be an array',
      fallbackReason: 'invalid_graph_patch',
    };
  }
  const graphPatch: GraphPatch[] = [];
  for (const item of rawPatches) {
    const parsedPatch = parseGraphPatch(item);
    if (!parsedPatch.success) {
      return parsedPatch.error;
    }
    graphPatch.push(parsedPatch.data);
  }
  return {
    success: true,
    data: {
      action,
      graph_patch: graphPatch,
    },
  };
}

function parseGraphPatch(value: unknown):
  | { success: true; data: GraphPatch }
  | { success: false; error: ValidationResult<GraphConsolidationOutput> } {
  if (!isObject(value)) {
    return {
      success: false,
      error: {
        success: false,
        error: 'graph patch item must be object',
        fallbackReason: 'invalid_patch_item',
      },
    };
  }
  const op = normalizeGraphPatchOp(value.op);
  if (!op) {
    return {
      success: false,
      error: {
        success: false,
        error: `invalid graph patch op: ${String(value.op)}`,
        fallbackReason: 'invalid_patch_op',
      },
    };
  }
  const reason = isNonEmptyString(value.reason) ? value.reason.trim() : '';
  if (!reason) {
    return {
      success: false,
      error: {
        success: false,
        error: 'graph patch reason is required',
        fallbackReason: 'missing_patch_reason',
      },
    };
  }
  const confidence = typeof value.confidence === 'number'
    ? Math.min(1, Math.max(0, value.confidence))
    : 0.5;
  const patch: GraphPatch = {
    op,
    reason,
    confidence,
  };
  const targetIntentKeyValue = isNonEmptyString(value.target_intent_key)
    ? value.target_intent_key
    : isNonEmptyString(value.targetIntentKey)
      ? value.targetIntentKey
      : undefined;
  if (targetIntentKeyValue) {
    patch.targetIntentKey = targetIntentKeyValue.trim();
  }
  const sourceIntentKeysValue = Array.isArray(value.source_intent_keys)
    ? value.source_intent_keys
    : Array.isArray(value.sourceIntentKeys)
      ? value.sourceIntentKeys
      : [];
  if (sourceIntentKeysValue.length > 0) {
    patch.sourceIntentKeys = sourceIntentKeysValue
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }
  if (typeof value.new_parent_intent_key === 'string') {
    patch.newParentIntentKey = value.new_parent_intent_key.trim();
  } else if (value.new_parent_intent_key === null) {
    patch.newParentIntentKey = null;
  } else if (typeof value.newParentIntentKey === 'string') {
    patch.newParentIntentKey = value.newParentIntentKey.trim();
  } else if (value.newParentIntentKey === null) {
    patch.newParentIntentKey = null;
  }
  const newTitleValue = typeof value.new_title === 'string'
    ? value.new_title
    : typeof value.newTitle === 'string'
      ? value.newTitle
      : '';
  if (newTitleValue.trim()) {
    patch.newTitle = newTitleValue.trim();
  }
  return { success: true, data: patch };
}

function normalizeGraphPatchOp(value: unknown): GraphPatchOp | null {
  if (
    value === 'merge_intents'
    || value === 'rename_intent'
    || value === 'reparent_intent'
    || value === 'drop_intent'
  ) {
    return value;
  }
  return null;
}
