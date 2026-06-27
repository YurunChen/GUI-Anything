/**
 * Project Evolution HTML — client runtime (vanilla, zero-dep).
 * Renders the project evolution view from embedded JSON; scroll-spy drives the
 * left era rail.
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

  /* P4: intent-transition card inserted before the milestone it leads into.
     Rebuilt from the current DATA on every (re)render so live pushes stay correct. */
  var transByTo = {};
  function rebuildTransIndex() {
    transByTo = {};
    var edges = (DATA.narrative && DATA.narrative.edges) || [];
    edges.forEach(function (e) { if (e && e.toNodeId) transByTo[e.toNodeId] = e; });
  }
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
      cards.push('<div class="kpi reveal"><div class="kpi__ico">' + icon(ico) + '</div>' +
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
      var n = Number(s.num);
      var num = isFinite(n)
        ? '<span class="hero__stat-num" data-count="' + n + '">0</span>'
        : '<span class="hero__stat-num">' + esc(s.num) + '</span>';
      return '<div class="hero__stat">' + num +
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

  function showProject() {
    projectView.classList.add('is-on');
    var p = DATA.project;
    var subSteps = p.nodes.reduce(function (a, n) { return a + ((n.children && n.children.length) || 0); }, 0);
    renderView(projectView, p, {
      kicker: 'Project Evolution', title: '抽象演化主线',
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

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var jump = e.target.closest && e.target.closest('[data-jump-node]');
    if (jump) { closeKModal(); jumpToNode(jump.getAttribute('data-jump-node')); return; }
    var chip = e.target.closest && e.target.closest('.kmkt__chip');
    if (chip) { applyKfilter(chip.getAttribute('data-kfilter')); return; }
    if (e.target.closest && e.target.closest('[data-kmodal-close]')) { closeKModal(); return; }
    if (e.target.id === 'kmodal') { closeKModal(); return; }
    var kcard = e.target.closest && e.target.closest('.kcard');
    if (kcard) { openKModal(+kcard.getAttribute('data-kcard')); return; }
    var era = e.target.closest && e.target.closest('.era');
    if (era) {
      var eid = era.getAttribute('data-era-id');
      var target = document.querySelector('.evo-view.is-on .node[data-era-id="' + eid + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  var themeSel = document.getElementById('theme-select');
  themeSel.addEventListener('change', function () { applyTheme(themeSel.value); });

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    var modal = document.getElementById('kmodal');
    if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
      e.preventDefault(); closeKModal(); return;
    }
    var on = document.querySelector('.evo-view.is-on');
    if (!on) return;
    var nodes = Array.prototype.slice.call(on.querySelectorAll('.node'));
    var idx = nodes.findIndex(function (n) { return n.classList.contains('is-active'); });
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      var next = e.key === 'j' ? Math.min(nodes.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (nodes[next]) nodes[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    { id: 'knowledge', label: '知识市集', icon: 'git-branch', render: renderKnowledgeFlow },
    { id: 'persona', label: '编码人格', icon: 'sparkles', render: renderPersona }
  ];

  /* P3: knowledge-card marketplace — every reuse/deposit is a tappable card. */
  var KFLOW_CARDS = [];
  function buildKflowCards() {
    KFLOW_CARDS = [];
    var k = DATA.knowledge;
    if (!k) return;
    (k.inflow || []).forEach(function (it) {
      KFLOW_CARDS.push({
        kind: 'in', icon: 'search',
        title: it.request || '(检索)',
        tags: it.tags || [],
        score: (typeof it.score === 'number' && it.score > 0) ? it.score : null,
        excerpt: it.excerpt || '',
        type: it.type || '',
        nodeId: it.nodeId, nodeTitle: it.nodeTitle,
      });
    });
    (k.outflow || []).forEach(function (it) {
      // Human-readable first: concise milestone title over the internal targetId.
      var title = it.nodeTitle || it.question || it.contextKey || it.targetPath || '(知识沉淀)';
      KFLOW_CARDS.push({
        kind: 'out', icon: 'book',
        title: title,
        tags: it.contextKey ? [it.contextKey] : [],
        status: it.status || '',
        excerpt: it.summary || '',
        question: it.question || '',
        type: '',
        nodeId: it.nodeId, nodeTitle: it.nodeTitle,
      });
    });
  }

  function renderKcard(card, idx) {
    var tags = (card.tags || []).slice(0, 4).map(function (t) {
      return '<span class="kcard__tag">' + esc(t) + '</span>';
    }).join('');
    var badge = '';
    if (card.kind === 'in' && card.score != null) {
      badge = '<span class="kcard__badge">匹配度 ' + (Math.round(card.score * 100) / 100) + '</span>';
    } else if (card.kind === 'out' && card.status) {
      badge = '<span class="kcard__badge kcard__badge--' + esc(card.status) + '">' + esc(card.status) + '</span>';
    }
    return '<button class="kcard kcard--' + card.kind + ' reveal" data-kcard="' + idx + '">' +
      '<div class="kcard__top">' +
        '<span class="kcard__ico">' + icon(card.icon) + '</span>' +
        '<span class="kcard__kind">' + (card.kind === 'in' ? '复用' : '沉淀') + '</span>' +
        badge +
      '</div>' +
      '<h3 class="kcard__title">' + esc(card.title) + '</h3>' +
      (tags ? '<div class="kcard__tags">' + tags + '</div>' : '') +
      '</button>';
  }

  function renderKModalBody(card) {
    var tags = (card.tags || []).map(function (t) {
      return '<span class="kcard__tag">' + esc(t) + '</span>';
    }).join('');
    var meta = [];
    if (card.kind === 'in' && card.score != null) meta.push('匹配度 ' + (Math.round(card.score * 100) / 100));
    if (card.type) meta.push('类型 ' + card.type);
    if (card.kind === 'out' && card.status) meta.push('状态 ' + card.status);
    var jump = card.nodeId
      ? '<button class="kmodal__jump" data-jump-node="' + esc(card.nodeId) + '">' +
          icon('arrow-right', 'evo-ico--sm') + esc(card.nodeTitle || '相关里程碑') + '</button>'
      : '';
    var ask = (card.kind === 'out' && card.question && card.question !== card.title)
      ? '<div class="kmodal__ask"><span class="kmodal__ask-label">触发问题</span>' + esc(card.question) + '</div>'
      : '';
    return '<div class="kmodal__head">' +
        '<span class="kcard__ico">' + icon(card.icon) + '</span>' +
        '<span class="kcard__kind">' + (card.kind === 'in' ? '复用的旧知识' : '新沉淀的知识') + '</span>' +
      '</div>' +
      '<h2 class="kmodal__title">' + esc(card.title) + '</h2>' +
      (meta.length ? '<div class="kmodal__meta">' + meta.map(esc).join(' · ') + '</div>' : '') +
      ask +
      (card.excerpt ? '<p class="kmodal__excerpt">' + esc(card.excerpt) + '</p>' : '') +
      (tags ? '<div class="kcard__tags">' + tags + '</div>' : '') +
      jump;
  }

  function renderKnowledgeFlow() {
    buildKflowCards();
    if (!KFLOW_CARDS.length) return '';
    var inCount = 0, outCount = 0;
    KFLOW_CARDS.forEach(function (c) { if (c.kind === 'in') inCount++; else outCount++; });

    function chip(f, label, n) {
      return '<button class="kmkt__chip' + (f === 'all' ? ' is-active' : '') + '" data-kfilter="' + f + '">' +
        esc(label) + ' <span class="kmkt__chip-n">' + n + '</span></button>';
    }
    var cards = KFLOW_CARDS.map(function (c, i) { return renderKcard(c, i); }).join('');

    return '<div class="kflow">' +
      '<div class="kflow__intro">' +
        '<h2 class="kflow__title">知识卡片市集</h2>' +
        '<p class="kflow__sub">每张卡片是这个项目复用或沉淀的一条知识，点开看它具体的内容与效果。</p>' +
      '</div>' +
      '<div class="kmkt__filters">' +
        chip('all', '全部', KFLOW_CARDS.length) +
        chip('in', '复用的旧知识', inCount) +
        chip('out', '新沉淀', outCount) +
      '</div>' +
      '<div class="kmkt__grid">' + cards + '</div>' +
      '<div class="kmodal" id="kmodal">' +
        '<div class="kmodal__panel" role="dialog" aria-modal="true">' +
          '<button class="kmodal__x" data-kmodal-close aria-label="关闭">✕</button>' +
          '<div class="kmodal__body"></div>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  function applyKfilter(f) {
    var panel = document.getElementById('tab-knowledge');
    if (!panel) return;
    panel.querySelectorAll('.kmkt__chip').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-kfilter') === f);
    });
    panel.querySelectorAll('.kcard').forEach(function (c) {
      var show = f === 'all' || c.classList.contains('kcard--' + f);
      c.classList.toggle('is-hidden', !show);
    });
  }

  function openKModal(idx) {
    var card = KFLOW_CARDS[idx];
    var modal = document.getElementById('kmodal');
    if (!card || !modal) return;
    modal.querySelector('.kmodal__body').innerHTML = renderKModalBody(card);
    modal.classList.add('is-open');
  }
  function closeKModal() {
    var modal = document.getElementById('kmodal');
    if (modal) modal.classList.remove('is-open');
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

    // Avatar: generated clay portrait if present, else the sparkles icon fallback.
    var avatar = p.avatar
      ? '<div class="persona__avatar"><img src="' + esc(p.avatar) + '" alt="' + esc(p.cnName || '编码人格') + '" loading="lazy"></div>'
      : '<div class="persona__badge">' + icon('sparkles', 'evo-ico--lg') + '</div>';

    var rarity = p.rarity
      ? '<div class="persona__rarity persona__rarity--' + esc(p.rarity) + '">' + esc(p.rarity) + '</div>'
      : '';

    var codeLine = (p.archetypeCode || p.typeCode)
      ? '<div class="persona__code">' + esc(p.archetypeCode || p.typeCode) + '</div>' : '';

    var meta = '';
    if (p.devStyle || p.catchphrase) {
      meta = '<div class="persona__meta">' +
        (p.devStyle ? '<span class="persona__style">' + esc(p.devStyle) + '</span>' : '') +
        (p.catchphrase ? '<span class="persona__quote">“' + esc(p.catchphrase) + '”</span>' : '') +
        '</div>';
    }

    var dna = p.dna ? '<div class="persona__dna">' + esc(p.dna) + '</div>' : '';

    var spectrum = '';
    if (p.spectrum && p.spectrum.length) {
      var rows = p.spectrum.map(function (sp) {
        var pct = Math.round(Math.max(0, Math.min(1, sp.similarity || 0)) * 100);
        return '<div class="persona__spec-row">' +
          '<span class="persona__spec-name">' + esc(sp.cn) + '<em>' + esc(sp.code) + '</em></span>' +
          '<span class="persona__spec-bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="persona__spec-pct">' + pct + '%</span>' +
          '</div>';
      }).join('');
      spectrum = '<div class="persona__spectrum"><div class="persona__spec-label">最接近的人格</div>' + rows + '</div>';
    }

    return '<div class="persona">' +
      '<div class="persona__card">' +
        rarity +
        avatar +
        codeLine +
        '<h2 class="persona__title">' + esc(p.cnName || p.title || '编码人格') + '</h2>' +
        (p.intro || p.tagline ? '<p class="persona__tagline">' + esc(p.intro || p.tagline) + '</p>' : '') +
        meta +
        '<div class="persona__axes">' + sliders + '</div>' +
        dna +
        (p.reading ? '<p class="persona__reading">' + esc(p.reading) + '</p>' : '') +
        spectrum +
        sig +
        '<div class="persona__foot">' + (DATA.aiUsed ? 'AI 解读 · 规则判定（无问卷）' : '规则判定（无问卷，未启用 AI 解读）') + '</div>' +
      '</div>' +
      '</div>';
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
    // Wire the delegated click once; initTabs may re-run on every live snapshot.
    if (!bar.__wired) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.evo-tab-btn');
        if (!btn) return;
        switchTab(btn.getAttribute('data-tab'));
      });
      bar.__wired = true;
    }
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
    setupMotion(); // newly-visible panel: process its reveal/count-up elements
  }

  /* ---------- motion: scroll reveal + number count-up ---------- */
  var revealObserver = null;
  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (target <= 0) { el.textContent = String(target); return; }
    var dur = 700, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step); else el.textContent = String(target);
    }
    requestAnimationFrame(step);
  }
  function setupMotion() {
    var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var countEls = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
    // Fallback (reduced motion / no IntersectionObserver): show everything at once.
    if (prefersReduced() || typeof IntersectionObserver === 'undefined') {
      revealEls.forEach(function (el) { el.classList.add('is-revealed'); });
      countEls.forEach(function (el) { el.textContent = el.getAttribute('data-count'); el.__counted = true; });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-revealed');
        if (el.hasAttribute('data-count') && !el.__counted) { el.__counted = true; countUp(el); }
        revealObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
    countEls.forEach(function (el) { if (!el.__counted) revealObserver.observe(el); });
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

  function activeTabId() {
    var btn = document.querySelector('.evo-tab-btn.is-active');
    return btn ? btn.getAttribute('data-tab') : 'main';
  }

  /* ---------- render (first paint + live re-render share one path) ---------- */
  function render() {
    rebuildTransIndex();
    initTabs();
    renderProvenance();
    showProject(); // scrolls to top; callers restore view when re-rendering live
    setupMotion(); // reveal-on-scroll + count-up (re-inits each render)
  }

  /* Apply a server-pushed snapshot in place — no page reload. Preserve the
     reader's scroll position and active tab so a background refresh is seamless. */
  function applySnapshot(next) {
    if (!next) return;
    var keepScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
    var keepTab = activeTabId();
    DATA = next;
    render();
    if (keepTab && keepTab !== 'main') switchTab(keepTab); // switchTab scrolls to 0
    window.scrollTo(0, keepScroll);
  }

  /* ---------- live connection (server mode): WS push → in-place re-render ---------- */
  // Replaces the old file:// version-sidecar polling. One per-project server holds
  // the model and pushes a full snapshot whenever the underlying content changes.
  function startLiveConnection() {
    if (!DATA.liveServer) return;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = proto + '//' + location.host + '/ws';
    var ws = null, retry = null;
    function schedule() {
      if (retry) return;
      retry = setTimeout(function () { retry = null; connect(); }, 2000);
    }
    function connect() {
      try { ws = new WebSocket(url); } catch (e) { schedule(); return; }
      ws.onmessage = function (ev) {
        var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && msg.type === 'snapshot') applySnapshot(msg.data);
      };
      ws.onclose = function () { schedule(); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    connect();
  }

  /* ---------- boot ---------- */
  var saved;
  try { saved = localStorage.getItem('evo-theme'); } catch (e) {}
  var initial = saved || DATA.theme || themeSel.value;
  if (THEMES[initial]) { themeSel.value = initial; applyTheme(initial); }

  render();
  startLiveConnection();
})();
`;
}
