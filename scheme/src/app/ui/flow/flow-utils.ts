/**
 * Flow Observer utility functions
 * Pure functions for data extraction and formatting
 */

import type { Exploration, ExplorationNode } from '../../../data/protocol/observer-protocol';

/**
 * Extract shell commands from exploration nodes
 */
export function extractCommandsFromNodes(nodes: ExplorationNode[]): string[] {
  const values = nodes
    .filter((n: ExplorationNode) => n.type === 'tool')
    .map((n: ExplorationNode) => {
      if (typeof n.rawCommand === 'string' && n.rawCommand.trim().length > 0) {
        return n.rawCommand.trim();
      }
      return typeof n.label === 'string' ? n.label.trim() : '';
    })
    .filter((v: string) => v.length > 0);
  return [...new Set(values)].slice(0, 5);
}

/**
 * Extract file paths from exploration nodes (regex-based)
 */
export function extractPathsFromNodes(nodes: ExplorationNode[]): string[] {
  const paths = new Set<string>();
  for (const n of nodes) {
    if (!n.label) continue;
    const matches = n.label.match(/([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g);
    if (!matches) continue;
    for (const p of matches) paths.add(p);
  }
  return [...paths].slice(0, 8);
}

/**
 * Format token count in compact form (k/M), aligned with claude-hud
 */
export function formatCompactTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k`;
  }
  return n.toString();
}

/**
 * Get context window token usage (input + cache), aligned with claude-hud
 * This represents tokens in the context window, not output tokens
 */
export function getContextWindowTokens(stats: {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): number {
  return stats.inputTokens + stats.cacheReadTokens + stats.cacheWriteTokens;
}

/**
 * Safe shell escaping for single-quoted strings
 */
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
