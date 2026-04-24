/**
 * ABOUTME: Shared string utilities for scheme5.
 */

export function truncate(text: string, max: number, ellipsis: string = '…'): string {
  return text.length > max ? text.slice(0, max) + ellipsis : text;
}

export function toPreview(input: unknown, max = 70): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') {
    const normalized = input.replace(/\s+/g, ' ').trim();
    return truncate(normalized, max);
  }
  try {
    const normalized = JSON.stringify(input).replace(/\s+/g, ' ').trim();
    return truncate(normalized, max);
  } catch {
    return '[unserializable]';
  }
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
