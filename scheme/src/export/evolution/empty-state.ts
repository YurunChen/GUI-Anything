/**
 * Placeholder page for a project with no milestones yet (e.g. a brand-new project
 * the first time `ga flow` runs). Self-contained + offline. Includes a meta-refresh
 * so it auto-reloads until the live watcher overwrites it with the real export.
 */

import { escapeHtml } from '../shared/html-utils';
import { observerHtmlLang, resolveObserverLocale } from '../../constants/observer-locale';

export function generateEmptyEvolutionHtml(opts: { workspaceRoot?: string; locale?: string } = {}): string {
  const locale = resolveObserverLocale(opts.locale);
  const zh = locale === 'zh-Hans';
  const text = zh
    ? {
      title: '项目演进史 · 等待第一个里程碑',
      heading: '项目演进史正在等待第一个里程碑',
      line1: '这是一个全新的项目，还没有捕获到任何探索记录。',
      line2: '开始在左侧 Claude 面板里干活吧——当出现第一个意图里程碑时，这一页会自动变成真正的演进时间线。',
      live: '实时监听中',
      refresh: '本页每 5 秒自动刷新',
    }
    : {
      title: 'Project Evolution · Waiting for the first milestone',
      heading: 'Project Evolution is waiting for the first milestone',
      line1: 'This is a new project. No exploration records have been captured yet.',
      line2: 'Start working in the Claude pane. When the first intent milestone appears, this page will become the real evolution timeline.',
      live: 'Watching live',
      refresh: 'This page refreshes every 5 seconds',
    };
  const ws = opts.workspaceRoot ? escapeHtml(opts.workspaceRoot) : '';
  return `<!doctype html>
<html lang="${observerHtmlLang(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="5" />
<title>${escapeHtml(text.title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
    color: #e8eaf0;
    background: radial-gradient(1200px 600px at 50% -10%, #2a3158 0%, #161a2e 45%, #0d1020 100%);
  }
  .card {
    max-width: 560px; padding: 48px 44px; text-align: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.35);
    backdrop-filter: blur(8px);
  }
  .pulse {
    width: 64px; height: 64px; margin: 0 auto 22px; border-radius: 50%;
    background: linear-gradient(135deg, #6c8cff, #9d7bff);
    box-shadow: 0 0 0 0 rgba(108,140,255,0.5);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(108,140,255,0.45); }
    70% { box-shadow: 0 0 0 22px rgba(108,140,255,0); }
    100% { box-shadow: 0 0 0 0 rgba(108,140,255,0); }
  }
  h1 { font-size: 22px; margin: 0 0 10px; font-weight: 650; }
  p { margin: 8px 0; line-height: 1.65; color: #aab1c7; font-size: 14.5px; }
  .ws { margin-top: 18px; font-size: 12.5px; color: #7b86a8; word-break: break-all; }
  .ws code {
    color: #c8cee6; background: rgba(255,255,255,0.06);
    padding: 3px 8px; border-radius: 6px; font-size: 12px;
  }
  .hint { margin-top: 26px; font-size: 12.5px; color: #6f7690; }
  .live { display: inline-flex; align-items: center; gap: 7px; color: #8fa0ff; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #8fa0ff; animation: blink 1.4s infinite; }
  @keyframes blink { 50% { opacity: 0.25; } }
</style>
</head>
<body>
  <main class="card">
    <div class="pulse"></div>
    <h1>${escapeHtml(text.heading)}</h1>
    <p>${escapeHtml(text.line1)}</p>
    <p>${escapeHtml(text.line2)}</p>
    ${ws ? `<p class="ws"><code>${ws}</code></p>` : ''}
    <p class="hint"><span class="live"><span class="dot"></span>${escapeHtml(text.live)}</span> · ${escapeHtml(text.refresh)}</p>
  </main>
</body>
</html>
`;
}
