import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportScriptArgs, parseExportArgs } from './lib/export.mjs';

test('parseExportArgs parses supported export options', () => {
  const options = parseExportArgs([
    '-o',
    'out.html',
    '--theme',
    'mono',
    '--session-id',
    'sess-1',
    '--scope',
    'session',
    '--no-ai',
    '--watch',
  ]);

  assert.deepEqual(options, {
    mode: 'run',
    output: 'out.html',
    theme: 'mono',
    sessionId: 'sess-1',
    scope: 'session',
    noAi: true,
    watch: true,
  });
});

test('parseExportArgs rejects missing option values', () => {
  assert.throws(() => parseExportArgs(['--output']), /Missing value for --output/);
  assert.throws(() => parseExportArgs(['--theme', '--watch']), /Missing value for --theme/);
});

test('parseExportArgs rejects invalid scope values', () => {
  assert.throws(() => parseExportArgs(['--scope', 'workspace']), /Invalid value for --scope: workspace/);
});

test('buildExportScriptArgs includes validated scope and session flags', () => {
  const args = buildExportScriptArgs({
    mode: 'run',
    output: '',
    theme: '',
    sessionId: 'sess-1',
    scope: 'session',
    noAi: true,
    watch: false,
  }, '/repo');

  assert.deepEqual(args, [
    'run',
    'src/main.ts',
    '--export-html',
    '-o',
    '/repo/wiki/knowledge/outputs/evolution.html',
    '--no-ai',
    '--session-id',
    'sess-1',
    '--scope',
    'session',
  ]);
});
