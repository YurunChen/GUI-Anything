import fs from 'node:fs';
import path from 'node:path';
import { readNotifyConfig } from './notify.mjs';

function commandExists(command) {
  const pathValue = process.env.PATH ?? '';
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${command}${ext}`);
      if (fs.existsSync(candidate)) return true;
    }
  }
  return false;
}

function isWritableDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveClaudeHome() {
  const home = process.env.HOME;
  if (!home) return null;
  return path.join(home, '.claude');
}

function claudeAuthHint() {
  const claudeHome = resolveClaudeHome();
  if (!claudeHome) return { ok: false, detail: 'HOME is not set', fix: 'Set HOME and run again.' };

  const credentialsPath = path.join(claudeHome, '.credentials.json');
  if (fs.existsSync(credentialsPath)) {
    return { ok: true, detail: 'credentials file found', fix: '' };
  }

  return {
    ok: false,
    detail: 'credentials file not found',
    fix: 'Run `claude` once and complete login before `ga flow`.',
  };
}

export function runDoctor({ rootDir, notifyRootDir } = {}) {
  const projectRoot = rootDir ?? process.cwd();
  const wikiDir = path.join(projectRoot, 'wiki');
  const sessionIndexPath = path.join(wikiDir, 'sessions', '_index.json');
  const notifyConfig = readNotifyConfig(notifyRootDir ?? projectRoot);
  const notifyUserId = process.env.FLOW_NOTIFY_WECHAT_USER_ID || notifyConfig.FLOW_NOTIFY_WECHAT_USER_ID || '';

  const auth = claudeAuthHint();

  const checks = [
    {
      id: 'claude',
      label: 'Claude CLI',
      required: true,
      ok: commandExists('claude'),
      detail: commandExists('claude') ? 'available in PATH' : 'not found in PATH',
      fix: 'Install Claude Code CLI and ensure `claude` is in PATH.',
    },
    {
      id: 'claude-auth',
      label: 'Claude auth readiness',
      required: false,
      ok: auth.ok,
      detail: auth.detail,
      fix: auth.fix,
    },
    {
      id: 'bun',
      label: 'Bun runtime',
      required: true,
      ok: commandExists('bun'),
      detail: commandExists('bun') ? 'available in PATH' : 'not found in PATH',
      fix: 'Install Bun from https://bun.sh and ensure `bun` is in PATH.',
    },
    {
      id: 'zellij',
      label: 'Zellij terminal multiplexer',
      required: true,
      ok: commandExists('zellij'),
      detail: commandExists('zellij') ? 'available in PATH' : 'not found in PATH',
      fix: 'Install zellij (e.g. brew install zellij).',
    },
    {
      id: 'wiki-dir',
      label: 'Writable wiki directory',
      required: true,
      ok: isWritableDir(wikiDir),
      detail: wikiDir,
      fix: `Ensure write permission for ${wikiDir}.`,
    },
    {
      id: 'session-index',
      label: 'Session index (optional)',
      required: false,
      ok: true,
      detail: fs.existsSync(sessionIndexPath)
        ? sessionIndexPath
        : 'not created yet (run flow once)',
      fix: 'Run `ga flow` to create wiki/sessions/_index.json.',
    },
    {
      id: 'wechat-notify',
      label: 'WeChat notifications (optional)',
      required: false,
      ok: Boolean(notifyUserId),
      detail: notifyUserId ? 'configured' : 'not configured',
      fix: 'Run `ga notify setup` to enable WeChat notifications.',
    },
  ];

  const ok = checks.every((check) => !check.required || check.ok);
  return { ok, checks };
}

export function formatDoctorReport(report) {
  const lines = [];
  lines.push('ga doctor');
  lines.push('---------');
  for (const check of report.checks) {
    const marker = check.ok ? 'OK' : check.required ? 'FAIL' : 'WARN';
    lines.push(`${marker.padEnd(5)} ${check.label} - ${check.detail}`);
    if (!check.ok && check.fix) {
      lines.push(`      fix: ${check.fix}`);
    }
  }
  lines.push('');
  const hasWarnings = report.checks.some((check) => !check.ok && !check.required);
  lines.push(report.ok
    ? (hasWarnings ? 'Environment is ready with warnings.' : 'Environment is ready.')
    : 'Environment is not ready.');
  return lines.join('\n');
}
