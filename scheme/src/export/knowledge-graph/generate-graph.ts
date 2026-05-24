/**
 * Knowledge Graph - 知识图谱生成器
 * 从 ~/.flow-wiki/ 读取知识条目，生成 force-directed 图谱 HTML
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';

interface KnowledgeEntry {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  timestamp?: number;
  type?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  tags: string[];
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  sharedTags: string[];
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
}

/** 读取 wiki 知识库 */
function readWikiEntries(): KnowledgeEntry[] {
  const repo = new KnowledgeRepository();
  return repo.listAllSync().map((entry) => ({
    id: entry.id,
    title: entry.request,
    content: entry.content,
    tags: entry.tags,
    timestamp: entry.createdAt,
    type: entry.type,
  }));
}

/** 构建图数据 */
function buildGraphData(entries: KnowledgeEntry[]): GraphData {
  // Build nodes
  const nodes: GraphNode[] = entries.map(entry => ({
    id: entry.id,
    label: entry.title.slice(0, 50),
    type: entry.type || 'general',
    tags: entry.tags || [],
    size: 1 + (entry.tags?.length || 0),
  }));

  // Build edges based on shared tags
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter(t => nodes[j].tags.includes(t));
      if (shared.length > 0) {
        edges.push({
          source: nodes[i].id,
          target: nodes[j].id,
          weight: shared.length,
          sharedTags: shared,
        });
      }
    }
  }

  return { nodes, edges, generatedAt: Date.now() };
}

/** 生成图谱 HTML */
export function generateKnowledgeGraphHtml(options: { since?: number } = {}): string {
  const entries = readWikiEntries();
  
  // Filter by time if specified
  const filtered = options.since
    ? entries.filter(e => (e.timestamp || 0) >= Date.now() - options.since!)
    : entries;

  const graphData = buildGraphData(filtered);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Knowledge Graph — ${filtered.length} entries</title>
  <style>
:root {
  --bg: #1a1b26;
  --fg: #c0caf5;
  --muted: #565f89;
  --accent: #7aa2f7;
  --secondary: #bb9af7;
  --border: #3d4259;
  --card-bg: #24283b;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: -apple-system, sans-serif; overflow: hidden; }
.app { height: 100vh; display: flex; flex-direction: column; }
.header { background: var(--card-bg); border-bottom: 1px solid var(--border); padding: 10px 16px; display: flex; align-items: center; gap: 16px; }
.header h1 { font-size: 15px; font-weight: 600; }
.header .meta { font-size: 12px; color: var(--muted); }
.controls { display: flex; gap: 8px; margin-left: auto; }
.controls input { background: var(--bg); border: 1px solid var(--border); color: var(--fg); padding: 4px 8px; border-radius: 4px; font-size: 12px; width: 160px; }
.controls input:focus { border-color: var(--accent); outline: none; }
canvas { flex: 1; display: block; }
.tooltip { position: fixed; background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; font-size: 12px; pointer-events: none; display: none; max-width: 300px; z-index: 100; }
.tooltip__title { font-weight: 600; margin-bottom: 4px; color: var(--accent); }
.tooltip__tags { color: var(--secondary); }
.tooltip__type { color: var(--muted); font-size: 11px; }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted); gap: 12px; }
.empty__icon { font-size: 64px; opacity: 0.4; }
  </style>
</head>
<body>
  <div class="app">
    <header class="header">
      <h1>📊 Knowledge Graph</h1>
      <span class="meta">${graphData.nodes.length} nodes · ${graphData.edges.length} edges</span>
      <div class="controls">
        <input type="text" id="search" placeholder="Search nodes... (/)">
      </div>
    </header>
    ${graphData.nodes.length === 0 
      ? '<div class="empty"><div class="empty__icon">📊</div><div>No knowledge entries found</div><div style="font-size:12px">Run some Flow sessions to accumulate knowledge in ~/.flow-wiki/</div></div>'
      : '<canvas id="canvas"></canvas>'}
    <div class="tooltip" id="tooltip">
      <div class="tooltip__title" id="tooltip-title"></div>
      <div class="tooltip__type" id="tooltip-type"></div>
      <div class="tooltip__tags" id="tooltip-tags"></div>
    </div>
  </div>

  <script type="application/json" id="graph-data">${JSON.stringify(graphData)}</script>
  <script>
(function() {
  'use strict';
  const data = JSON.parse(document.getElementById('graph-data').textContent);
  if (data.nodes.length === 0) return;

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('tooltip');
  const searchInput = document.getElementById('search');

  let width, height;
  function resize() {
    width = canvas.width = canvas.clientWidth * devicePixelRatio;
    height = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }
  resize();
  window.addEventListener('resize', resize);

  // Type → color mapping
  const typeColors = {
    error: '#f7768e', snippet: '#7aa2f7', decision: '#bb9af7',
    pattern: '#9ece6a', config: '#e0af68', general: '#7dcfff'
  };

  // Initialize positions randomly
  const nodes = data.nodes.map((n, i) => ({
    ...n, x: Math.random() * canvas.clientWidth, y: Math.random() * canvas.clientHeight,
    vx: 0, vy: 0, highlighted: false
  }));
  const edges = data.edges;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Simple force simulation
  function simulate() {
    const k = 0.01; // spring constant
    const repulsion = 5000;
    const damping = 0.9;
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = k * dist * edge.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx; source.vy += fy;
      target.vx -= fx; target.vy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (centerX - node.x) * 0.001;
      node.vy += (centerY - node.y) * 0.001;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Draw edges
    ctx.globalAlpha = 0.3;
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = '#3d4259';
      ctx.lineWidth = edge.weight;
      ctx.stroke();
    }

    // Draw nodes
    ctx.globalAlpha = 1;
    for (const node of nodes) {
      const color = typeColors[node.type] || typeColors.general;
      const radius = 4 + node.size * 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.highlighted ? '#ffffff' : color;
      ctx.fill();
      if (node.highlighted) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = node.highlighted ? '#ffffff' : 'rgba(192,202,245,0.7)';
      ctx.font = (node.highlighted ? 'bold ' : '') + '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + radius + 12);
    }
  }

  function loop() {
    simulate();
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // Mouse interaction
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hovered = null;
    for (const node of nodes) {
      const r = 4 + node.size * 2;
      const dx = node.x - mx, dy = node.y - my;
      if (dx*dx + dy*dy < r*r*4) { hovered = node; break; }
    }
    if (hovered) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY + 12) + 'px';
      document.getElementById('tooltip-title').textContent = hovered.label;
      document.getElementById('tooltip-type').textContent = 'Type: ' + hovered.type;
      document.getElementById('tooltip-tags').textContent = 'Tags: ' + (hovered.tags.join(', ') || 'none');
    } else {
      tooltip.style.display = 'none';
    }
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    nodes.forEach(n => {
      n.highlighted = q && (n.label.toLowerCase().includes(q) || n.tags.some(t => t.includes(q)));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && e.target !== searchInput) { e.preventDefault(); searchInput.focus(); }
    if (e.key === 'Escape') { searchInput.blur(); searchInput.value = ''; nodes.forEach(n => n.highlighted = false); }
  });
})();
  </script>
</body>
</html>`;
}

/** CLI 导出入口 */
export async function exportKnowledgeGraph(options: { outputPath?: string; since?: string } = {}): Promise<string> {
  let sinceMs: number | undefined;
  if (options.since) {
    const match = options.since.match(/^(\d+)([dhm])$/);
    if (match) {
      const val = parseInt(match[1]);
      const unit = match[2];
      sinceMs = val * (unit === 'd' ? 86400000 : unit === 'h' ? 3600000 : 60000);
    }
  }

  const html = generateKnowledgeGraphHtml({ since: sinceMs });

  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.outputPath, html, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    console.error(`✅ Exported knowledge graph: ${options.outputPath} (${(size / 1024).toFixed(1)}KB)`);
    return options.outputPath;
  } else {
    process.stdout.write(html);
    return 'stdout';
  }
}