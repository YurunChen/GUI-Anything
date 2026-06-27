/**
 * ABOUTME: Generate flow summary using Claude subagent.
 * Spawns a separate Claude process with the full node timeline as context,
 * requests a structured Markdown document describing the thinking process.
 */

import { spawn } from 'node:child_process';
import type { WikiPersistMeta, WikiPersistType } from '../wiki/auto-extractor';
import { typeIcons } from '../../app/ui/theme';
import { getObserverMessages } from '../../app/ui/i18n/observer-messages';
import {
  validateStructuredSummaryOutput,
  toWikiPersistMeta,
  toFlowchartHint,
  extractJsonFromText,
} from './structured-output';
import {
  buildExplorationRoundRecord,
  formatAssistantReplyExcerpt,
} from './exploration-round-record';
import type { FlowchartHint, SessionIntentState } from '../../data/protocol/observer-protocol';
import { formatSessionIntentKeyCatalogForPrompt } from '../../constants/session-intent-keys';
import { synthesizeFlowchartHint } from './intent-infer';
import { createLogger } from '../../utils/logger';

const log = createLogger('summary');

/** Default model for the Summary subagent when none is configured (env can override). */
const DEFAULT_SUMMARY_MODEL = 'sonnet';

/**
 * Resolve which model the Summary/Wiki subagent should use.
 * Priority: explicit arg → FLOW_SUMMARY_MODEL → CLAUDE_MODEL → DEFAULT_SUMMARY_MODEL.
 * Avoids silently falling back to a weak/fast default model that produces degenerate summaries.
 */
export function resolveSummaryModel(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  const env = (process.env.FLOW_SUMMARY_MODEL || process.env.CLAUDE_MODEL || '').trim();
  return env || DEFAULT_SUMMARY_MODEL;
}

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

function runClaudeSpawn(options: SpawnOptions & { cwd?: string }): Promise<SpawnResult> {
  const { args, promptText, timeoutMs = 45000, cwd } = options;
  const claudeCommand = process.env.CLAUDE_COMMAND?.trim() || 'claude';

  return new Promise((resolve) => {
    const child = spawn(claudeCommand, args, {
      cwd: cwd ?? process.cwd(),
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

const SUMMARY_PROMPT = `你是心流会话整理者。将一次 Claude Code 会话日志整理为简洁 Markdown，便于用户事后回顾（不打断当时的心流）。

建议结构（无内容的章节可省略）：
1. 用户要什么
2. 关键探索与结论
3. 重要变更或发现
4. 最终回答要点

要求：与用户 prompt 同语言；只写日志中的事实；纯 Markdown，无代码围栏。`;

const EXPLORATION_SUMMARY_PROMPT = `你是「心流概括者」——为 Flow Observer 右栏写**一句真正的本轮总结**（Hero），并标注**意图**用于知识沉淀。

输出**仅一段 JSON**（无 Markdown 围栏、无前后说明）。
- 用户 = 你；Claude Code = 执行者（时间轴 response/result 是它的输出，是你要总结的素材，不是你本人发言）。

═══ 第一要务：summary 必须是「概括」，不是「摘抄」 ═══

summary = 用一句话讲清**本轮相对用户问题，做成了 / 想通了 / 卡在了什么**。把回答**读完**再提炼它的结论与产物。

【硬性禁止】（这些是最常见的失败）
- ❌ 直接复制 Claude Code 回答的**开场白 / 第一句 / 寒暄**当 summary
- ❌ 整段粘贴回答原文或长句
- ❌ 复述用户原问、或写「调用了 N 次工具」这种流水账

【正面要求】
- 站在用户视角：扫一眼就知道这轮的**结果**
- 中文优先 12–40 字一句（硬上限 ≤200 字）；英文 8–25 词；单行纯文本
- 回答很长时，提炼它的**结论 / 产物 / 关键发现**，而不是它的开头

【对照示例】
- 问「介绍整个项目的功能」
  ❌「我已经了解了整个项目」（这是回答开场白 → 错误）
  ✅「梳理了 GUI-Anything 的 sidecar observer 架构与三大功能及用法」
- 问「html 功能在哪」
  ❌「找到了」（无信息 → 错误）
  ✅「定位到 HTML 功能位于 progress-html / session-replay 等服务」
- 问「给我跑一次」
  ✅「已运行并在浏览器打开，输出正常」

═══ flowchart：必填，不可省略 ═══

**每次都必须输出 flowchart 对象**，承载本轮意图——它驱动知识沉淀，缺失会导致 Wiki 无法工作。

{{INTENT_KEY_CATALOG}}

**node_title** 与 **summary** 不是同一段文字：
- **node_title**：用户此刻在攻克什么（意图短语，8–18 字）；同一 **intent_key** 下可随轮 refine。
- **summary**：相对该 node_title，本轮的推进 / 结论 / 状态（Hero，一句）。

顺序：先定 flowchart（intent_key、node_title、title_delta），再写 summary。

**intent_key 只能从上方词表选择**（continue/refine 沿用当前 key；pivot 换词表中另一项）。细粒度差异写在 node_title，不要新造 key。

**title_delta 必须与 intent_key 一致**（硬规则）：
| title_delta | intent_key | parent_id |
|-------------|------------|-----------|
| continue / refine | **与上一轮相同** | 不变或 null |
| pivot | **必须换新**（不得与上一轮相同） | 上一轮 intent_key |
| idle | greeting 或待任务 | null |
| done / blocked | 通常不变 key | 按语义 |

- continue vs refine：同 key + node_title 更具体 → refine；同 key + node_title 可不变 → continue。
- idle：寒暄/无任务；node_title 写「待具体任务」；drop_from_chart=true。
- **何时 pivot（少用）**：用户**明确换题/换任务域**（分析→实现、工程→研究、读代码→部署）。同主题的子问题、优化点、追问、确认 → 一律 continue/refine。**宁可 refine 也不要轻易 pivot。**
- title_delta=pivot 时必填 title_delta_note（≤40 字）说明为何换题。
- 离开 greeting 的首条真实任务 → 新 intent_key + pivot。

### 意图标注示例（对照【当前 session intent】）
上一轮 key=project_design：
- 「还有哪些可以优化？」→ intent_key=project_design，refine，node_title=「项目设计优化点」
- 「继续看 data-flow 文档」→ intent_key=project_design，continue
- 「开始按方案改代码」→ intent_key=implement，pivot，parent_id=project_design，note=「方案切实现」

## 其它字段
1. **solution_detail** — 展开用：关键步骤、必要原文摘录（3–8 行）；可空。
2. **persist** — 仅辅助 Wiki Agent（type/tags/key_command/solution_detail）；**是否落盘不由 Summary 决定**。Observer 仅在 **title_delta=pivot**（关闭上一 intent）或 session 结束时触发 Wiki 策展；同 intent 内（continue/refine）**只积累、不落盘**。

## JSON 契约

{
  "summary": "凝练心流概括（一句推进/结论/状态）",
  "solution_detail": "过程与摘录（可空）",
  "persist": {
    "should_persist": true,
    "type": "context" | "entity" | "error" | "snippet" | "decision" | "none",
    "confidence": 0.0-1.0,
    "reason": "给 Wiki Agent 的简短上下文（非落盘开关）"
  },
  "tags": ["可选，最多 6 个"],
  "key_command": "值得复现的一条命令或 null",
  "flowchart": {
    "node_id": "snake_case",
    "node_title": "动态目标短语（8-18 字）",
    "intent_key": "词表中的键，如 project_design | implement",
    "title_delta": "idle | continue | refine | pivot | blocked | done",
    "title_delta_note": "pivot/refine/blocked 时可选，≤40 字",
    "parent_id": "父 intent_key 或 null",
    "branch_type": "trunk | parallel | repair | merge",
    "importance": "high | medium | low",
    "drop_from_chart": false
  }
}

## 连续思考（同 session）

- 必读【当前 session intent】与【标题演变】，再读【前序心流】。
- **先判定 intent**：对照上表与示例，确定 intent_key 与 title_delta；二者矛盾视为无效输出。
- **summary** 只概括**本轮相对当前 node_title 的推进**；禁止复制前序 summary 或助手长文。
- continue/refine：flowchart.intent_key **必须等于**【当前 session intent】的 key。
- pivot：flowchart.intent_key **必须不同于**上一轮 key，且 parent_id = 上一轮 key。
- 低价值轮次：drop_from_chart=true；persist.should_persist 仍可为 true（落盘由 pivot/session 结束时的 Wiki Curator 判断）。
- 只写日志与上下文中出现过的事实。`;

function getExplorationSummaryPrompt(): string {
  return EXPLORATION_SUMMARY_PROMPT.replace(
    '{{INTENT_KEY_CATALOG}}',
    formatSessionIntentKeyCatalogForPrompt(),
  );
}


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

export interface ExplorationHistoryContext {
  question: string;
  summary?: string;
  toolCount: number;
  errorCount: number;
  status: 'complete' | 'interrupted';
}

const TRIVIAL_GREETING_REQUESTS = new Set([
  'hello', 'hi', 'hey', 'thanks', 'thank you', 'thx', '你好', '您好', '在吗', '谢谢', 'ping', 'test',
]);

/** Greeting / zero-tool turns — skip LLM, calm card + persist skip. */
export function isTrivialGreetingExploration(
  question: string,
  nodes: ExplorationSummaryNode[],
): boolean {
  const request = question.trim().toLowerCase();
  if (nodes.some((n) => n.type === 'tool')) return false;
  return TRIVIAL_GREETING_REQUESTS.has(request);
}

export function buildGreetingFlowchartHint(): FlowchartHint {
  const m = getObserverMessages();
  return {
    nodeId: 'greeting',
    nodeTitle: m.trivialGreetingIntentTitle,
    parentId: null,
    branchType: 'trunk',
    importance: 'low',
    dropFromChart: true,
    intentKey: 'greeting',
    titleDelta: 'idle',
  };
}

export function buildTrivialGreetingSummaryResult(
  question: string,
  nodes: ExplorationSummaryNode[],
): ExplorationSummaryAIResult {
  const m = getObserverMessages();
  const reply = [...nodes].reverse().find(
    (n) => n.type === 'response' || n.type === 'result',
  )?.label?.trim() || '';
  return {
    displaySummary: m.trivialGreetingDistill,
    persist: {
      should_persist: false,
      type: 'none',
      confidence: 1,
      reason: 'skip',
      solution_detail: reply ? m.assistantReplyLine(reply) : '',
    },
    flowchart: buildGreetingFlowchartHint(),
  };
}

export function formatSessionIntentForPrompt(intent: SessionIntentState | null | undefined): string {
  const m = getObserverMessages();
  if (!intent) {
    return m.sessionIntentEmpty;
  }
  const lines = [
    `key=${intent.intentKey}`,
    `title=${intent.nodeTitle}`,
    `phase=${intent.phase}`,
  ];
  if (intent.parentIntentKey) {
    lines.push(`parent=${intent.parentIntentKey}`);
  }
  const recent = intent.history.slice(-3);
  if (recent.length === 0) {
    return `${m.sessionIntentCurrent}\n${lines.join(' · ')}`;
  }
  const historyLines = recent.map((item, index) => {
    const note = item.titleDeltaNote ? ` (${item.titleDeltaNote})` : '';
    return `#${index + 1} ${item.titleDelta} key=${item.intentKey} title=${item.nodeTitle}${note}`;
  });
  return `${m.sessionIntentCurrent}\n${lines.join(' · ')}\n${m.sessionIntentHistory}\n${historyLines.join('\n')}`;
}

function formatExplorationForClaude(question: string, nodes: ExplorationSummaryNode[]): string {
  let text = `# User Request (你)\n${question}\n\n# Timeline (Claude Code 执行记录)\n\n`;
  for (const node of nodes) {
    const time = new Date(node.timestamp).toLocaleTimeString();
    const status = node.status ? ` [${node.status}]` : '';
    const role =
      node.type === 'response' || node.type === 'result'
        ? ' [Claude Code 输出]'
        : '';
    text += `- ${time} [${node.type}]${role}${status} ${node.label}\n`;
  }
  return text;
}

function formatExplorationHistory(history: ExplorationHistoryContext[]): string {
  const m = getObserverMessages();
  if (history.length === 0) {
    return m.sessionHistoryEmpty;
  }
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
        parts.push(`prior_summary=${item.summary.trim()}`);
      } else {
        parts.push(`prior_summary=${m.priorSummaryPending}`);
      }
      return parts.join(' | ');
    })
    .join('\n');
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
  flowchart?: FlowchartHint;
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
  priorIntentKey?: string | null,
): ExplorationSummaryAIResult & { validationError?: string } {
  // 使用新的结构化输出校验器
  const validation = validateStructuredSummaryOutput(raw, {
    question,
    nodeCount: nodes.length,
  });

  if (validation.success) {
    // 校验成功：始终采用 AI 摘要文本；flowchart 缺失/不合法时用确定性推断合成，保证 Wiki 不被饿死。
    let flowchart = toFlowchartHint(validation.data);
    if (!flowchart) {
      flowchart = synthesizeFlowchartHint({ question, priorIntentKey });
      log.warn('summary flowchart synthesized', {
        reason: validation.warnings?.join(',') || 'flowchart_missing',
        intentKey: flowchart.intentKey,
        titleDelta: flowchart.titleDelta,
      });
    } else if (validation.warnings?.length) {
      log.debug('summary validated with warnings', { reason: validation.warnings.join(',') });
    }
    return {
      displaySummary: validation.data.summary,
      persist: toWikiPersistMeta(validation.data),
      flowchart,
    };
  }

  // 硬失败（无可用 AI 摘要）：规则兜底 Hero + 合成 flowchart（让 Wiki 仍能分桶）。
  log.warn('summary structured-output hard fallback', { reason: validation.fallbackReason });
  const displaySummary = buildExplorationRoundRecord(question, nodes);
  const persist: WikiPersistMeta = {
    should_persist: false,
    type: 'none',
    confidence: 0.5,
    reason: 'skip',
    solution_detail: formatAssistantReplyExcerpt(nodes),
  };

  return {
    displaySummary,
    persist,
    flowchart: synthesizeFlowchartHint({ question, priorIntentKey }),
    validationError: validation.fallbackReason,
  };
}

export async function generateFlowSummaryAI(
  prompt: string,
  nodes: FlowNodeRow[],
  model?: string,
): Promise<{ title: string; content: string; nodeRefs: string[] }> {
  const nodeRefs = nodes.map(n => n.id);
  const args = ['--print', '--model', resolveSummaryModel(model)];

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
  sessionIntent?: SessionIntentState | null,
): Promise<ExplorationSummaryAIResult> {
  if (isTrivialGreetingExploration(question, nodes)) {
    return buildTrivialGreetingSummaryResult(question, nodes);
  }

  const priorIntentKey = sessionIntent?.intentKey ?? null;
  const resolvedModel = resolveSummaryModel(model);
  const args = ['--print', '--model', resolvedModel];

  const promptText = `${getExplorationSummaryPrompt()}

【当前 session intent】
${formatSessionIntentForPrompt(sessionIntent)}

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

  if (result.timedOut || result.exitCode !== 0 || !result.output.trim()) {
    log.warn('summary subprocess fallback (no AI output)', {
      model: resolvedModel,
      timedOut: result.timedOut,
      exitCode: result.exitCode,
      stderr: result.error ? result.error.slice(0, 200) : undefined,
    });
    return {
      displaySummary: buildExplorationRoundRecord(question, nodes),
      persist: {
        should_persist: false,
        type: 'none',
        confidence: 0.5,
        reason: 'skip',
        solution_detail: formatAssistantReplyExcerpt(nodes),
      },
      // 合成 flowchart，使 Wiki 分桶不因子进程失败而中断。
      flowchart: synthesizeFlowchartHint({ question, priorIntentKey }),
    };
  }

  return parseExplorationSummaryAIOutput(question, nodes, result.output, priorIntentKey);
}

export async function runClaudePrintPrompt(
  promptText: string,
  options?: {
    model?: string;
    timeoutMs?: number;
    taskIdPrefix?: string;
    cwd?: string;
  },
): Promise<{ ok: boolean; output: string; reason?: string }> {
  const args = ['--print'];
  if (options?.model) args.push('--model', options.model);
  const result = await runClaudeSpawn({
    args,
    promptText,
    timeoutMs: options?.timeoutMs ?? 45000,
    taskId: `${options?.taskIdPrefix || 'flow'}_${Date.now()}`,
    cwd: options?.cwd,
  });
  if (result.timedOut) {
    return { ok: false, output: '', reason: 'timeout' };
  }
  if (result.exitCode !== 0 || !result.output.trim()) {
    return { ok: false, output: '', reason: result.error || 'empty_output' };
  }
  return { ok: true, output: result.output };
}

export interface ClaudeAgentPromptOptions {
  model?: string;
  timeoutMs?: number;
  taskIdPrefix?: string;
  permissionMode?: 'acceptEdits' | 'default' | 'plan';
  allowedTools?: string[];
  addDir?: string[];
  cwd?: string;
}

/** Agentic Claude run — acceptEdits + tool allowlist (Wiki Agent /llm-wiki). */
export async function runClaudeAgentPrompt(
  promptText: string,
  options?: ClaudeAgentPromptOptions,
): Promise<{ ok: boolean; output: string; reason?: string }> {
  const args = [
    '--print',
    '--permission-mode',
    options?.permissionMode ?? 'acceptEdits',
  ];
  if (options?.model) args.push('--model', options.model);
  const tools = options?.allowedTools ?? ['Read', 'Edit', 'Write', 'Bash'];
  for (const tool of tools) {
    args.push('--allowedTools', tool);
  }
  for (const dir of options?.addDir ?? []) {
    if (dir.trim()) args.push('--add-dir', dir.trim());
  }

  const result = await runClaudeSpawn({
    args,
    promptText,
    timeoutMs: options?.timeoutMs ?? 90_000,
    taskId: `${options?.taskIdPrefix || 'agent'}_${Date.now()}`,
    cwd: options?.cwd,
  });
  if (result.timedOut) {
    return { ok: false, output: '', reason: 'timeout' };
  }
  if (result.exitCode !== 0 || !result.output.trim()) {
    return { ok: false, output: result.output, reason: result.error || 'empty_output' };
  }
  return { ok: true, output: result.output };
}
