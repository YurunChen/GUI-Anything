import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  peekSessionActivity,
  projectDir,
  resolveSessionByPrefix,
} from './claude-project';

describe('claude-project', () => {
  it('peekSessionActivity detects user turn in head', () => {
    const file = path.join(os.tmpdir(), `peek-${Date.now()}.jsonl`);
    fs.writeFileSync(file, '{"type":"user","message":{"content":"hello"}}\n');
    const activity = peekSessionActivity(file);
    expect(activity.hasUserTurn).toBe(true);
    fs.unlinkSync(file);
  });

  it('peekSessionActivity reports empty shell', () => {
    const file = path.join(os.tmpdir(), `peek-empty-${Date.now()}.jsonl`);
    fs.writeFileSync(file, '');
    const activity = peekSessionActivity(file);
    expect(activity.hasUserTurn).toBe(false);
    fs.unlinkSync(file);
  });

  it('resolveSessionByPrefix returns ambiguous for multiple matches', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-prefix-'));
    const prevHome = process.env.HOME;
    process.env.HOME = home;
    try {
      const workspace = path.join(home, 'proj');
      fs.mkdirSync(workspace, { recursive: true });
      const dir = projectDir(workspace);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'abc-111.jsonl'), '{"type":"user","message":{"content":"a"}}\n');
      fs.writeFileSync(path.join(dir, 'abc-222.jsonl'), '{"type":"user","message":{"content":"b"}}\n');
      const result = resolveSessionByPrefix('abc', workspace);
      expect(result.status).toBe('ambiguous');
      if (result.status === 'ambiguous') {
        expect(result.candidates.length).toBe(2);
      }
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
