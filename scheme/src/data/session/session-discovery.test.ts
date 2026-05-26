import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { projectDir } from './claude-project';
import { resolveSessionBinding } from './session-discovery';

describe('session-discovery', () => {
  it('bind_specific returns null when jsonl missing', () => {
    const cwd = os.tmpdir();
    const result = resolveSessionBinding({
      cwd,
      mode: 'bind_specific',
      explicitSessionId: '00000000-0000-0000-0000-000000000099',
    });
    expect(result).toBeNull();
  });

  it('continue_picker detects mtime delta', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-home-'));
    const prevHome = process.env.HOME;
    process.env.HOME = home;
    try {
      const workspace = path.join(home, 'proj');
      fs.mkdirSync(workspace, { recursive: true });
      const dir = projectDir(workspace);
      fs.mkdirSync(dir, { recursive: true });
      const sessionPath = path.join(dir, 'sess-delta.jsonl');
      fs.writeFileSync(sessionPath, '{"type":"user","message":{"content":"hi"}}\n');
      const baselineMtime = fs.statSync(sessionPath).mtimeMs;

      const before = resolveSessionBinding({
        cwd: workspace,
        mode: 'continue_picker',
        baselineMtimes: new Map([['sess-delta', baselineMtime]]),
      });
      expect(before).toBeNull();

      fs.appendFileSync(sessionPath, '{"type":"assistant","message":{"content":[]}}\n');
      const bumped = fs.statSync(sessionPath).mtimeMs;
      if (bumped <= baselineMtime) {
        const at = new Date(baselineMtime + 1000);
        fs.utimesSync(sessionPath, at, at);
      }
      const after = resolveSessionBinding({
        cwd: workspace,
        mode: 'continue_picker',
        baselineMtimes: new Map([['sess-delta', baselineMtime]]),
      });
      expect(after?.sessionId).toBe('sess-delta');
      expect(after?.source).toBe('delta');
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
