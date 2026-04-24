/**
 * ABOUTME: Generate flow summary using Claude subagent.
 * Spawns a separate Claude process with the full node timeline as context,
 * requests a structured Markdown document describing the thinking process.
 */

import { spawn } from 'node:child_process';
import type { FlowNodeRow } from '../core/flow-store';
import { typeIcons } from '../ui/tui/theme';

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

const EXPLORATION_SUMMARY_PROMPT = `你是"心流记录者"。请用一句话概括本次 Exploration 的核心心流。

【角色定义】
- "你" = 用户
- "Claude Code" = 探索执行者

【核心结构】
你提出了什么问题 → Claude Code 给出的结论/答案是什么

【写作要求】
- 聚焦问题与结论，中间探索链路一句话带过或省略
- 句式简洁："你询问/要求...，Claude Code 确认/得出/建议..."
- 只用输入中的事实，不推测、不编造
- 语言与你提出的问题保持一致（中文或英文）
- 纯文本，不要用 Markdown 格式
- 控制在 120 字符以内，极度凝练

【风格示例】
好："你询问项目核心模块位置，Claude Code 确认逻辑集中在 core/ 目录，建议从该入口深入。"
差："你询问项目架构，Claude Code 先查看 package.json 梳理依赖，再浏览 src 目录，最终确定核心逻辑集中在 core/ 模块..."`;


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

/** Pass through model stdout: only trim outer whitespace; no line pick or prefix stripping. */
function normalizeExplorationSummary(question: string, nodes: ExplorationSummaryNode[], raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallbackExplorationSummary(question, nodes);
  }
  return trimmed;
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
  const claudeCommand = process.env.CLAUDE_COMMAND?.trim() || 'claude';

  return new Promise((resolve) => {
    const args = ['--print'];
    if (model) args.push('-m', model);

    const child = spawn(claudeCommand, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const promptText = `${SUMMARY_PROMPT}\n\n---\n\n${formatNodesForClaude(prompt, nodes)}`;
    child.stdin.write(promptText);
    child.stdin.end();

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    child.on('close', () => {
      const content = output.trim() || `# ${prompt}\n\n*(Summary generation failed)*`;
      resolve({ title: prompt, content, nodeRefs });
    });

    child.on('error', () => {
      resolve({
        title: prompt,
        content: `# ${prompt}\n\n*(Failed to generate summary via Claude)*`,
        nodeRefs,
      });
    });
  });
}

export async function generateExplorationSummaryAI(
  question: string,
  nodes: ExplorationSummaryNode[],
  history: ExplorationHistoryContext[] = [],
  model?: string,
): Promise<string> {
  const claudeCommand = process.env.CLAUDE_COMMAND?.trim() || 'claude';
  return new Promise((resolve) => {
    const args = ['--print'];
    if (model) args.push('-m', model);
    const child = spawn(claudeCommand, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const promptText = `${EXPLORATION_SUMMARY_PROMPT}

【前序心流上下文】
${formatExplorationHistory(history)}

【输入】
${formatExplorationForClaude(question, nodes)}`;
    child.stdin.write(promptText);
    child.stdin.end();

    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('close', () => {
      resolve(normalizeExplorationSummary(question, nodes, output));
    });
    child.on('error', () => {
      resolve(fallbackExplorationSummary(question, nodes));
    });
  });
}

export async function generatePotentialDirectionsAI(
  runtimeModel: string,
  explorations: DirectionExplorationInput[],
  model?: string,
): Promise<PotentialDirectionsResult> {
  const claudeCommand = process.env.CLAUDE_COMMAND?.trim() || 'claude';
  if (explorations.length === 0) {
    return fallbackPotentialDirections(explorations);
  }

  return new Promise((resolve) => {
    const args = ['--print'];
    if (model) args.push('-m', model);
    const child = spawn(claudeCommand, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const promptText = `${POTENTIAL_DIRECTIONS_PROMPT}\n\n【输入】\n${formatPotentialDirectionsInput(runtimeModel, explorations)}`;
    child.stdin.write(promptText);
    child.stdin.end();

    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('close', () => {
      resolve(normalizePotentialDirections(output, explorations));
    });
    child.on('error', () => {
      resolve(fallbackPotentialDirections(explorations));
    });
  });
}
