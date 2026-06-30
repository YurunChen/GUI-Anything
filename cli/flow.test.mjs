import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { buildFlowEnv, buildFlowScriptArgs, parseFlowArgs } from './lib/flow.mjs';
import { formatDoctorReport } from './lib/doctor.mjs';
import { DEFAULT_WECHAT_SERVICE_URL, isLocalWechatServiceHost, notifyConfigPath, pairWeChatReceiver, parseNotifyEnv, readNotifyConfig, resolveNotifyReceiver, resolveWechatServiceEndpoint, resolveWechatServiceUrl, runNotifyCommand, wechatCredentialDir, writeNotifyConfig } from './lib/notify.mjs';
import { resolveWorkspaceDir } from './lib/workspace.mjs';

test('parseFlowArgs parses continue mode with model and prompt', () => {
  const options = parseFlowArgs(['--continue', '--model', 'sonnet', 'hello', 'world']);
  assert.equal(options.mode, 'continue');
  assert.equal(options.model, 'sonnet');
  assert.deepEqual(options.promptArgs, ['hello', 'world']);
  assert.equal(options.watch, false);
  assert.equal(options.open, false);
});

test('parseFlowArgs parses resume mode with optional session id', () => {
  const withId = parseFlowArgs(['--resume', 'abc123']);
  assert.equal(withId.mode, 'resume');
  assert.equal(withId.resumeId, 'abc123');

  const noId = parseFlowArgs(['--resume']);
  assert.equal(noId.mode, 'resume');
  assert.equal(noId.resumeId, '');
});

test('parseFlowArgs keeps the browser sidecar opt-in', () => {
  const base = parseFlowArgs([]);
  assert.equal(base.watch, false);
  assert.equal(base.open, false);

  const watchOnly = parseFlowArgs(['--watch']);
  assert.equal(watchOnly.watch, true);
  assert.equal(watchOnly.open, false);

  const open = parseFlowArgs(['--open']);
  assert.equal(open.watch, true);
  assert.equal(open.open, true);

  const disabled = parseFlowArgs(['--watch', '--open', '--no-watch']);
  assert.equal(disabled.watch, false);
  assert.equal(disabled.open, false);
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

test('resolveWechatServiceUrl uses URL before host and port', () => {
  assert.equal(
    resolveWechatServiceUrl({
      env: {
        FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:7777',
        FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
      },
    }),
    'http://127.0.0.1:7777',
  );
  assert.equal(
    resolveWechatServiceUrl({
      env: {
        FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:7777/',
      },
    }),
    'http://127.0.0.1:7777',
  );
});

test('resolveWechatServiceUrl builds URL from host and port overrides', () => {
  assert.equal(
    resolveWechatServiceUrl({
      env: {
        FLOW_NOTIFY_WECHAT_SERVICE_HOST: '0.0.0.0',
        FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
      },
    }),
    'http://0.0.0.0:9999',
  );
  assert.equal(
    resolveWechatServiceUrl({
      env: {
        FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
      },
    }),
    'http://127.0.0.1:9999',
  );
});

test('resolveWechatServiceEndpoint derives the bind endpoint from the resolved URL', () => {
  assert.deepEqual(
    resolveWechatServiceEndpoint('http://192.168.1.12:9999'),
    { host: '192.168.1.12', port: '9999' },
  );
  assert.deepEqual(
    resolveWechatServiceEndpoint('http://localhost:7777'),
    { host: 'localhost', port: '7777' },
  );
});

test('isLocalWechatServiceHost only treats loopback bind hosts as local', () => {
  assert.equal(isLocalWechatServiceHost('localhost'), true);
  assert.equal(isLocalWechatServiceHost('127.0.0.1'), true);
  assert.equal(isLocalWechatServiceHost('0.0.0.0'), true);
  assert.equal(isLocalWechatServiceHost('::1'), true);
  assert.equal(isLocalWechatServiceHost('weixin.example.test'), false);
  assert.equal(isLocalWechatServiceHost('192.168.1.20'), false);
});

test('notify config is written under .flow-runtime and read back', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-'));
  const file = writeNotifyConfig(root, {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'u@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: DEFAULT_WECHAT_SERVICE_URL,
  });

  assert.equal(file, notifyConfigPath(root));
  assert.deepEqual(readNotifyConfig(root), {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'u@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: DEFAULT_WECHAT_SERVICE_URL,
  });
});

test('buildFlowEnv loads notify config but preserves explicit env overrides', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-flow-env-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-flow-workspace-'));
  writeNotifyConfig(root, {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: 'saved@im.wechat',
    FLOW_NOTIFY_WECHAT_SERVICE_URL: DEFAULT_WECHAT_SERVICE_URL,
  });

  const env = buildFlowEnv(root, {
    FLOW_NOTIFY_WECHAT_USER_ID: 'explicit@im.wechat',
  }, workspace);

  assert.equal(env.FLOW_NOTIFY_WECHAT_USER_ID, 'explicit@im.wechat');
  assert.equal(env.FLOW_NOTIFY_WECHAT_SERVICE_URL, DEFAULT_WECHAT_SERVICE_URL);
  assert.equal(env.FLOW_PROJECT_DIR, workspace);
  assert.equal(env.FLOW_ROOT_DIR, workspace);
});

test('resolveWorkspaceDir defaults to the invocation cwd', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workspace-cwd-'));
  assert.equal(resolveWorkspaceDir({ cwd: workspace, env: {} }), fs.realpathSync(workspace));
});

test('resolveWorkspaceDir uses FLOW_PROJECT_DIR and ignores FLOW_ROOT_DIR', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workspace-cwd-'));
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workspace-legacy-root-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workspace-env-'));

  assert.equal(
    resolveWorkspaceDir({ cwd, env: { FLOW_PROJECT_DIR: workspace, FLOW_ROOT_DIR: legacyRoot } }),
    fs.realpathSync(workspace),
  );
  assert.equal(
    resolveWorkspaceDir({ cwd, env: { FLOW_ROOT_DIR: legacyRoot } }),
    fs.realpathSync(cwd),
  );
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

test('notify clean removes saved config and WeChat credentials', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-clean-'));
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ service: 'not-weixin-notification' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    writeNotifyConfig(root, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: 'saved@im.wechat',
      FLOW_NOTIFY_WECHAT_SERVICE_URL: `http://127.0.0.1:${port}`,
    });

    const dataDir = wechatCredentialDir(root);
    fs.mkdirSync(dataDir, { recursive: true });
    const credentialFile = path.join(dataDir, 'bot@im.bot.json');
    const nonCredentialFile = path.join(dataDir, 'README.txt');
    fs.writeFileSync(credentialFile, '{}');
    fs.writeFileSync(nonCredentialFile, 'keep');

    let output = '';
    const code = await runNotifyCommand({
      rootDir: root,
      args: ['clean'],
      stdout: { write: (chunk) => { output += chunk; } },
    });

    assert.equal(code, 0);
    assert.equal(fs.existsSync(notifyConfigPath(root)), false);
    assert.equal(fs.existsSync(credentialFile), false);
    assert.equal(fs.existsSync(nonCredentialFile), true);
    assert.match(output, /Removed notify config/);
    assert.match(output, /Removed WeChat credential file\(s\): 1/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notify clean skips process stopping for remote service URLs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-remote-clean-'));
  try {
    writeNotifyConfig(root, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: 'saved@im.wechat',
      FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://weixin.example.test:8765',
    });

    let output = '';
    const code = await runNotifyCommand({
      rootDir: root,
      args: ['clean'],
      stdout: { write: (chunk) => { output += chunk; } },
    });

    assert.equal(code, 0);
    assert.equal(fs.existsSync(notifyConfigPath(root)), false);
    assert.match(output, /Remote WeChat service configured; skipped local process stop/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notify setup does not use status user id as receiver', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-pair-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scripts', 'start-weixin-service.sh'),
    '#!/usr/bin/env bash\nexit 0\n',
    { mode: 0o755 },
  );

  const sendTargets = [];
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/status') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        logged_in: true,
        account_id: 'bot@im.bot',
        user_id: 'status-user@im.wechat',
      }));
      return;
    }
    if (request.method === 'POST' && request.url === '/pair-receiver') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, user_id: 'paired@im.wechat' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/send') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        sendTargets.push(JSON.parse(body).to_user_id);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: 'accepted' }));
      });
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    writeNotifyConfig(root, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: '',
      FLOW_NOTIFY_WECHAT_SERVICE_URL: `http://127.0.0.1:${port}`,
    });

    let output = '';
    const code = await runNotifyCommand({
      rootDir: root,
      args: ['setup'],
      stdin: { isTTY: false },
      stdout: { write: (chunk) => { output += chunk; } },
    });

    assert.equal(code, 1);
    assert.deepEqual(sendTargets, []);
    assert.equal(readNotifyConfig(root).FLOW_NOTIFY_WECHAT_USER_ID, '');
    assert.match(output, /Receiver needs pairing/);
    assert.match(output, /interactive terminal/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notify setup prompts users to send the pairing message after waiting starts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-interactive-pair-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scripts', 'start-weixin-service.sh'),
    '#!/usr/bin/env bash\nexit 0\n',
    { mode: 0o755 },
  );

  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/status') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ logged_in: true, account_id: 'bot@im.bot' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/pair-receiver') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, user_id: 'paired@im.wechat' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/send') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, message: 'accepted' }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    writeNotifyConfig(root, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: '',
      FLOW_NOTIFY_WECHAT_SERVICE_URL: `http://127.0.0.1:${port}`,
    });
    const stdin = new PassThrough();
    stdin.isTTY = true;
    setTimeout(() => stdin.write('\n'), 10);

    let output = '';
    const code = await runNotifyCommand({
      rootDir: root,
      args: ['setup'],
      stdin,
      stdout: { write: (chunk) => { output += chunk; } },
    });

    assert.equal(code, 0);
    assert.equal(readNotifyConfig(root).FLOW_NOTIFY_WECHAT_USER_ID, 'paired@im.wechat');
    assert.match(output, /Press Enter, then send any WeChat message/);
    assert.match(output, /Waiting for the next WeChat message/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notify setup does not pair again when a configured receiver send fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-notify-configured-fail-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scheme', 'src', 'services', 'notification', 'weixin-service', 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scripts', 'start-weixin-service.sh'),
    '#!/usr/bin/env bash\nexit 0\n',
    { mode: 0o755 },
  );
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/status') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ logged_in: true, account_id: 'bot@im.bot' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/send') {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ detail: 'stale token' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/pair-receiver') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, user_id: 'paired@im.wechat' }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    writeNotifyConfig(root, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: 'saved@im.wechat',
      FLOW_NOTIFY_WECHAT_SERVICE_URL: `http://127.0.0.1:${port}`,
    });
    let output = '';
    const code = await runNotifyCommand({
      rootDir: root,
      args: ['setup'],
      stdin: { isTTY: false },
      stdout: { write: (chunk) => { output += chunk; } },
    });

    assert.equal(code, 1);
    assert.match(output, /Test message failed/);
    assert.match(output, /stale/);
    assert.doesNotMatch(output, /Receiver needs pairing/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
