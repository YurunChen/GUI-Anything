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
  function fmtDuration(ms) {
    if (!ms || ms < 0) return '';
    if (ms < 1000) return ms + 'ms';
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), rs = s % 60;
    if (m < 60) return rs ? m + 'm' + rs + 's' : m + 'm';
    var h = Math.floor(m / 60), rm = m % 60;
    if (h < 24) return rm ? h + 'h' + rm + 'm' : h + 'h';
    var d = Math.floor(h / 24), rh = h % 24;
    return rh ? d + 'd' + rh + 'h' : d + 'd';
  }
  function fmtNum(n) {
    if (n == null) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\\.0$/, '') + 'k';
    return String(n);
  }
  /* Error intensity bucket from a node's metrics (reliable signals only). */
  function heatLevel(metrics) {
    if (!metrics) return 'low';
    var err = metrics.errorCount || 0;
    var tools = metrics.toolCount || 0;
    var ratio = tools > 0 ? err / tools : 0;
    if (err >= 3 || ratio >= 0.4) return 'high';
    if (err >= 1 || ratio >= 0.15) return 'mid';
    return 'low';
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

  /* Per-node behavioural badge: tools · errors · ~duration · tokens (real signals only). */
  function renderNodeBadge(metrics) {
    if (!metrics) return '';
    var parts = [];
    if (metrics.toolCount) parts.push('<span class="nbadge__item">' + icon('wrench', 'evo-ico--sm') + fmtNum(metrics.toolCount) + ' 工具</span>');
    if (metrics.errorCount) parts.push('<span class="nbadge__item nbadge__item--err">' + icon('alert-triangle', 'evo-ico--sm') + fmtNum(metrics.errorCount) + ' 错误</span>');
    var dur = fmtDuration(metrics.elapsedMs);
    if (dur) parts.push('<span class="nbadge__item">' + icon('refresh', 'evo-ico--sm') + '~' + dur + '</span>');
    if (metrics.tokens) parts.push('<span class="nbadge__item">' + icon('zap', 'evo-ico--sm') + fmtNum(metrics.tokens) + ' tok</span>');
    if (metrics.files && metrics.files.length) parts.push('<span class="nbadge__item">' + icon('file-text', 'evo-ico--sm') + metrics.files.length + ' 文件</span>');
    if (!parts.length) return '';
    return '<div class="node__badge">' + parts.join('') + '</div>';
  }

  /* P4: intent-transition card inserted before the milestone it leads into. */
  var transByTo = {};
  (function () {
    var edges = (DATA.narrative && DATA.narrative.edges) || [];
    edges.forEach(function (e) { if (e && e.toNodeId) transByTo[e.toNodeId] = e; });
  })();
  function renderTransition(toNodeId) {
    var e = transByTo[toNodeId];
    if (!e || !e.why) return '';
    return '<div class="trans">' +
      '<div class="trans__rail">' + icon('git-branch', 'evo-ico--sm') + '</div>' +
      '<div class="trans__body">' +
        '<span class="trans__label">转折</span>' +
        '<span class="trans__why">' + esc(e.why) + '</span>' +
        (e.evidence ? '<span class="trans__ev">' + icon('search', 'evo-ico--sm') + esc(e.evidence) + '</span>' : '') +
      '</div></div>';
  }

  function renderNodes(nodes, opts) {
    if (!nodes.length) return '<div class="evo-empty">暂无时间节点</div>';
    var html = '';
    var lastMonth = null;
    nodes.forEach(function (node) {
      var m = monthLabel(node.at);
      if (m && m !== lastMonth) { html += '<div class="evo-date">' + esc(m) + '</div>'; lastMonth = m; }
      html += renderTransition(node.id);
      var drill = opts.drillable && sessionsById[node.sessionId]
        ? '<button class="node__drill" data-session="' + esc(node.sessionId) + '">下钻到该 session ' + icon('arrow-right', 'evo-ico--sm') + '</button>'
        : '';
      var heat = heatLevel(node.metrics);
      html += '<article class="node node--heat-' + heat + '" data-node-id="' + esc(node.id) + '" data-era-id="' + esc(node.eraId) + '">' +
        '<div class="node__dot">' + icon(node.icon || DELTA_ICON[node.delta] || 'flag') + '</div>' +
        '<div class="node__head">' +
          '<span class="delta delta--' + esc(node.delta) + '">' + deltaIcon(node.delta) + esc(node.delta) + '</span>' +
          '<h3 class="node__title">' + esc(node.title) + '</h3>' +
        '</div>' +
        (node.note ? '<p class="node__note">' + esc(node.note) + '</p>' : '') +
        renderNodeBadge(node.metrics) +
        renderSubsteps(node.children) +
        drill +
        '</article>';
    });
    return html;
  }

  /* KPI dashboard built from aggregated, reliable metrics. */
  function renderKpis(model) {
    var m = model.metrics;
    if (!m) return '';
    var cards = [];
    function card(ico, num, label) {
      cards.push('<div class="kpi"><div class="kpi__ico">' + icon(ico) + '</div>' +
        '<div class="kpi__num">' + esc(num) + '</div>' +
        '<div class="kpi__label">' + esc(label) + '</div></div>');
    }
    var span = fmtDuration(m.elapsedMs);
    if (span) card('refresh', span, '活跃时间跨度');
    card('wrench', fmtNum(m.toolCount), '工具调用 Σ');
    card('alert-triangle', fmtNum(m.errorCount), '报错 Σ');
    card('search', fmtNum(m.retrievals), '知识命中');
    card('book', fmtNum(m.writes), '知识沉淀');
    if (m.tokens) card('zap', fmtNum(m.tokens), 'Token Σ');
    if (m.files && m.files.length) card('file-text', fmtNum(m.files.length), '涉及文件');
    if (!cards.length) return '';
    return '<section class="evo-kpi-wrap"><div class="evo-kpi">' + cards.join('') + '</div></section>';
  }

  /* Color-encoding legend (non-negotiable: any color encoding ships a legend). */
  function renderLegend() {
    return '<div class="evo-legend" title="节点左缘色带表示该里程碑的试错强度">' +
      '<span class="evo-legend__label">试错强度</span>' +
      '<span class="evo-legend__item"><i class="evo-legend__swatch sw--low"></i>顺畅</span>' +
      '<span class="evo-legend__item"><i class="evo-legend__swatch sw--mid"></i>有波折</span>' +
      '<span class="evo-legend__item"><i class="evo-legend__swatch sw--high"></i>多次报错</span>' +
      '</div>';
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
      renderKpis(model) +
      '<div class="evo-layout">' +
        '<aside class="evo-rail"><div class="evo-rail__sticky">' +
          '<div class="evo-rail__head">' +
            '<div class="evo-rail__kicker">' + esc(opts.kicker) + '</div>' +
            '<div class="evo-rail__title">' + esc(opts.title) + '</div>' +
          '</div>' +
          '<div class="evo-progress"><div class="evo-progress__fill"></div></div>' +
          '<div class="evo-eras">' + renderEras(model.eras) + '</div>' +
          renderLegend() +
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
    var copyBtn = e.target.closest && e.target.closest('[data-copy]');
    if (copyBtn) { copyText(copyBtn.getAttribute('data-copy'), copyBtn); return; }
    var printBtn = e.target.closest && e.target.closest('[data-print]');
    if (printBtn) { window.print(); return; }
    var jump = e.target.closest && e.target.closest('[data-jump-node]');
    if (jump) { jumpToNode(jump.getAttribute('data-jump-node')); return; }
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

  /* ---------- tabs (outer shell; main keeps its scroll narrative intact) ---------- */
  // Panels other than 'main' are populated by renderers below; a tab whose
  // renderer yields no content stays hidden so the bar only shows real sections.
  var TAB_DEFS = [
    { id: 'main', label: '演进主线', icon: 'compass' },
    { id: 'knowledge', label: '知识流', icon: 'git-branch', render: renderKnowledgeFlow },
    { id: 'persona', label: '编码人格', icon: 'sparkles', render: renderPersona },
    { id: 'digest', label: '全景 Summary', icon: 'file-text', render: renderDigest }
  ];

  /* P3: two-sided knowledge flow — what we stood on / what we left behind. */
  function renderKnowledgeFlow() {
    var k = DATA.knowledge;
    if (!k || (!(k.inflow && k.inflow.length) && !(k.outflow && k.outflow.length))) return '';

    function jump(nodeId, title) {
      if (!nodeId) return '';
      return '<button class="kflow__jump" data-jump-node="' + esc(nodeId) + '">' +
        icon('arrow-right', 'evo-ico--sm') + esc(title || '相关里程碑') + '</button>';
    }

    var inflow = (k.inflow || []).map(function (it) {
      var tags = (it.tags || []).slice(0, 5).map(function (t) {
        return '<span class="kflow__tag">' + esc(t) + '</span>';
      }).join('');
      var score = typeof it.score === 'number' && it.score > 0
        ? '<span class="kflow__score">匹配度 ' + Math.round(it.score * 100) / 100 + '</span>' : '';
      return '<article class="kflow__card kflow__card--in">' +
        '<div class="kflow__head">' + icon('search', 'evo-ico--sm') +
          '<span class="kflow__req">' + esc(it.request || '(检索)') + '</span>' + score + '</div>' +
        (it.excerpt ? '<p class="kflow__excerpt">' + esc(it.excerpt) + '</p>' : '') +
        (tags ? '<div class="kflow__tags">' + tags + '</div>' : '') +
        jump(it.nodeId, it.nodeTitle) +
        '</article>';
    }).join('') || '<div class="evo-empty">这一程没有显式复用既有知识。</div>';

    var outflow = (k.outflow || []).map(function (it) {
      var st = it.status ? '<span class="kflow__status kflow__status--' + esc(it.status) + '">' + esc(it.status) + '</span>' : '';
      var target = it.targetPath || it.targetId || '(知识条目)';
      return '<article class="kflow__card kflow__card--out">' +
        '<div class="kflow__head">' + icon('book', 'evo-ico--sm') +
          '<span class="kflow__req">' + esc(target) + '</span>' + st + '</div>' +
        jump(it.nodeId, it.nodeTitle) +
        '</article>';
    }).join('') || '<div class="evo-empty">这一程还没有沉淀新的知识条目。</div>';

    return '<div class="kflow">' +
      '<div class="kflow__intro">' +
        '<h2 class="kflow__title">知识流</h2>' +
        '<p class="kflow__sub">左侧是这个项目站立其上的既有知识，右侧是它回馈沉淀下来的新知识。</p>' +
      '</div>' +
      '<div class="kflow__cols">' +
        '<section class="kflow__col">' +
          '<div class="kflow__col-head">' + icon('compass', 'evo-ico--sm') + ' 站在哪些旧知识上 <span class="kflow__count">' + ((k.inflow || []).length) + '</span></div>' +
          inflow +
        '</section>' +
        '<div class="kflow__arrow">' + icon('arrow-right', 'evo-ico--lg') + '</div>' +
        '<section class="kflow__col">' +
          '<div class="kflow__col-head">' + icon('package', 'evo-ico--sm') + ' 这一程沉淀了什么 <span class="kflow__count">' + ((k.outflow || []).length) + '</span></div>' +
          outflow +
        '</section>' +
      '</div>' +
      '</div>';
  }
  /* P5: coding-persona SBTI card (deterministic sliders + AI naming). */
  function renderPersona() {
    var p = DATA.persona;
    if (!p || !p.scores || !p.scores.length) return '';
    var sliders = p.scores.map(function (s) {
      var v = Math.max(0, Math.min(100, s.value || 0));
      var leanRight = v >= 50;
      return '<div class="persona__axis">' +
        '<div class="persona__axis-head">' +
          '<span class="persona__pole' + (leanRight ? '' : ' is-lean') + '">' + esc(s.leftLabel) + '</span>' +
          '<span class="persona__axis-name">' + esc(s.axis) + '</span>' +
          '<span class="persona__pole' + (leanRight ? ' is-lean' : '') + '">' + esc(s.rightLabel) + '</span>' +
        '</div>' +
        '<div class="persona__track"><div class="persona__fill" style="width:' + v + '%"></div>' +
          '<div class="persona__knob" style="left:' + v + '%"></div></div>' +
        '</div>';
    }).join('');
    var sig = '';
    if (p.signatureNodeId) {
      var node = null;
      (DATA.project.nodes || []).forEach(function (n) { if (n.id === p.signatureNodeId) node = n; });
      if (node) sig = '<button class="persona__sig" data-jump-node="' + esc(node.id) + '">' +
        icon('flag', 'evo-ico--sm') + ' 代表时刻：' + esc(node.title) + '</button>';
    }
    return '<div class="persona">' +
      '<div class="persona__card">' +
        '<div class="persona__badge">' + icon('sparkles', 'evo-ico--lg') + '</div>' +
        (p.typeCode ? '<div class="persona__code">' + esc(p.typeCode) + '</div>' : '') +
        '<h2 class="persona__title">' + esc(p.title || '编码人格') + '</h2>' +
        (p.tagline ? '<p class="persona__tagline">' + esc(p.tagline) + '</p>' : '') +
        '<div class="persona__axes">' + sliders + '</div>' +
        (p.reading ? '<p class="persona__reading">' + esc(p.reading) + '</p>' : '') +
        sig +
        '<div class="persona__foot">' + (DATA.aiUsed ? 'AI 命名 · 规则评分' : '规则评分（未启用 AI 命名）') + '</div>' +
      '</div>' +
      '</div>';
  }
  /* P6: one-page project digest (全景 Summary) — scrollable / printable. */
  function renderDigest() {
    var d = DATA.digest;
    if (!d) return '';
    var hasBody = (d.chapters && d.chapters.length) || (d.outputs && d.outputs.length) ||
      (d.learned && d.learned.length) || (d.turningPoints && d.turningPoints.length);
    if (!d.headline && !hasBody) return '';

    function section(ico, title, body) {
      if (!body) return '';
      return '<section class="digest__sec">' +
        '<h3 class="digest__sec-title">' + icon(ico, 'evo-ico--sm') + ' ' + esc(title) + '</h3>' +
        body + '</section>';
    }

    var chapters = (d.chapters || []).map(function (c, i) {
      return '<li class="digest__chapter">' +
        '<div class="digest__chapter-head">' +
          '<span class="digest__chapter-no">' + (i + 1) + '</span>' +
          '<span class="digest__chapter-era">' + esc(c.era) + '</span>' +
          (c.span ? '<span class="digest__chapter-span">' + esc(c.span) + '</span>' : '') +
        '</div>' +
        (c.line ? '<p class="digest__chapter-line">' + esc(c.line) + '</p>' : '') +
        '</li>';
    }).join('');
    var chaptersBody = chapters ? '<ol class="digest__chapters">' + chapters + '</ol>' : '';

    var turns = (d.turningPoints || []).map(function (t) {
      return '<li class="digest__turn">' +
        '<span class="digest__turn-title">' + esc(t.title) + '</span>' +
        '<span class="digest__turn-why">' + esc(t.why) + '</span>' +
        '</li>';
    }).join('');
    var turnsBody = turns ? '<ul class="digest__turns">' + turns + '</ul>' : '';

    var outputs = (d.outputs || []).map(function (o) {
      return '<div class="digest__kpi"><div class="digest__kpi-num">' + esc(o.value) + '</div>' +
        '<div class="digest__kpi-label">' + esc(o.label) + '</div></div>';
    }).join('');
    var outputsBody = outputs ? '<div class="digest__kpis">' + outputs + '</div>' : '';

    var learned = (d.learned || []).map(function (l) {
      return '<li class="digest__learn">' + icon('book', 'evo-ico--sm') + ' ' + esc(l) + '</li>';
    }).join('');
    var learnedBody = learned ? '<ul class="digest__learned">' + learned + '</ul>' : '';

    var nextBody = '';
    if (d.nextSteps && d.nextSteps.length) {
      var steps = d.nextSteps.map(function (s) {
        return '<li class="digest__next-item">' + icon('arrow-right', 'evo-ico--sm') + ' ' + esc(s) + '</li>';
      }).join('');
      nextBody = '<div class="digest__next-head">' +
          '<button class="digest__copy" data-copy="nextsteps">' + icon('file-text', 'evo-ico--sm') + ' 复制</button>' +
        '</div><ul class="digest__next">' + steps + '</ul>';
    }

    return '<div class="digest">' +
      '<div class="digest__hero">' +
        '<div class="digest__kicker">' + icon('file-text', 'evo-ico--sm') + ' 全景 Summary</div>' +
        (d.headline ? '<h2 class="digest__headline">' + esc(d.headline) + '</h2>' : '') +
        '<button class="digest__print" data-print="1">' + icon('file-text', 'evo-ico--sm') + ' 打印 / 导出 PDF</button>' +
      '</div>' +
      section('flag', '旅程章节', chaptersBody) +
      section('git-branch', '关键转折', turnsBody) +
      section('bar-chart', '累计产出', outputsBody) +
      section('book', '学到了什么', learnedBody) +
      section('check-circle', '下一步 / 待决策', nextBody) +
      '</div>';
  }

  /* Copy nextSteps as paste-ready text (work-canvas initCopy idiom). */
  function copyText(key, btn) {
    var text = '';
    if (key === 'nextsteps' && DATA.digest && DATA.digest.nextSteps) {
      text = DATA.digest.nextSteps.join('\\n');
    }
    if (!text) return;
    var done = function () {
      if (!btn) return;
      var old = btn.innerHTML; btn.innerHTML = icon('check-circle', 'evo-ico--sm') + ' 已复制';
      setTimeout(function () { btn.innerHTML = old; }, 1500);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
        return;
      }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); done();
    } catch (e2) {}
  }

  /* Jump from a knowledge card to its milestone in the main scroll narrative. */
  function jumpToNode(nodeId) {
    switchTab('main');
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(function () {
      var target = document.querySelector('.evo-view.is-on .node[data-node-id="' + (window.CSS && CSS.escape ? CSS.escape(nodeId) : nodeId) + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  function initTabs() {
    var bar = document.getElementById('evo-tabs');
    if (!bar) return;
    var visible = [];
    TAB_DEFS.forEach(function (def) {
      if (def.id === 'main') { visible.push(def); return; }
      var panel = document.getElementById('tab-' + def.id);
      if (!panel) return;
      var html = def.render ? def.render() : '';
      if (html) { panel.innerHTML = html; visible.push(def); }
    });
    if (visible.length < 2) { bar.hidden = true; return; } // nothing to switch between
    bar.hidden = false;
    bar.innerHTML = visible.map(function (def, i) {
      return '<button class="evo-tab-btn' + (i === 0 ? ' is-active' : '') + '" data-tab="' + esc(def.id) + '">' +
        icon(def.icon, 'evo-ico--sm') + '<span>' + esc(def.label) + '</span></button>';
    }).join('');
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.evo-tab-btn');
      if (!btn) return;
      switchTab(btn.getAttribute('data-tab'));
    });
  }

  function switchTab(id) {
    var bar = document.getElementById('evo-tabs');
    if (bar) {
      bar.querySelectorAll('.evo-tab-btn').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-tab') === id);
      });
    }
    document.querySelectorAll('.evo-tab').forEach(function (p) {
      p.classList.toggle('is-on', p.getAttribute('data-tab') === id);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- provenance footer ---------- */
  function renderProvenance() {
    var el = document.getElementById('evo-prov');
    if (!el) return;
    var p = DATA.generatedBy;
    if (!p) { el.style.display = 'none'; return; }
    var bits = [];
    if (p.agent) bits.push(esc(p.agent));
    if (p.model) bits.push('模型 ' + esc(p.model));
    if (p.builtAt) {
      var d = new Date(p.builtAt);
      if (!isNaN(d.getTime())) {
        bits.push('生成于 ' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
          '-' + ('0' + d.getDate()).slice(-2) + ' ' +
          ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2));
      }
    }
    el.innerHTML = icon('shield', 'evo-ico--sm') + ' ' + bits.join(' · ');
  }

  /* ---------- boot ---------- */
  var saved;
  try { saved = localStorage.getItem('evo-theme'); } catch (e) {}
  var initial = saved || DATA.theme || themeSel.value;
  if (THEMES[initial]) { themeSel.value = initial; applyTheme(initial); }

  initTabs();
  renderProvenance();
  window.addEventListener('hashchange', route);
  route();
})();
`;
}
