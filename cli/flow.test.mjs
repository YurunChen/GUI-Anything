import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowScriptArgs, parseFlowArgs } from './lib/flow.mjs';
import { formatDoctorReport } from './lib/doctor.mjs';

test('parseFlowArgs parses continue mode with model and prompt', () => {
  const options = parseFlowArgs(['--continue', '--model', 'sonnet', 'hello', 'world']);
  assert.equal(options.mode, 'continue');
  assert.equal(options.model, 'sonnet');
  assert.deepEqual(options.promptArgs, ['hello', 'world']);
});

test('parseFlowArgs parses resume mode with optional session id', () => {
  const withId = parseFlowArgs(['--resume', 'abc123']);
  assert.equal(withId.mode, 'resume');
  assert.equal(withId.resumeId, 'abc123');

  const noId = parseFlowArgs(['--resume']);
  assert.equal(noId.mode, 'resume');
  assert.equal(noId.resumeId, '');
});

test('buildFlowScriptArgs includes only relevant flags', () => {
  const args = buildFlowScriptArgs({
    mode: 'resume',
    resumeId: 'sess-1',
    model: 'opus',
    promptArgs: ['summarize', 'repo'],
  });
  assert.deepEqual(args, ['--resume', 'sess-1', '--model', 'opus', 'summarize', 'repo']);
});

test('formatDoctorReport includes actionable failure hints', () => {
  const output = formatDoctorReport({
    ok: false,
    checks: [
      {
        label: 'Claude CLI',
        required: false,
        ok: false,
        detail: 'not found in PATH',
        fix: 'Install Claude Code CLI',
      },
    ],
  });

  assert.match(output, /WARN\s+Claude CLI/);
  assert.match(output, /fix: Install Claude Code CLI/);
});
