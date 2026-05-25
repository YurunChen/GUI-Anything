import { describe, expect, it } from 'bun:test';

/** Short session label from jsonl path (e.g. `8ab6a37d…`). */
function formatSessionShort(sessionPath: string, maxWidth = 14): string {
  const base = sessionPath.split('/').slice(-1)[0] || sessionPath;
  const id = base.replace(/\.jsonl$/i, '');
  if (id.length <= maxWidth) return id;
  const head = Math.min(8, maxWidth - 1);
  return `${id.slice(0, head)}…`;
}

describe('formatSessionShort', () => {
  it('strips jsonl suffix and truncates long uuids', () => {
    const path = '/Users/me/.claude/projects/foo/8ab6a37d-e53b-48e3-b19c-0123456789ab.jsonl';
    expect(formatSessionShort(path, 10)).toBe('8ab6a37d…');
    expect(formatSessionShort(path, 40)).toBe('8ab6a37d-e53b-48e3-b19c-0123456789ab');
  });

  it('returns placeholder-friendly short ids unchanged', () => {
    expect(formatSessionShort('/tmp/abc.jsonl', 12)).toBe('abc');
  });
});
