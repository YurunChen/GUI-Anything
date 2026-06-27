/**
 * Project Evolution HTML — template assembler.
 * Inlines CSS + client JS + view-model JSON + all themes into one self-contained file.
 */

import { getEvolutionStyles } from './styles';
import { getEvolutionClientScript } from './client';
import { escapeHtml, escapeJsonForScript } from '../shared/html-utils';
import { themesToEmbeddableJson } from '../shared/theme-to-css';
import { themes } from '../../app/ui/themes/index';
import type { EvolutionExport } from '../../data/protocol/evolution-types';

const DEFAULT_THEME = 'apple-system-light';

export function generateEvolutionHtml(data: EvolutionExport): string {
  const css = getEvolutionStyles();
  const js = getEvolutionClientScript();
  const jsonData = JSON.stringify(data);
  const themeData = themesToEmbeddableJson(themes);
  const initialTheme = data.theme && themes[data.theme as keyof typeof themes] ? data.theme : DEFAULT_THEME;
  const nodeCount = data.project.nodes.length;
  const sessionCount = data.sessions.length;

  const options = Object.keys(themes)
    .map((name) => `<option value="${name}"${name === initialTheme ? ' selected' : ''}>${name}</option>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>项目功能演进史</title>
  <style>${css}</style>
</head>
<body>
  <div class="evo-aurora" aria-hidden="true">
    <span class="evo-aurora__blob evo-aurora__blob--1"></span>
    <span class="evo-aurora__blob evo-aurora__blob--2"></span>
    <span class="evo-aurora__blob evo-aurora__blob--3"></span>
    <span class="evo-aurora__blob evo-aurora__blob--4"></span>
  </div>
  <div class="evo-app" id="app">
    <div class="evo-topbar">
      <nav class="evo-crumb">
        <span class="evo-crumb__root">项目演进</span>
        <span class="evo-crumb__sep">▸</span>
        <span class="evo-crumb__cur">项目演进总览</span>
      </nav>
      <div class="evo-theme">
        <select id="theme-select" title="切换主题 ([ / ])">${options}</select>
      </div>
    </div>

    <nav class="evo-tabs" id="evo-tabs" hidden></nav>

    <div class="evo-tabpanels" id="evo-tabpanels">
      <section class="evo-tab is-on" id="tab-main" data-tab="main">
        <div class="evo-view is-on" id="view-project"></div>
      </section>
      <section class="evo-tab" id="tab-knowledge" data-tab="knowledge"></section>
      <section class="evo-tab" id="tab-persona" data-tab="persona"></section>
    </div>

    <div class="evo-footer">
      <div class="evo-footer__line">
        GUI-Anything · 项目功能演进史 v${escapeHtml(data.version)} ·
        ${nodeCount} 个里程碑 / ${sessionCount} 个 session ·
        ${data.aiUsed ? 'AI 合成主线' : '规则合成主线'}
      </div>
      <div class="evo-footer__prov" id="evo-prov"></div>
      <div class="evo-footer__keys">
        <kbd>j</kbd>/<kbd>k</kbd> 切节点 · <kbd>[</kbd>/<kbd>]</kbd> 换主题
      </div>
    </div>
  </div>

  <script type="application/json" id="evo-data">${escapeJsonForScript(jsonData)}</script>
  <script type="application/json" id="evo-theme-data">${escapeJsonForScript(themeData)}</script>
  <script>${js}</script>
  <!-- Progressive enhancement only: inline SVGs above already render fully offline.
       Iconify resolves any icon name outside the inline catalog when online. -->
  <script async src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>
</body>
</html>`;
}
