/**
 * Session Replay HTML - 主导出引擎
 * 从 session JSONL → ReplaySessionData → 自包含 HTML
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findLatestSession,
} from '../../data/session/claude-project';
import {
  extractExplorationsFromSession,
  extractSessionStats,
  extractLastPrompt,
} from '../../data/session/jsonl-session';
import { sanitizePath, redactSecrets, truncateDetail } from '../shared/sanitize';
import { generateReplayHtml } from './template';
import type {
  ReplaySessionData,
  ReplayExploration,
  ReplayNode,
  ReplaySessionStats,
  ExportHtmlOptions,
} from './types';
import type { Exploration, ExplorationNode } from '../../data/session/jsonl-session';

/** 默认详情最大长度 */
const DEFAULT_MAX_DETAIL_LENGTH = 2000;

/** 从 ExplorationNode 提取工具名称 */
function extractToolName(label: string): string | undefined {
  const parts = label.split(' ');
  if (parts.length > 0 && parts[0] && !parts[0].includes('/')) {
    return parts[0];
  }
  return undefined;
}

/** 从 ExplorationNode 提取文件路径 */
function extractFilePath(label: string): string | undefined {
  // 常见模式: "Read src/main.ts" 或 "Edit src/main.ts"
  const match = label.match(/(?:Read|Write|Edit|Glob|Grep)\s+(\S+)/);
  return match ? match[1] : undefined;
}

/** 转换单个 ExplorationNode 为 ReplayNode */
function convertNode(
  node: ExplorationNode,
  options: ExportHtmlOptions
): ReplayNode {
  const maxLen = options.maxDetailLength ?? DEFAULT_MAX_DETAIL_LENGTH;
  const stripThinking = options.stripThinking ?? false;

  // 如果是 thinking 类型且需要剥离，返回简化版本
  if (node.type === 'thinking' && stripThinking) {
    return {
      id: node.id,
      timestamp: node.timestamp,
      type: 'thinking',
      label: '[thinking hidden]',
      status: node.status,
      phase: node.phase,
    };
  }

  let detail: string | undefined;
  if (node.rawText) {
    detail = redactSecrets(truncateDetail(node.rawText, maxLen));
  } else if (node.rawCommand) {
    detail = redactSecrets(truncateDetail(node.rawCommand, maxLen));
  }

  return {
    id: node.id,
    timestamp: node.timestamp,
    type: node.type,
    label: sanitizePath(node.label),
    detail,
    status: node.status,
    phase: node.phase,
    toolName: extractToolName(node.label),
    filePath: extractFilePath(node.label),
    errorCategory: node.errorCategory,
  };
}

/** 转换 Exploration 为 ReplayExploration */
function convertExploration(
  exploration: Exploration,
  options: ExportHtmlOptions
): ReplayExploration {
  return {
    id: exploration.id,
    question: sanitizePath(redactSecrets(exploration.question)),
    startedAt: exploration.startedAt,
    endedAt: exploration.endedAt,
    status: exploration.status,
    currentPhase: exploration.currentPhase,
    phaseSeen: { ...exploration.phaseSeen },
    errorCounts: { ...exploration.errorCounts },
    nodes: exploration.nodes.map(n => convertNode(n, options)),
  };
}

/** 收集所有被访问的文件路径 */
function collectFilesAccessed(explorations: Exploration[]): string[] {
  const files = new Set<string>();
  for (const exp of explorations) {
    for (const node of exp.nodes) {
      const fp = extractFilePath(node.label);
      if (fp) files.add(fp);
    }
  }
  return [...files].sort();
}

/** 计算总工具调用数 */
function countTools(explorations: Exploration[]): number {
  let count = 0;
  for (const exp of explorations) {
    for (const node of exp.nodes) {
      if (node.type === 'tool') count++;
    }
  }
  return count;
}

/** 计算总错误数 */
function countErrors(explorations: Exploration[]): number {
  let count = 0;
  for (const exp of explorations) {
    count += exp.errorCounts.tool + exp.errorCounts.system + exp.errorCounts.result;
  }
  return count;
}

/** 主导出函数 */
export async function exportSessionToHtml(options: ExportHtmlOptions = {}): Promise<string> {
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();

  // 1. 找到 session 文件
  // 如果指定了 sessionId，临时设置环境变量
  if (options.sessionId) {
    process.env.FLOW_SESSION_ID = options.sessionId;
  }

  const sessionPath = findLatestSession(cwd);
  if (!sessionPath) {
    throw new Error(`No session found in ${cwd}. Please ensure FLOW_PROJECT_DIR or FLOW_SESSION_ID is set.`);
  }

  const sessionId = path.basename(sessionPath, '.jsonl');
  const content = fs.readFileSync(sessionPath, 'utf-8');

  // 2. 提取 explorations
  const explorations = extractExplorationsFromSession(sessionPath, content);
  if (explorations.length === 0) {
    throw new Error(`Session ${sessionId} has no explorations. The session may be empty.`);
  }

  // 3. 提取统计信息
  const rawStats = extractSessionStats(sessionPath, content);

  // 4. 计算时间跨度
  const firstTs = explorations[0].startedAt;
  const lastExp = explorations[explorations.length - 1];
  const lastTs = lastExp.endedAt || lastExp.nodes[lastExp.nodes.length - 1]?.timestamp || Date.now();
  const duration = lastTs - firstTs;

  // 5. 构建 ReplaySessionStats
  const stats: ReplaySessionStats = {
    inputTokens: rawStats.inputTokens,
    outputTokens: rawStats.outputTokens,
    cacheReadTokens: rawStats.cacheReadTokens,
    cacheWriteTokens: rawStats.cacheWriteTokens,
    costUsd: rawStats.costUsd,
    turns: rawStats.turns,
    events: rawStats.events,
    totalTools: countTools(explorations),
    totalErrors: countErrors(explorations),
    filesAccessed: collectFilesAccessed(explorations),
    duration,
  };

  // 6. 构建 ReplaySessionData
  const title = extractLastPrompt(sessionPath).slice(0, 100);
  const replayData: ReplaySessionData = {
    version: '1.0',
    title,
    sessionId,
    projectDir: sanitizePath(cwd),
    createdAt: firstTs,
    exportedAt: Date.now(),
    stats,
    explorations: explorations.map(e => convertExploration(e, options)),
    theme: options.theme || process.env.FLOW_THEME || 'tokyo-night',
  };

  // 7. 生成 HTML
  const html = generateReplayHtml(replayData);

  // 8. 输出
  if (options.outputPath) {
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, html, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    console.error(`✅ Exported replay HTML: ${options.outputPath} (${(size / 1024).toFixed(1)}KB)`);
    return options.outputPath;
  } else {
    // 输出到 stdout
    process.stdout.write(html);
    return 'stdout';
  }
}