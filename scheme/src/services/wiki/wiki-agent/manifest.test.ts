import { describe, expect, it } from 'bun:test';
import { parseWikiAgentManifest } from './manifest';

describe('parseWikiAgentManifest', () => {
  it('parses update manifest with files_written', () => {
    const raw = `Done writing files.

{"action":"update","target_id":"C001","files_written":["knowledge/contexts/C001-slug.md"],"reason":"merged new facts"}`;
    const m = parseWikiAgentManifest(raw);
    expect(m?.action).toBe('update');
    expect(m?.target_id).toBe('C001');
    expect(m?.files_written?.[0]).toContain('C001');
  });

  it('parses skip manifest', () => {
    const m = parseWikiAgentManifest('{"action":"skip","reason":"greeting"}');
    expect(m?.action).toBe('skip');
    expect(m?.reason).toBe('greeting');
  });

  it('rejects update without target or files', () => {
    const m = parseWikiAgentManifest('{"action":"update","reason":"oops"}');
    expect(m).toBeNull();
  });

  it('accepts create with files_written only', () => {
    const m = parseWikiAgentManifest(
      '{"action":"create","files_written":["knowledge/contexts/C002-new.md"],"reason":"new"}',
    );
    expect(m?.action).toBe('create');
  });

  it('rejects create without files_written', () => {
    const m = parseWikiAgentManifest('{"action":"create","reason":"missing paths"}');
    expect(m).toBeNull();
  });
});
