/**
 * Flow text layout — wrapping + column presets for observer UI.
 * Display width / mixed-script normalization: `utils/flow-text`.
 */

import {
  charDisplayWidth,
  formatFlowText,
  lineDisplayWidth,
} from '../../../utils/flow-text';

export { charDisplayWidth, formatFlowText, lineDisplayWidth };

/** Reserved columns for common observer surfaces. */
export type FlowTextPreset =
  | 'timeline-body'
  | 'wiki-card'
  | 'summary-panel'
  | 'graph-node';

const PRESET_RESERVE: Record<FlowTextPreset, number> = {
  'timeline-body': 14,
  'wiki-card': 12,
  'summary-panel': 8,
  'graph-node': 6,
};

const PRESET_MIN_COLUMNS: Record<FlowTextPreset, number> = {
  'timeline-body': 12,
  'wiki-card': 16,
  'summary-panel': 20,
  'graph-node': 8,
};

/** Estimate content columns from terminal width and UI preset. */
export function contentTextColumns(
  availableWidth: number,
  preset: FlowTextPreset,
  extraReserve = 0,
): number {
  return Math.max(
    PRESET_MIN_COLUMNS[preset],
    availableWidth - PRESET_RESERVE[preset] - extraReserve,
  );
}

/** Timeline row: rail + label prefix + padding. */
export function flowContentColumns(options: {
  availableWidth: number;
  leftGutter?: string;
  labelPrefix?: string;
  reserve?: number;
  min?: number;
}): number {
  const {
    availableWidth,
    leftGutter = '',
    labelPrefix = '',
    reserve = 4,
    min = 12,
  } = options;
  return Math.max(
    min,
    availableWidth - lineDisplayWidth(leftGutter) - lineDisplayWidth(labelPrefix) - reserve,
  );
}

/** @deprecated alias — prefer `contentTextColumns(..., 'summary-panel')`. */
export function summaryTextColumns(availableWidth: number): number {
  return contentTextColumns(availableWidth, 'summary-panel');
}

/** Character-level wrap (low-level). */
export function wrapCharLines(value: string, columns: number): string[] {
  const safeColumns = Math.max(1, columns);
  const output: string[] = [];

  for (const sourceLine of value.split(/\r?\n/)) {
    if (sourceLine.length === 0) {
      output.push('');
      continue;
    }

    let current = '';
    let currentWidth = 0;
    for (const ch of sourceLine) {
      const width = charDisplayWidth(ch);
      if (current && currentWidth + width > safeColumns) {
        output.push(current);
        current = ch;
        currentWidth = width;
        continue;
      }
      current += ch;
      currentWidth += width;
    }
    output.push(current);
  }

  return output.length > 0 ? output : [''];
}

/** Word-aware wrap for mixed CJK / Latin UI copy (height estimates; prefer FlowTextBlock for display). */
export function wrapFlowText(value: string, columns: number): string[] {
  const safeColumns = Math.max(1, columns);
  const output: string[] = [];

  for (const sourceLine of formatFlowText(value).split(/\r?\n/)) {
    const trimmed = sourceLine.trim();
    if (!trimmed) {
      output.push('');
      continue;
    }

    const tokens = expandTokens(trimmed, safeColumns);
    let current = '';
    let currentWidth = 0;

    const flush = () => {
      if (current) {
        output.push(current);
        current = '';
        currentWidth = 0;
      }
    };

    for (const token of tokens) {
      const tokenWidth = lineDisplayWidth(token);
      if (tokenWidth > safeColumns) {
        flush();
        output.push(...wrapCharLines(token, safeColumns).filter(Boolean));
        continue;
      }

      const separator = current ? 1 : 0;
      if (current && currentWidth + separator + tokenWidth > safeColumns) {
        flush();
      }
      current = current ? `${current} ${token}` : token;
      currentWidth = lineDisplayWidth(current);
    }
    flush();
  }

  return output.length > 0 ? output : [''];
}

export function wrapFlowTextInPreset(
  value: string,
  availableWidth: number,
  preset: FlowTextPreset,
  extraReserve = 0,
): string[] {
  return wrapFlowText(value, contentTextColumns(availableWidth, preset, extraReserve));
}

/** Back-compat: user-facing callers should migrate to `wrapFlowText`. */
export function wrapDisplayLines(value: string, columns: number): string[] {
  return wrapFlowText(value, columns);
}

export function summaryTextareaHeight(value: string, availableWidth: number): number {
  return wrapFlowText(value, summaryTextColumns(availableWidth)).length;
}

function expandTokens(line: string, columns: number): string[] {
  const words = line.match(/\S+/g) ?? [];
  const expanded: string[] = [];
  for (const word of words) {
    expanded.push(...splitLongToken(word, columns));
  }
  return expanded;
}

function splitLongToken(token: string, columns: number): string[] {
  if (lineDisplayWidth(token) <= columns) return [token];
  return wrapCharLines(token, columns).filter((line) => line.length > 0);
}
