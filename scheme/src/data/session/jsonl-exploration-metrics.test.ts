import { describe, expect, it } from 'bun:test';
import { extractExplorationsFromSession } from './jsonl-session';
import { buildCardMetaFromExploration } from '../wiki/session-bundle-mappers';

/** Build a JSONL string from entry objects (one JSON per line). */
function jsonl(entries: unknown[]): string {
  return entries.map((e) => JSON.stringify(e)).join('\n');
}

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:00:05.000Z';
const T2 = '2026-01-01T00:00:09.000Z';

describe('extractExplorationsFromSession — token/file footprint (P-extra)', () => {
  it('captures tokens (deduped by message id) and distinct file paths', () => {
    const content = jsonl([
      { type: 'user', timestamp: T0, message: { content: [{ type: 'text', text: '帮我改个文件' }] } },
      {
        type: 'assistant',
        timestamp: T1,
        uuid: 'u1',
        message: {
          id: 'msg_1',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 10,
            cache_creation_input_tokens: 5,
          },
          content: [
            { type: 'tool_use', id: 'tu1', name: 'Edit', input: { file_path: '/repo/a.ts' } },
            { type: 'tool_use', id: 'tu2', name: 'Read', input: { file_path: '/repo/a.ts' } },
            { type: 'tool_use', id: 'tu3', name: 'Write', input: { file_path: '/repo/b.ts' } },
          ],
        },
      },
      // Duplicate assistant message id → usage must NOT be double counted.
      {
        type: 'assistant',
        timestamp: T1,
        uuid: 'u1',
        message: { id: 'msg_1', usage: { input_tokens: 999, output_tokens: 999 }, content: [] },
      },
      { type: 'result', timestamp: T2 },
    ]);

    const explorations = extractExplorationsFromSession('dummy.jsonl', content);
    expect(explorations).toHaveLength(1);
    const exp = explorations[0];

    expect(exp.tokens).toBe(165); // 100+50+10+5, duplicate id ignored
    expect(exp.files?.sort()).toEqual(['/repo/a.ts', '/repo/b.ts']); // deduped
  });

  it('propagates tokens/files/durationMs into card meta', () => {
    const content = jsonl([
      { type: 'user', timestamp: T0, message: { content: [{ type: 'text', text: '做点事' }] } },
      {
        type: 'assistant',
        timestamp: T1,
        message: {
          id: 'msg_x',
          usage: { input_tokens: 20, output_tokens: 30 },
          content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { path: '/repo/c.ts' } }],
        },
      },
      { type: 'result', timestamp: T2 },
    ]);

    const exp = extractExplorationsFromSession('dummy.jsonl', content)[0];
    const meta = buildCardMetaFromExploration(exp);
    expect(meta?.tokens).toBe(50);
    expect(meta?.files).toEqual(['/repo/c.ts']);
    expect(meta?.durationMs).toBe(9000); // T2 - T0
  });
});
