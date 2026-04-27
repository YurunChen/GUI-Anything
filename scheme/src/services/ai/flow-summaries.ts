/**
 * ABOUTME: Generate flow summary using Claude subagent.
 * Spawns a separate Claude process with the full node timeline as context,
 * requests a structured Markdown document describing the thinking process.
 */

import { spawn } from 'node:child_process';
import type { WikiPersistMeta, WikiPersistType } from '../wiki/auto-extractor';
import { typeIcons } from '../../app/ui/theme';
import {
  validateStructuredSummaryOutput,
  toWikiPersistMeta,
  generateFallbackSummary,
  extractJsonFromText,
} from './structured-output';

// Local type definition (replaces FlowNodeRow from sqlite-store)
interface FlowNodeRow {
  id: string;
  timestamp: number;
  type: string;
  summary: string;
  phase: string | null;
  tool_name: string | null;
  tool_input_preview: string | null;
  result_preview: string | null;
}

// ── Claude Task Executor with timeout/concurrency control ──

type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

interface QueuedTask<T> {
  id: string;
  status: TaskStatus;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timeoutMs: number;
  startTime?: number;
}

class ClaudeTaskExecutor {
  private maxConcurrency: number;
  private defaultTimeoutMs: number;
  private queue: QueuedTask<unknown>[] = [];
  private running: Map<string, QueuedTask<unknown>> = new Map();
  private taskCounter = 0;

  constructor(options?: { maxConcurrency?: number; defaultTimeoutMs?: number }) {
    this.maxConcurrency = Math.max(1, options?.maxConcurrency ?? 2);
    this.defaultTimeoutMs = Math.max(5000, options?.defaultTimeoutMs ?? 45000);
  }

  get stats() {
    return {
      queued: this.queue.length,
      running: this.running.size,
      maxConcurrency: this.maxConcurrency,
    };
  }

  execute<T>(
    runFn: (abortSignal: AbortSignal) => Promise<T>,
    options?: { timeoutMs?: number; taskId?: string }
  ): Promise<T> {
    const taskId = options?.taskId ?? `task_${++this.taskCounter}_${Date.now()}`;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

    let resolve: (value: T) => void;
    let reject: (reason: Error) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const task: QueuedTask<T> = {
      id: taskId,
      status: 'queued',
      promise,
      resolve: resolve!,
      reject: reject!,
      timeoutMs,
    };

    this.queue.push(task as QueuedTask<unknown>);
    this.processQueue();

    return promise;
  }

  private processQueue(): void {
    while (this.running.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.runTask(task);
    }
  }

  private runTask(task: QueuedTask<unknown>): void {
    task.status = 'running';
    task.startTime = Date.now();
    this.running.set(task.id, task);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      task.status = 'timeout';
      this.running.delete(task.id);
      task.reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`));
      this.processQueue();
    }, task.timeoutMs);

    // Wrap user function to handle cleanup
    const originalPromise = (task as any)._runFn?.(abortController.signal);
    if (!originalPromise) {
      // Internal spawn-based execution
      this.runSpawnTask(task, abortController, timeoutId);
      return;
    }

    originalPromise
      .then((result: unknown) => {
        clearTimeout(timeoutId);
        if (task.status !== 'running') return;
        task.status = 'completed';
        this.running.delete(task.id);
        task.resolve(result);
        this.processQueue();
      })
      .catch((error: Error) => {
        clearTimeout(timeoutId);
        if (task.status !== 'running') return;
        task.status = 'failed';
        this.running.delete(task.id);
        task.reject(error);
        this.processQueue();
      });
  }

  private runSpawnTask(
    task: QueuedTask<unknown>,
    abortController: AbortController,
    timeoutId: NodeJS.Timeout
  ): void {
    // This is a placeholder - actual spawn logic is in the wrapper below
    clearTimeout(timeoutId);
    task.reject(new Error('Internal: runSpawnTask should not be called directly'));
    this.processQueue();
  }
}

// Global executor instance (singleton)
const claudeExecutor = new ClaudeTaskExecutor({
  maxConcurrency: 2,
  defaultTimeoutMs: 45000,
});

// Wrapper for spawn-based Claude execution with proper timeout/cleanup
interface SpawnOptions {
  args: string[];
  promptText: string;
  timeoutMs?: number;
  taskId?: string;
}

interface SpawnResult {
  output: string;
  exitCode: number | null;
  error?: string;
  timedOut: boolean;
}

function runClaudeSpawn(options: SpawnOptions): Promise<SpawnResult> {
  const { args, promptText, timeoutMs = 45000 } = options;
  const claudeCommand = process.env.CLAUDE_COMMAND?.trim() || 'claude';

  return new Promise((resolve) => {
    const child = spawn(claudeCommand, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let timedOut = false;
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (resolved) return;
      timedOut = true;
      child.kill('SIGTERM');
      // Give it 5s to cleanup, then force kill.
      setTimeout(() => {
        if (resolved) return;
        child.kill('SIGKILL');
      }, 5000);
    }, timeoutMs);

    child.stdin.write(promptText);
    child.stdin.end();

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    const finish = (exitCode: number | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolve({
        output,
        exitCode,
        error: errorOutput || undefined,
        timedOut,
      });
    };

    child.on('close', (code) => {
      finish(code);
    });

    child.on('error', (err) => {
      errorOutput += err.message;
      finish(null);
    });
  });
}

const SUMMARY_PROMPT = `你是一位技术文档作者。以下是一次 Claude Code 会话的完整操作日志。请将其整理为结构化的 Markdown 文档，包含：

1. **用户请求** — 原始 prompt
2. **探索阶段** — Claude 做了什么来理解项目/问题
3. **执行阶段** — 具体做了什么变更，涉及哪些文件
4. **验证阶段** — 如何确认变更正确
5. **关键发现** — 对架构、技术债务、设计决策的洞察
6. **最终输出** — Claude 给出的最终回答摘要

要求：
- 语言与用户 prompt 一致（中文或英文）
- 用简洁的技术文档风格
- 只基于日志中的事实，不要编造
- 如果某个阶段没有发生，省略该部分
- 输出纯 Markdown，不要包裹在代码块中`;

const EXPLORATION_SUMMARY_PROMPT = `你是"心流记录者"。请阅读本次 Exploration 的节点日志，输出**仅一段严格 JSON**（不要 Markdown、不要代码围栏、不要前后解释文字）。

【角色定义】
- "你" = 用户
- "Claude Code" = 探索执行者

【JSON 字段契约】
{
  "summary": "一句话心流：你问了什么 → Claude Code 的结论。与问题同语言；≤160 字；纯文本不含换行",
  "solution_detail": "用于写入 Wiki“解决方案”的详细过程。建议 3-8 行，按步骤描述关键动作、观察和结论，必须基于日志事实。",
  "persist": {
    "should_persist": boolean,
    "type": "error" | "snippet" | "decision" | "context" | "none",
    "confidence": 0 到 1 的小数（你对 should_persist 与 type 判断的把握）,
    "reason": "简短说明为何值得/不值得写入个人 Wiki（同语言）"
  },
  "tags": ["可选", "最多 6 个短标签"],
  "key_command": "若有值得固化的单条命令则填字符串，否则 null"
}

【persist 规则】
- 闲聊、问候 → should_persist=false, type=none
- 可复用的错误与修复、命令片段、架构/流程决策、重要上下文 → should_persist=true 并选对 type
- 只用日志中的事实，不编造`;


function formatNodesForClaude(prompt: string, nodes: FlowNodeRow[]): string {
  let text = `# User Request\n${prompt}\n\n# Session Timeline\n\n`;

  for (const node of nodes) {
    const icon = typeIcons[node.type] ?? '·';
    const time = new Date(node.timestamp).toLocaleTimeString();
    const phase = node.phase ? `[${node.phase.toUpperCase()}] ` : '';

    switch (node.type) {
      case 'tool_call':
        text += `- ${time} ${phase}${icon} **Called**: ${node.tool_name || 'unknown'} — ${node.summary}\n`;
        if (node.tool_input_preview) {
          text += `  Input: ${node.tool_input_preview}\n`;
        }
        break;
      case 'tool_result':
        text += `- ${time} ${phase}✓ **Result**: ${node.summary}\n`;
        if (node.result_preview) {
          text += `  Output: ${node.result_preview}\n`;
        }
        break;
      case 'thinking':
        text += `- ${time} ${phase}💭 **Thought**: ${node.summary}\n`;
        break;
      case 'response':
        text += `- ${time} ${phase}💬 **Response**: ${node.summary}\n`;
        break;
      default:
        text += `- ${time} ${phase}${icon} ${node.summary}\n`;
    }
  }

  return text;
}

export interface ExplorationSummaryNode {
  timestamp: number;
  type: 'tool' | 'result' | 'response' | 'thinking' | 'error';
  label: string;
  status?: 'running' | 'ok' | 'error';
}

export interface DirectionExplorationInput {
  id: string;
  question: string;
  summary?: string;
  toolCount: number;
  errorCount: number;
}

export interface ExplorationHistoryContext {
  question: string;
  summary?: string;
  toolCount: number;
  errorCount: number;
  status: 'complete' | 'interrupted';
}

export interface PotentialDirection {
  direction: string;
  why: string;
  nextAction: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PotentialDirectionsResult {
  status: 'ready' | 'insufficient';
  message?: string;
  directions: PotentialDirection[];
}

const POTENTIAL_DIRECTIONS_PROMPT = `你是一个“下一步方向建议器”，基于已有探索信息提出潜在方向。

【任务目标】
根据输入的探索历史，输出可执行、可解释的潜在方向建议。

【硬约束】
1) 只能基于输入事实，不得编造。
2) 每条建议必须包含三部分：direction、why、nextAction。
3) why 必须体现事实证据（例如来自哪些探索观察）。
4) 若证据不足，必须返回 insufficient 状态，不要硬给方向。
5) 输出必须是严格 JSON，不要 Markdown，不要额外文本。

【输出 JSON 契约】
{
  "status": "ready" | "insufficient",
  "message": "当 status=insufficient 时的说明，可选",
  "directions": [
    {
      "direction": "建议方向",
      "why": "基于事实的依据",
      "nextAction": "最小下一步动作",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

【数量约束】
- status=ready 时，directions 输出 2-3 条。
- status=insufficient 时，directions 必须为空数组。`;

function formatExplorationForClaude(question: string, nodes: ExplorationSummaryNode[]): string {
  let text = `# Exploration Question\n${question}\n\n# Nodes\n\n`;
  for (const node of nodes) {
    const time = new Date(node.timestamp).toLocaleTimeString();
    const status = node.status ? ` [${node.status}]` : '';
    text += `- ${time} [${node.type}]${status} ${node.label}\n`;
  }
  return text;
}

function formatExplorationHistory(history: ExplorationHistoryContext[]): string {
  if (history.length === 0) return 'none';
  return history
    .map((item, index) => {
      const parts = [
        `#${index + 1}`,
        `status=${item.status}`,
        `question=${item.question}`,
        `tools=${item.toolCount}`,
        `errors=${item.errorCount}`,
      ];
      if (item.summary && item.summary.trim()) {
        parts.push(`summary=${item.summary.trim()}`);
      }
      return parts.join(' | ');
    })
    .join('\n');
}

function formatPotentialDirectionsInput(
  runtimeModel: string,
  explorations: DirectionExplorationInput[],
): string {
  const rows = explorations.map((item, index) => {
    const parts = [
      `#${index + 1}`,
      `question=${item.question}`,
      `tools=${item.toolCount}`,
      `errors=${item.errorCount}`,
    ];
    if (item.summary && item.summary.trim()) {
      parts.push(`summary=${item.summary.trim()}`);
    }
    return parts.join(' | ');
  });
  return [
    `runtime_model=${runtimeModel || 'unknown'}`,
    `exploration_count=${explorations.length}`,
    ...rows,
  ].join('\n');
}

function fallbackExplorationSummary(question: string, nodes: ExplorationSummaryNode[]): string {
  const toolCount = nodes.filter((node) => node.type === 'tool').length;
  const errorCount = nodes.filter((node) => node.status === 'error' || node.type === 'error').length;
  const responseCount = nodes.filter((node) => node.type === 'response').length;
  const thinkingCount = nodes.filter((node) => node.type === 'thinking').length;
  const resultCount = nodes.filter((node) => node.type === 'result').length;
  const latestOutputNode = [...nodes].reverse().find((node) =>
    node.type === 'response' || node.type === 'result'
  );
  const outputPreview = (latestOutputNode?.label || '').trim().slice(0, 48);

  if (toolCount === 0 && responseCount === 0 && thinkingCount === 0 && resultCount === 0 && errorCount === 0) {
    return '信息不足，需查看节点详情';
  }
  if (outputPreview) {
    return `围绕“${question}”，执行中进行了${toolCount}次工具调用并形成最终输出：${outputPreview}${errorCount > 0 ? `（期间出现${errorCount}次错误）` : ''}`;
  }
  return `围绕“${question}”完成探索，过程包含${toolCount}次工具调用、${responseCount}次回复，当前可见输出为部分信息，需结合节点详情查看。`;
}

export interface ExplorationSummaryAIResult {
  displaySummary: string;
  persist: WikiPersistMeta | null;
}

function normalizeWikiPersistType(value: unknown): WikiPersistType {
  if (value === 'error' || value === 'snippet' || value === 'decision' || value === 'context' || value === 'none') {
    return value;
  }
  return 'none';
}

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, n));
}

/** Parse Claude stdout into display line + optional Wiki persist metadata.
 * 使用结构化输出校验器确保数据质量
 */
export function parseExplorationSummaryAIOutput(
  question: string,
  nodes: ExplorationSummaryNode[],
  raw: string,
): ExplorationSummaryAIResult & { validationError?: string } {
  // 构建上下文信息
  const toolCount = nodes.filter((n) => n.type === 'tool').length;
  const errorCount = nodes.filter((n) => n.status === 'error' || n.type === 'error').length;
  const responseCount = nodes.filter((n) => n.type === 'response').length;
  const latestOutputNode = [...nodes].reverse().find(
    (n) => n.type === 'response' || n.type === 'result'
  );

  // 使用新的结构化输出校验器
  const validation = validateStructuredSummaryOutput(raw, {
    question,
    nodeCount: nodes.length,
  });

  if (validation.success) {
    // 校验成功：使用 AI 输出的 summary
    return {
      displaySummary: validation.data.summary,
      persist: toWikiPersistMeta(validation.data),
    };
  }

  // 校验失败：生成 fallback 并在 reason 中标注
  const fallback = generateFallbackSummary(
    question,
    {
      toolCount,
      errorCount,
      responseCount,
      hasOutput: !!latestOutputNode,
      outputPreview: latestOutputNode?.label?.slice(0, 48),
    },
    validation.error
  );

  return {
    displaySummary: fallback,
    persist: null,
    validationError: validation.fallbackReason,
  };
}

function fallbackPotentialDirections(
  explorations: DirectionExplorationInput[],
): PotentialDirectionsResult {
  if (explorations.length < 2) {
    return {
      status: 'insufficient',
      message: '当前证据不足，建议先补充至少两轮有效探索。',
      directions: [],
    };
  }
  const latest = explorations[explorations.length - 1];
  return {
    status: 'ready',
    directions: [
      {
        direction: '先收敛问题边界与成功标准',
        why: '已有探索问题跨度较大，先明确边界有助于避免后续执行偏航。',
        nextAction: `将“${latest.question}”拆成可验证的2-3个子目标。`,
        confidence: 'medium',
      },
      {
        direction: '优先补足证据再做方案决策',
        why: '当前上下文信息仍偏摘要化，关键判断依据不足。',
        nextAction: '继续补充与核心目标直接相关的文件与命令观察。',
        confidence: 'medium',
      },
    ],
  };
}

function parseJsonObjectFromText(raw: string): string | null {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return raw.slice(first, last + 1);
}

function normalizeConfidence(value: string | undefined): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'low' || value === 'medium') {
    return value;
  }
  return 'medium';
}

function normalizePotentialDirections(
  raw: string,
  explorations: DirectionExplorationInput[],
): PotentialDirectionsResult {
  const jsonText = parseJsonObjectFromText(raw.trim());
  if (!jsonText) {
    return fallbackPotentialDirections(explorations);
  }
  try {
    const parsed = JSON.parse(jsonText) as {
      status?: string;
      message?: string;
      directions?: Array<{
        direction?: string;
        why?: string;
        nextAction?: string;
        confidence?: string;
      }>;
    };

    if (parsed.status === 'insufficient') {
      return {
        status: 'insufficient',
        message: parsed.message?.trim() || '当前证据不足，建议继续补充探索。',
        directions: [],
      };
    }

    const items = Array.isArray(parsed.directions) ? parsed.directions : [];
    const directions: PotentialDirection[] = items
      .map((item) => ({
        direction: (item.direction || '').trim(),
        why: (item.why || '').trim(),
        nextAction: (item.nextAction || '').trim(),
        confidence: normalizeConfidence(item.confidence),
      }))
      .filter((item) => item.direction && item.why && item.nextAction)
      .slice(0, 3);

    if (directions.length === 0) {
      return fallbackPotentialDirections(explorations);
    }
    return { status: 'ready', directions };
  } catch {
    return fallbackPotentialDirections(explorations);
  }
}

export async function generateFlowSummaryAI(
  prompt: string,
  nodes: FlowNodeRow[],
  model?: string,
): Promise<{ title: string; content: string; nodeRefs: string[] }> {
  const nodeRefs = nodes.map(n => n.id);
  const args = ['--print'];
  if (model) args.push('-m', model);

  const promptText = `${SUMMARY_PROMPT}\n\n---\n\n${formatNodesForClaude(prompt, nodes)}`;

  const result = await runClaudeSpawn({
    args,
    promptText,
    timeoutMs: 60000, // Flow summary may need more time
    taskId: `flow_${Date.now()}`,
  });

  if (result.timedOut) {
    return {
      title: prompt,
      content: `# ${prompt}\n\n*(Summary generation timed out after 60s)*`,
      nodeRefs,
    };
  }

  if (result.exitCode !== 0 || !result.output.trim()) {
    return {
      title: prompt,
      content: `# ${prompt}\n\n*(Summary generation failed: ${result.error || 'empty output'})*`,
      nodeRefs,
    };
  }

  return { title: prompt, content: result.output.trim(), nodeRefs };
}

export async function generateExplorationSummaryAI(
  question: string,
  nodes: ExplorationSummaryNode[],
  history: ExplorationHistoryContext[] = [],
  model?: string,
): Promise<ExplorationSummaryAIResult> {
  const args = ['--print'];
  if (model) args.push('-m', model);

  const promptText = `${EXPLORATION_SUMMARY_PROMPT}

【前序心流上下文】
${formatExplorationHistory(history)}

【输入】
${formatExplorationForClaude(question, nodes)}`;

  const result = await runClaudeSpawn({
    args,
    promptText,
    timeoutMs: 45000,
    taskId: `exp_${Date.now()}`,
  });

  if (result.timedOut) {
    return {
      displaySummary: fallbackExplorationSummary(question, nodes) + ' (生成超时)',
      persist: null,
    };
  }

  if (result.exitCode !== 0 || !result.output.trim()) {
    return {
      displaySummary: fallbackExplorationSummary(question, nodes),
      persist: null,
    };
  }

  return parseExplorationSummaryAIOutput(question, nodes, result.output);
}

export async function generatePotentialDirectionsAI(
  runtimeModel: string,
  explorations: DirectionExplorationInput[],
  model?: string,
): Promise<PotentialDirectionsResult> {
  if (explorations.length === 0) {
    return fallbackPotentialDirections(explorations);
  }

  const args = ['--print'];
  if (model) args.push('-m', model);

  const promptText = `${POTENTIAL_DIRECTIONS_PROMPT}\n\n【输入】\n${formatPotentialDirectionsInput(runtimeModel, explorations)}`;

  const result = await runClaudeSpawn({
    args,
    promptText,
    timeoutMs: 45000,
    taskId: `dir_${Date.now()}`,
  });

  if (result.timedOut || result.exitCode !== 0 || !result.output.trim()) {
    return fallbackPotentialDirections(explorations);
  }

  return normalizePotentialDirections(result.output, explorations);
}
