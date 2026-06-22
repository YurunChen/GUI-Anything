/**
 * Project Evolution HTML — client runtime (vanilla, zero-dep).
 * Renders project + session views from embedded JSON; scroll-spy drives the
 * left era rail; hash routing toggles project overview vs. single-session drill-down.
 */

import { getIconCatalogJson, getDeltaIconJson } from './icons';

export function getEvolutionClientScript(): string {
  return `
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('evo-data').textContent);
  var THEMES = JSON.parse(document.getElementById('evo-theme-data').textContent);
  var ICONS = ${getIconCatalogJson()};
  var DELTA_ICON = ${getDeltaIconJson()};

  var sessionsById = {};
  DATA.sessions.forEach(function (s) { sessionsById[s.sessionId] = s; });

  /* ---------- icons ---------- */
  function icon(name, cls) {
    var paths = name && ICONS[name];
    var klass = 'evo-ico' + (cls ? ' ' + cls : '');
    if (!paths) {
      // progressive enhancement: let Iconify (if loaded) resolve a Lucide name
      return '<span class="' + klass + ' iconify" data-icon="lucide:' + esc(name || 'flag') + '"></span>';
    }
    return '<svg class="' + klass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths + '</svg>';
  }
  function deltaIcon(delta) { return icon(DELTA_ICON[delta] || 'flag', 'evo-ico--sm'); }

  /* ---------- theme ---------- */
  function applyTheme(name) {
    var vars = THEMES[name];
    if (!vars) return;
    document.documentElement.setAttribute('style', vars);
    try { localStorage.setItem('evo-theme', name); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function monthLabel(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  /* ---------- rendering ---------- */
  function renderEras(eras) {
    if (!eras.length) return '<div class="evo-empty">暂无演化主线</div>';
    return eras.map(function (era, i) {
      var scenes = (era.sceneAdds || []).map(function (s) {
        return '<span class="scene">' + esc(s) + '</span>';
      }).join('');
      return '<div class="era" data-era-id="' + esc(era.id) + '">' +
        '<div class="era__marker">' + icon(era.icon || 'flag') + '</div>' +
        '<div class="era__body">' +
          '<div class="era__index">纪元 ' + (i + 1) + '</div>' +
          '<div class="era__title">' + esc(era.title) + '</div>' +
          (era.abstract ? '<div class="era__abstract">' + esc(era.abstract) + '</div>' : '') +
          (scenes ? '<div class="era__scenes">' + scenes + '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  function renderSubsteps(children) {
    if (!children || !children.length) return '';
    var rows = children.map(function (c) {
      return '<div class="substep">' +
        '<span class="delta delta--' + esc(c.delta) + '">' + deltaIcon(c.delta) + esc(c.delta) + '</span>' +
        '<span class="substep__title">' + esc(c.title) + '</span>' +
        (c.note ? '<span class="substep__note">— ' + esc(c.note) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<div class="node__children">' +
      '<div class="node__children-label">' + children.length + ' 个细化步骤</div>' +
      '<div class="node__children-wrap"><div class="node__children-inner">' + rows + '</div></div>' +
      '</div>';
  }

  function renderNodes(nodes, opts) {
    if (!nodes.length) return '<div class="evo-empty">暂无时间节点</div>';
    var html = '';
    var lastMonth = null;
    nodes.forEach(function (node) {
      var m = monthLabel(node.at);
      if (m && m !== lastMonth) { html += '<div class="evo-date">' + esc(m) + '</div>'; lastMonth = m; }
      var drill = opts.drillable && sessionsById[node.sessionId]
        ? '<button class="node__drill" data-session="' + esc(node.sessionId) + '">下钻到该 session ' + icon('arrow-right', 'evo-ico--sm') + '</button>'
        : '';
      html += '<article class="node" data-node-id="' + esc(node.id) + '" data-era-id="' + esc(node.eraId) + '">' +
        '<div class="node__dot">' + icon(node.icon || DELTA_ICON[node.delta] || 'flag') + '</div>' +
        '<div class="node__head">' +
          '<span class="delta delta--' + esc(node.delta) + '">' + deltaIcon(node.delta) + esc(node.delta) + '</span>' +
          '<h3 class="node__title">' + esc(node.title) + '</h3>' +
        '</div>' +
        (node.note ? '<p class="node__note">' + esc(node.note) + '</p>' : '') +
        renderSubsteps(node.children) +
        drill +
        '</article>';
    });
    return html;
  }

  function renderHero(opts) {
    var stats = (opts.stats || []).map(function (s) {
      return '<div class="hero__stat"><span class="hero__stat-num">' + esc(s.num) + '</span>' +
        '<span class="hero__stat-label">' + esc(s.label) + '</span></div>';
    }).join('');
    return '<header class="evo-hero">' +
      '<div class="evo-hero__inner">' +
        '<div class="evo-hero__badge">' + icon(opts.heroIcon || 'compass', 'evo-ico--lg') +
          '<span>' + esc(opts.kicker) + '</span></div>' +
        '<h1 class="evo-hero__title">' + esc(opts.heroTitle || opts.title) + '</h1>' +
        (opts.heroSub ? '<p class="evo-hero__sub">' + esc(opts.heroSub) + '</p>' : '') +
        (stats ? '<div class="evo-hero__stats">' + stats + '</div>' : '') +
      '</div>' +
    '</header>';
  }

  function renderView(container, model, opts) {
    container.innerHTML =
      renderHero(opts) +
      '<div class="evo-layout">' +
        '<aside class="evo-rail"><div class="evo-rail__sticky">' +
          '<div class="evo-rail__head">' +
            '<div class="evo-rail__kicker">' + esc(opts.kicker) + '</div>' +
            '<div class="evo-rail__title">' + esc(opts.title) + '</div>' +
          '</div>' +
          '<div class="evo-progress"><div class="evo-progress__fill"></div></div>' +
          '<div class="evo-eras">' + renderEras(model.eras) + '</div>' +
        '</div></aside>' +
        '<section class="evo-stream">' + renderNodes(model.nodes, opts) + '</section>' +
      '</div>';
  }

  /* ---------- scroll-spy ---------- */
  var spyScroll = null;
  var spyResize = null;
  function spy(container, model) {
    if (spyScroll) { window.removeEventListener('scroll', spyScroll); spyScroll = null; }
    if (spyResize) { window.removeEventListener('resize', spyResize); spyResize = null; }
    var nodeEls = container.querySelectorAll('.node');
    var eraEls = container.querySelectorAll('.era');
    var fill = container.querySelector('.evo-progress__fill');
    if (!nodeEls.length) return;

    var eraOrder = model.eras.map(function (e) { return e.id; });
    var activeEl = null;

    // 折叠基准坐标：把每个节点顶部记到「全部折叠时」的文档坐标，判定只用这组常量。
    // 自动展开/收起会改变实时布局，但这里不读实时高度，所以判定永远不会被展开
    // 反过来扰动 —— 彻底切断「展开→改判定→再展开」的抖动环。
    var baseTop = [];
    function measure() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var ai = activeEl ? Array.prototype.indexOf.call(nodeEls, activeEl) : -1;
      var inner = activeEl ? activeEl.querySelector('.node__children-inner') : null;
      var ext = inner ? inner.getBoundingClientRect().height : 0;
      for (var i = 0; i < nodeEls.length; i++) {
        var t = nodeEls[i].getBoundingClientRect().top + y;
        if (ai > -1 && i > ai) t -= ext; // 扣掉当前展开节点对下方的下推，还原折叠基准
        baseTop[i] = t;
      }
    }

    function setActive(nodeEl) {
      if (nodeEl === activeEl) return; // 同一节点不重置，避免 substep 展开动画反复重启
      activeEl = nodeEl;
      nodeEls.forEach(function (n) { n.classList.toggle('is-active', n === nodeEl); });
      var eraId = nodeEl.getAttribute('data-era-id');
      var activeIdx = eraOrder.indexOf(eraId);
      eraEls.forEach(function (el) {
        var idx = eraOrder.indexOf(el.getAttribute('data-era-id'));
        el.classList.toggle('is-active', el.getAttribute('data-era-id') === eraId);
        el.classList.toggle('is-past', idx > -1 && activeIdx > -1 && idx < activeIdx);
        if (el.getAttribute('data-era-id') === eraId) {
          var scenes = el.querySelectorAll('.scene');
          scenes.forEach(function (sc, i) { setTimeout(function () { sc.classList.add('enter'); }, i * 80); });
        }
      });
      if (fill) {
        var total = nodeEls.length;
        var pos = Array.prototype.indexOf.call(nodeEls, nodeEl) + 1;
        fill.style.width = Math.round((pos / total) * 100) + '%';
      }
    }

    // 阈值接力：只有当「下一个」节点的基准顶部越过参考线，才推进到它（上一个随之
    // 折叠、下一个展开）；回滚同理。基于折叠基准常量做单向推进，边界处不存在两点
    // 并列来回选的情况，交接干净、绝不抖动。
    function pick() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var docLine = y + window.innerHeight * 0.4;
      var idx = activeEl ? Array.prototype.indexOf.call(nodeEls, activeEl) : 0;
      if (idx < 0) idx = 0;
      while (idx < nodeEls.length - 1 && baseTop[idx + 1] <= docLine) idx++; // 下一个已到线 → 推进
      while (idx > 0 && baseTop[idx] > docLine) idx--;                       // 当前已退回线上 → 回退
      setActive(nodeEls[idx]);
    }

    var ticking = false;
    spyScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; pick(); });
    };
    spyResize = function () { measure(); pick(); };
    measure();              // 此刻 DOM 尚未激活、全部折叠，得到纯净基准
    window.addEventListener('scroll', spyScroll, { passive: true });
    window.addEventListener('resize', spyResize);
    pick();
  }

  /* ---------- routing ---------- */
  var projectView = document.getElementById('view-project');
  var sessionView = document.getElementById('view-session');
  var app = document.getElementById('app');
  var crumbCur = document.getElementById('crumb-cur');

  function showProject() {
    app.classList.remove('is-session');
    sessionView.classList.remove('is-on');
    projectView.classList.add('is-on');
    crumbCur.textContent = '项目演进总览';
    var p = DATA.project;
    var subSteps = p.nodes.reduce(function (a, n) { return a + ((n.children && n.children.length) || 0); }, 0);
    renderView(projectView, p, {
      kicker: 'Project Evolution', title: '抽象演化主线', drillable: true,
      heroIcon: 'compass', heroTitle: '项目功能演进史',
      heroSub: '从散点的意图变化，连成一条能力生长的主线。',
      stats: [
        { num: p.eras.length, label: '纪元' },
        { num: p.nodes.length, label: '里程碑' },
        { num: DATA.sessions.length, label: 'Session' },
        { num: subSteps, label: '细化步骤' },
      ],
    });
    spy(projectView, p);
    window.scrollTo(0, 0);
  }

  function showSession(id) {
    var s = sessionsById[id];
    if (!s) { location.hash = '#/'; return; }
    app.classList.add('is-session');
    projectView.classList.remove('is-on');
    sessionView.classList.add('is-on');
    crumbCur.textContent = s.title || id;
    var subSteps = s.nodes.reduce(function (a, n) { return a + ((n.children && n.children.length) || 0); }, 0);
    renderView(sessionView, s, {
      kicker: 'Session', title: s.title || id, drillable: false,
      heroIcon: (s.eras[0] && s.eras[0].icon) || 'eye',
      heroTitle: s.title || id, heroSub: '单次 session 内部的意图演化轨迹。',
      stats: [
        { num: s.eras.length, label: '阶段' },
        { num: s.nodes.length, label: '里程碑' },
        { num: subSteps, label: '细化步骤' },
      ],
    });
    spy(sessionView, s);
    window.scrollTo(0, 0);
  }

  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\\/session\\/(.+)$/);
    if (m) showSession(decodeURIComponent(m[1]));
    else showProject();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var drill = e.target.closest && e.target.closest('.node__drill');
    if (drill) { location.hash = '#/session/' + encodeURIComponent(drill.getAttribute('data-session')); return; }
    var era = e.target.closest && e.target.closest('.era');
    if (era) {
      var eid = era.getAttribute('data-era-id');
      var target = document.querySelector('.evo-view.is-on .node[data-era-id="' + eid + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  document.getElementById('crumb-root').addEventListener('click', function (e) {
    e.preventDefault(); location.hash = '#/';
  });
  document.getElementById('evo-back').addEventListener('click', function () { location.hash = '#/'; });

  var themeSel = document.getElementById('theme-select');
  themeSel.addEventListener('change', function () { applyTheme(themeSel.value); });

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    var on = document.querySelector('.evo-view.is-on');
    if (!on) return;
    var nodes = Array.prototype.slice.call(on.querySelectorAll('.node'));
    var idx = nodes.findIndex(function (n) { return n.classList.contains('is-active'); });
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      var next = e.key === 'j' ? Math.min(nodes.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (nodes[next]) nodes[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (e.key === 'Enter') {
      if (idx > -1) {
        var drill = nodes[idx].querySelector('.node__drill');
        if (drill) drill.click();
      }
    } else if (e.key === 'Escape') {
      if (location.hash && location.hash !== '#/') location.hash = '#/';
    } else if (e.key === '[' || e.key === ']') {
      var names = Object.keys(THEMES);
      var ci = names.indexOf(themeSel.value);
      var ni = e.key === ']' ? (ci + 1) % names.length : (ci - 1 + names.length) % names.length;
      themeSel.value = names[ni]; applyTheme(names[ni]);
    }
  });

  /* ---------- boot ---------- */
  var saved;
  try { saved = localStorage.getItem('evo-theme'); } catch (e) {}
  var initial = saved || DATA.theme || themeSel.value;
  if (THEMES[initial]) { themeSel.value = initial; applyTheme(initial); }

  window.addEventListener('hashchange', route);
  route();
})();
`;
}
