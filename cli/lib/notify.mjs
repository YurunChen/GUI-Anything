import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8765';

export function notifyConfigPath(rootDir) {
  return path.join(rootDir, '.flow-runtime', 'notify.env');
}

export function parseNotifyEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    values[match[1]] = unquoteEnvValue(match[2].trim());
  }
  return values;
}

export function readNotifyConfig(rootDir) {
  const file = notifyConfigPath(rootDir);
  if (!fs.existsSync(file)) return {};
  return parseNotifyEnv(fs.readFileSync(file, 'utf8'));
}

export function writeNotifyConfig(rootDir, values) {
  const file = notifyConfigPath(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = [
    '# GUI-Anything local notification config. Do not commit.',
    `FLOW_NOTIFY_ENABLED=${quoteEnvValue(values.FLOW_NOTIFY_ENABLED ?? 'true')}`,
    `FLOW_NOTIFY_WECHAT_USER_ID=${quoteEnvValue(values.FLOW_NOTIFY_WECHAT_USER_ID ?? '')}`,
    `FLOW_NOTIFY_WECHAT_SERVICE_URL=${quoteEnvValue(values.FLOW_NOTIFY_WECHAT_SERVICE_URL ?? DEFAULT_SERVICE_URL)}`,
    '',
  ];
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Best effort on platforms that do not support chmod.
  }
  return file;
}

export function resolveNotifyReceiver({ envUserId = '', configUserId = '', statusUserId = '' } = {}) {
  return (envUserId || configUserId || '').trim();
}

export async function fetchWeChatStatus(serviceUrl) {
  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/status`);
    if (!response.ok) {
      return { running: true, logged_in: false, error: `HTTP ${response.status}` };
    }
    return { running: true, ...(await response.json()) };
  } catch (error) {
    return {
      running: false,
      logged_in: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendWeChatTest({ serviceUrl, userId }) {
  const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_user_id: userId,
      text: `✅ GUI-Anything WeChat notification test\n\n${new Date().toLocaleString()}`,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    return { ok: false, detail: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  }
  const payload = await response.json();
  return { ok: payload.success === true, detail: payload.message || JSON.stringify(payload) };
}

export async function pairWeChatReceiver({ serviceUrl, timeoutSeconds = 60 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeoutSeconds + 5) * 1000);
  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/pair-receiver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout_seconds: timeoutSeconds }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, detail: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }
    const payload = await response.json();
    return { ok: payload.success === true && Boolean(payload.user_id), userId: payload.user_id || '', detail: payload.message || '' };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

export async function runNotifyCommand({ rootDir, args, stdin = process.stdin, stdout = process.stdout } = {}) {
  const [subcommand = 'help'] = args;
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    stdout.write(formatNotifyHelp());
    return 0;
  }
  if (subcommand === 'setup') return setupNotify({ rootDir, stdin, stdout });
  if (subcommand === 'status') return statusNotify({ rootDir, stdout });
  if (subcommand === 'test') return testNotify({ rootDir, stdout });
  stdout.write(`Unknown notify command: ${subcommand}\n\n${formatNotifyHelp()}`);
  return 2;
}

function formatNotifyHelp() {
  return [
    'ga notify',
    '',
    'Usage:',
    '  ga notify setup    Start WeChat service, log in, save local config, send a test',
    '  ga notify status   Show WeChat notification readiness',
    '  ga notify test     Send a WeChat test message using saved config',
    '',
  ].join('\n');
}

async function setupNotify({ rootDir, stdin, stdout }) {
  const config = readNotifyConfig(rootDir);
  const serviceUrl = process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || config.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || DEFAULT_SERVICE_URL;

  stdout.write('Setting up WeChat notifications...\n');
  let status = await fetchWeChatStatus(serviceUrl);
  stdout.write(status.running ? 'Restarting WeChat service...\n' : 'Starting WeChat service...\n');
  const startResult = spawnSync(path.join(rootDir, 'scripts', 'start-weixin-service.sh'), ['--background', '--restart', '--quiet'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (startResult.status !== 0) return startResult.status ?? 1;
  await sleep(1200);
  status = await fetchWeChatStatus(serviceUrl);

  if (!status.running) {
    stdout.write(`WeChat service is not reachable at ${serviceUrl}.\n`);
    return 1;
  }

  if (!status.logged_in) {
    stdout.write('Scan the QR code with WeChat.\n');
    const result = spawnSync(path.join(rootDir, 'scripts', 'weixin-login.sh'), {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, FLOW_NOTIFY_WECHAT_SERVICE_URL: serviceUrl },
    });
    if (result.status !== 0) return result.status ?? 1;
    status = await fetchWeChatStatus(serviceUrl);
  }

  if (!status.logged_in) {
    stdout.write('WeChat login did not complete.\n');
    return 1;
  }

  const envUserId = process.env.FLOW_NOTIFY_WECHAT_USER_ID || '';
  const configUserId = config.FLOW_NOTIFY_WECHAT_USER_ID || '';
  let userId = resolveNotifyReceiver({ envUserId, configUserId });
  if (!userId) {
    userId = (status.user_id || '').trim();
  }
  if (!userId) {
    userId = await pairReceiverFromWeChat({ serviceUrl, stdin, stdout });
    if (!userId) return 1;
  }
  const testResult = await sendWeChatTest({ serviceUrl, userId });
  if (testResult.ok) {
    writeNotifyConfig(rootDir, {
      FLOW_NOTIFY_ENABLED: 'true',
      FLOW_NOTIFY_WECHAT_USER_ID: userId,
      FLOW_NOTIFY_WECHAT_SERVICE_URL: serviceUrl,
    });
    stdout.write('Saved notification config.\n');
    stdout.write('Test message sent.\n');
    return 0;
  }

  if (envUserId.trim()) {
    stdout.write(`Test message failed: ${testResult.detail}\n`);
    return 1;
  }

  stdout.write('Receiver needs pairing.\n');
  userId = await pairReceiverFromWeChat({ serviceUrl, stdin, stdout });
  if (!userId) return 1;
  const pairedTest = await sendWeChatTest({ serviceUrl, userId });
  if (!pairedTest.ok) {
    stdout.write(`Test message failed: ${pairedTest.detail}\n`);
    return 1;
  }
  writeNotifyConfig(rootDir, {
    FLOW_NOTIFY_ENABLED: 'true',
    FLOW_NOTIFY_WECHAT_USER_ID: userId,
    FLOW_NOTIFY_WECHAT_SERVICE_URL: serviceUrl,
  });
  stdout.write('Saved notification config.\n');
  stdout.write('Test message sent.\n');
  return 0;
}

async function statusNotify({ rootDir, stdout }) {
  const config = readNotifyConfig(rootDir);
  const serviceUrl = process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || config.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || DEFAULT_SERVICE_URL;
  const userId = process.env.FLOW_NOTIFY_WECHAT_USER_ID || config.FLOW_NOTIFY_WECHAT_USER_ID || '';
  const status = await fetchWeChatStatus(serviceUrl);

  stdout.write('WeChat notification status\n');
  stdout.write('--------------------------\n');
  stdout.write(`Config file: ${fs.existsSync(notifyConfigPath(rootDir)) ? notifyConfigPath(rootDir) : 'not created'}\n`);
  stdout.write(`Receiver: ${userId || 'not configured'}\n`);
  stdout.write(`Service: ${status.running ? 'running' : 'not reachable'} (${serviceUrl})\n`);
  stdout.write(`Login: ${status.logged_in ? `logged in${status.account_id ? ` as ${status.account_id}` : ''}` : 'not logged in'}\n`);

  const ready = Boolean(userId && status.running && status.logged_in);
  stdout.write(ready ? '\nReady. `ga flow` will enable the notify hotkey.\n' : '\nNot ready. Run `ga notify setup`.\n');
  return ready ? 0 : 1;
}

async function testNotify({ rootDir, stdout }) {
  const config = readNotifyConfig(rootDir);
  const serviceUrl = process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || config.FLOW_NOTIFY_WECHAT_SERVICE_URL
    || DEFAULT_SERVICE_URL;
  const userId = process.env.FLOW_NOTIFY_WECHAT_USER_ID || config.FLOW_NOTIFY_WECHAT_USER_ID || '';
  if (!userId) {
    stdout.write('WeChat receiver is not configured. Run `ga notify setup`.\n');
    return 1;
  }
  const result = await sendWeChatTest({ serviceUrl, userId });
  stdout.write(result.ok ? 'Test message sent. Check WeChat.\n' : `Test message failed: ${result.detail}\n`);
  return result.ok ? 0 : 1;
}

async function pairReceiverFromWeChat({ serviceUrl, stdin, stdout }) {
  if (!stdin.isTTY) {
    stdout.write('Receiver is not configured. Run `ga notify setup` in an interactive terminal.\n');
    return '';
  }
  await waitForEnter(stdin, stdout, 'Send any WeChat message to the bot, then press Enter.');
  const result = await pairWeChatReceiver({ serviceUrl, timeoutSeconds: 60 });
  if (!result.ok) {
    stdout.write('No WeChat message received. Setup cancelled.\n');
    return '';
  }
  return result.userId.trim();
}

async function waitForEnter(stdin, stdout, message) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    await rl.question(`${message}\n`);
  } finally {
    rl.close();
  }
}

function quoteEnvValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
