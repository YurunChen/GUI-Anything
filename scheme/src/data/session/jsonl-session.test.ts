import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractExplorationsFromSession } from './jsonl-session';

describe('extractExplorationsFromSession', () => {
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-jsonl-session-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('starts an exploration for a slash command user event', () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    const lines = [
      {
        type: 'user',
        isMeta: false,
        timestamp: '2026-06-18T06:41:53.786Z',
        message: {
          role: 'user',
          content: '<command-message>code-review</command-message>\n<command-name>/code-review</command-name>',
        },
      },
      {
        type: 'user',
        isMeta: true,
        timestamp: '2026-06-18T06:41:53.786Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'expanded skill prompt' }],
        },
      },
      {
        type: 'assistant',
        timestamp: '2026-06-18T06:42:00.288Z',
        message: {
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'Bash',
              input: { command: 'git diff HEAD --stat' },
            },
          ],
        },
      },
    ];
    fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join('\n'), 'utf-8');

    const explorations = extractExplorationsFromSession(filePath);

    expect(explorations).toHaveLength(1);
    expect(explorations[0].question).toBe('/code-review');
    expect(explorations[0].nodes).toHaveLength(1);
    expect(explorations[0].nodes[0].rawCommand).toBe('git diff HEAD --stat');
  });

  it('derives file activity summaries from tool calls and results', () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    const lines = [
      {
        type: 'user',
        isMeta: false,
        timestamp: '2026-06-18T06:41:53.786Z',
        message: { role: 'user', content: 'Add workspace mode' },
      },
      {
        type: 'assistant',
        timestamp: '2026-06-18T06:42:00.288Z',
        message: {
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_read',
              name: 'Read',
              input: { file_path: 'docs/development.md', offset: 10, limit: 5 },
            },
            {
              type: 'tool_use',
              id: 'toolu_edit',
              name: 'Edit',
              input: {
                file_path: 'scheme/src/app/ui/flow/WorkspaceView.tsx',
                old_string: 'one\ntwo',
                new_string: 'one\ntwo\nthree',
              },
            },
          ],
        },
      },
      {
        type: 'user',
        isMeta: true,
        timestamp: '2026-06-18T06:42:02.000Z',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_read', content: 'ok' },
            { type: 'tool_result', tool_use_id: 'toolu_edit', content: 'ok' },
          ],
        },
      },
    ];
    fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join('\n'), 'utf-8');

    const nodes = extractExplorationsFromSession(filePath)[0].nodes;

    expect(nodes[0].fileActivity).toEqual({
      action: 'read',
      status: 'ok',
      path: 'docs/development.md',
      summary: 'docs/development.md - lines 10-14',
    });
    expect(nodes[1].fileActivity).toEqual({
      action: 'edit',
      status: 'ok',
      path: 'scheme/src/app/ui/flow/WorkspaceView.tsx',
      summary: 'ui/flow/WorkspaceView.tsx - 2 -> 3 lines',
    });
  });

  it('uses common bash command targets as workspace activity paths', () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    const lines = [
      {
        type: 'user',
        isMeta: false,
        timestamp: '2026-06-18T06:41:53.786Z',
        message: { role: 'user', content: 'Inspect the project' },
      },
      {
        type: 'assistant',
        timestamp: '2026-06-18T06:42:00.288Z',
        message: {
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_ls',
              name: 'Bash',
              input: {
                command: 'ls /Users/yurunchen/project/Method/GUI-Anything/scheme/src',
                description: 'List scheme source directory',
              },
            },
            {
              type: 'tool_use',
              id: 'toolu_find',
              name: 'Bash',
              input: {
                command: 'find /Users/yurunchen/project/Method/GUI-Anything/docs -maxdepth 2 -type f',
                description: 'Show docs tree',
              },
            },
            {
              type: 'tool_use',
              id: 'toolu_rg',
              name: 'Bash',
              input: {
                command: 'rg -n "workspace" scheme/src/app',
                description: 'Search workspace UI',
              },
            },
          ],
        },
      },
    ];
    fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join('\n'), 'utf-8');

    const nodes = extractExplorationsFromSession(filePath)[0].nodes;

    expect(nodes[0].fileActivity?.path).toBe('/Users/yurunchen/project/Method/GUI-Anything/scheme/src');
    expect(nodes[1].fileActivity?.path).toBe('/Users/yurunchen/project/Method/GUI-Anything/docs');
    expect(nodes[2].fileActivity?.path).toBe('scheme/src/app');
  });
});
