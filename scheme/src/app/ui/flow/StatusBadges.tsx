/**
 * StatusBadges - 轻量 provenance 标签组件
 * 显示 summary source、wiki persist status、cache status
 */

import type { ReactNode } from 'react';
import { colors } from '../theme';
import type { SummaryItem, PersistResult, CacheLoadStatus } from '../../../data/protocol/observer-protocol';

interface SourceBadgeProps {
  source: SummaryItem['source'];
  reason?: string;
}

/** Summary 来源标签：CACHE / WIKI / AI / FALLBACK
 * 注意：返回的是 <span> 数组，必须在父组件的 <text> 中渲染
 */
export function SourceBadge({ source, reason }: SourceBadgeProps): ReactNode {
  const { text, fg } = formatSource(source, reason);
  // 返回 fragment 包含 span，调用方必须包裹在 <text> 中
  return <span fg={fg}>{text}</span>;
}

interface PersistBadgeProps {
  status: 'saved' | 'skipped' | 'failed' | 'pending' | undefined;
  result?: PersistResult;
}

/** Wiki 持久化状态标签 */
export function PersistBadge({ status, result }: PersistBadgeProps): ReactNode {
  if (!status) return null;

  const { text, fg } = formatPersist(status, result?.reason);
  return <span fg={fg}>{text}</span>;
}

interface CacheBadgeProps {
  status: CacheLoadStatus | null | undefined;
  reason?: string;
}

/** Cache 状态标签（通常只在 header 或调试模式显示） */
export function CacheBadge({ status, reason }: CacheBadgeProps): ReactNode {
  if (!status) return null;

  const { text, fg } = formatCache(status, reason);
  return <span fg={fg}>{text}</span>;
}

// -------- 格式化辅助函数 --------

function formatSource(source: SummaryItem['source'], reason?: string): { text: string; fg: string } {
  switch (source) {
    case 'cache': {
      // 从 reason 解析原始来源，如 "from_ai" -> "CACHE[ai]"
      const origin = reason?.startsWith('from_') ? reason.slice(5) : '';
      const text = origin ? `CACHE[${origin}]` : 'CACHE';
      return { text, fg: colors.status.info };
    }
    case 'wiki':
      return { text: 'WIKI', fg: colors.status.success };
    case 'ai':
      return { text: 'AI', fg: colors.accent.primary };
    case 'fallback': {
      // 简要显示失败原因
      const hint = reason ? `[${truncate(reason, 10)}]` : '';
      return { text: `FALLBACK${hint}`, fg: colors.status.warning };
    }
  }
}

function formatPersist(
  status: 'saved' | 'skipped' | 'failed' | 'pending',
  reason?: string
): { text: string; fg: string } {
  switch (status) {
    case 'saved':
      return { text: 'Wiki SAVED', fg: colors.status.success };
    case 'skipped': {
      // 映射内部 reason 到简短显示
      const shortReason = formatSkipReason(reason);
      return { text: `Wiki SKIP[${shortReason}]`, fg: colors.fg.muted };
    }
    case 'failed':
      return { text: 'Wiki FAIL', fg: colors.status.error };
    case 'pending':
      return { text: 'Wiki ...', fg: colors.status.info };
  }
}

function formatCache(
  status: CacheLoadStatus,
  reason?: string
): { text: string; fg: string } {
  switch (status) {
    case 'hit':
      return { text: 'cache hit', fg: colors.status.success };
    case 'miss':
      return { text: 'cache miss', fg: colors.fg.muted };
    case 'expired':
      return { text: 'cache expired', fg: colors.status.warning };
    case 'corrupted':
      return { text: 'cache bad', fg: colors.status.error };
  }
}

function formatSkipReason(reason?: string): string {
  if (!reason) return '?';
  
  const reasonMap: Record<string, string> = {
    'model_opt_out': 'opt-out',
    'low_value': 'low-value',
    'duplicate': 'dup',
    'missing_summary': 'no-sum',
    'already_persisted': 'exists',
  };
  
  // 检查是否是已知的简短 reason
  for (const [key, value] of Object.entries(reasonMap)) {
    if (reason.includes(key)) return value;
  }
  
  // 否则截断显示
  return truncate(reason, 8);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
