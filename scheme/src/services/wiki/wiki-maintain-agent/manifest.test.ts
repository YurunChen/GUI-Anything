import { describe, expect, it } from 'bun:test';
import { parseWikiMaintainManifest } from './manifest';

describe('parseWikiMaintainManifest', () => {
  it('parses apply with audits_resolved only', () => {
    const raw = '{"action":"apply","reason":"fixed","audits_resolved":["2026-a-C001.md"]}';
    const m = parseWikiMaintainManifest(raw);
    expect(m?.action).toBe('apply');
    expect(m?.audits_resolved).toEqual(['2026-a-C001.md']);
  });

  it('parses skip', () => {
    const m = parseWikiMaintainManifest('{"action":"skip","reason":"nothing to do"}');
    expect(m?.action).toBe('skip');
  });

  it('rejects apply with no work items', () => {
    const m = parseWikiMaintainManifest('{"action":"apply","reason":"empty"}');
    expect(m).toBeNull();
  });
});
