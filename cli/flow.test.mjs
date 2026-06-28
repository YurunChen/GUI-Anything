import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { buildFlowEnv, buildFlowScriptArgs, parseFlowArgs } from './lib/flow.mjs';
import { formatDoctorReport } from './lib/doctor.mjs';
import { notifyConfigPath, pairWeChatReceiver, parseNotifyEnv, readNotifyConfig, resolveNotifyReceiver, writeNotifyConfig } from './lib/notify.mjs';

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

test('notify env parser reads quoted values', () => {
  const parsed = parseNotifyEnv('FLOW_NOTIFY_ENABLED="true"\nFLOW_NOTIFY_WECHAT_USER_ID="u@im.wechat"\n');
  assert.equal(parsed.FLOW_NOTIFY_ENABLED, 'true');
  assert.equal(parsed.FLOW_NOTIFY_WECHAT_USER_ID, 'u@im.wechat');
});

test('notify config is written under .flow-runtime and read back', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-'));
  const file = writeNotifyConfig(root, {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'u@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:8765',
  });

  assert.equal(file, notifyConfigPath(root));
  assert.deepEqual(readNotifyConfig(root), {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'u@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:8765',
  });
});

test('buildFlowEnv loads notify config but preserves explicit env overrides', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-flow-env-'));
  writeNotifyConfig(root, {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'saved@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:8765',
  });

  const env = buildFlowEnv(root, {
    FLOW_NOTIFY_WECHAT_USER_ID: 'explicit@im.wechat',
  });

  assert.equal(env.FLOW_NOTIFY_WECHAT_USER_ID, 'explicit@im.wechat');
  assert.equal(env.FLOW_NOTIFY_WECHAT_SERVICE_URL, 'http://127.0.0.1:8765');
});

test('resolveNotifyReceiver only uses explicit receiver config', () => {
  assert.equal(resolveNotifyReceiver({ statusUserId: 'self@im.wechat' }), '');
  assert.equal(
    resolveNotifyReceiver({
      envUserId: 'env@im.wechat',
      configUserId: 'saved@im.wechat',
      statusUserId: 'self@im.wechat',
    }),
    'env@im.wechat',
  );
});

test('pairWeChatReceiver reads paired user id', async () => {
  const server = http.createServer((request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/pair-receiver');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ success: true, user_id: 'paired@im.wechat' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const result = await pairWeChatReceiver({ serviceUrl: `http://127.0.0.1:${port}`, timeoutSeconds: 1 });
    assert.deepEqual(result, { ok: true, userId: 'paired@im.wechat', detail: '' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
