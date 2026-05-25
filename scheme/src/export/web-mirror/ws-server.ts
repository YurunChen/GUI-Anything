/**
 * Web Mirror - WebSocket 服务器
 * 基于 Bun 原生 WebSocket，实时推送 Observer 状态到浏览器
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import { findLatestSession } from '../../data/session/claude-project';
import {
  extractExplorationsFromSession,
  extractSessionStats,
} from '../../data/session/jsonl-session';
import { getWebMirrorClientPage } from './client-page';
import type { ServerMessage, MirrorState, MirrorExploration, MirrorNode, MirrorStats } from './protocol';
import type { Exploration, ExplorationNode } from '../../data/session/jsonl-session';

interface WebMirrorOptions {
  port?: number;
  pollIntervalMs?: number;
}

interface ClientConnection {
  ws: any; // Bun WebSocket type
  connectedAt: number;
}

/** 将 Exploration 转换为 MirrorExploration */
function toMirrorExploration(exp: Exploration): MirrorExploration {
  return {
    id: exp.id,
    question: exp.question.slice(0, 200),
    startedAt: exp.startedAt,
    endedAt: exp.endedAt,
    status: exp.status,
    currentPhase: exp.currentPhase,
    phaseSeen: { ...exp.phaseSeen },
    errorCounts: { ...exp.errorCounts },
    nodes: exp.nodes.map(n => toMirrorNode(n)),
  };
}

/** 将 ExplorationNode 转换为 MirrorNode */
function toMirrorNode(node: ExplorationNode): MirrorNode {
  const toolName = node.label.split(' ')[0];
  return {
    id: node.id,
    timestamp: node.timestamp,
    type: node.type,
    label: node.label.slice(0, 100),
    status: node.status,
    phase: node.phase,
    toolName: node.type === 'tool' ? toolName : undefined,
  };
}

/** 获取本机 IP */
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function startWebMirror(options: WebMirrorOptions = {}): void {
  const port = options.port || parseInt(process.env.FLOW_MIRROR_PORT || '3000');
  const pollInterval = options.pollIntervalMs || 1000;
  const cwd = process.env.FLOW_PROJECT_DIR || process.cwd();
  const startedAt = Date.now();

  const clients: Set<ClientConnection> = new Set();
  let lastState: MirrorState | null = null;
  let lastNodeCount = 0;
  let lastExpCount = 0;

  /** 构建当前 Mirror 状态 */
  function buildState(): MirrorState | null {
    const sessionPath = findLatestSession(cwd);
    if (!sessionPath) return null;

    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      const explorations = extractExplorationsFromSession(sessionPath, content);
      const stats = extractSessionStats(sessionPath, content);

      const sessionId = require('node:path').basename(sessionPath, '.jsonl');
      const currentExp = explorations[explorations.length - 1];

      let totalTools = 0;
      let totalErrors = 0;
      for (const exp of explorations) {
        for (const n of exp.nodes) {
          if (n.type === 'tool') totalTools++;
        }
        totalErrors += exp.errorCounts.tool + exp.errorCounts.system + exp.errorCounts.result;
      }

      const mirrorStats: MirrorStats = {
        totalTools,
        totalErrors,
        totalExplorations: explorations.length,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        costUsd: stats.costUsd,
        uptimeMs: Date.now() - startedAt,
      };

      return {
        sessionId,
        projectDir: cwd,
        startedAt: explorations[0]?.startedAt || startedAt,
        currentPhase: currentExp?.currentPhase || 'idle',
        explorations: explorations.map(toMirrorExploration),
        stats: mirrorStats,
        isRunning: currentExp?.status === 'running',
      };
    } catch {
      return null;
    }
  }

  /** 广播消息到所有客户端 */
  function broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg);
    for (const client of clients) {
      try {
        client.ws.send(json);
      } catch {
        clients.delete(client);
      }
    }
  }

  /** 轮询 session 变化并广播增量 */
  function poll(): void {
    const state = buildState();
    if (!state) return;

    const totalNodes = state.explorations.reduce((sum, e) => sum + e.nodes.length, 0);
    const expCount = state.explorations.length;

    // 检测新 exploration
    if (expCount > lastExpCount && lastExpCount > 0) {
      const newExp = state.explorations[state.explorations.length - 1];
      broadcast({ type: 'exploration_start', exploration: newExp });
    }

    // 检测新 nodes
    if (totalNodes > lastNodeCount && lastExpCount > 0) {
      const currentExp = state.explorations[state.explorations.length - 1];
      if (currentExp && currentExp.nodes.length > 0) {
        // 发送最新的 node
        const newNodes = currentExp.nodes.slice(-(totalNodes - lastNodeCount));
        for (const node of newNodes) {
          broadcast({ type: 'node_added', explorationId: currentExp.id, node });
        }
      }
    }

    // 检测 phase 变化
    if (lastState && state.currentPhase !== lastState.currentPhase) {
      const currentExp = state.explorations[state.explorations.length - 1];
      if (currentExp) {
        broadcast({
          type: 'phase_change',
          explorationId: currentExp.id,
          phase: state.currentPhase as any,
        });
      }
    }

    // 定期发送 stats 更新
    broadcast({ type: 'stats_update', stats: state.stats });

    // 检测完成
    if (lastState?.isRunning && !state.isRunning) {
      broadcast({ type: 'session_complete', timestamp: Date.now() });
    }

    lastState = state;
    lastNodeCount = totalNodes;
    lastExpCount = expCount;
  }

  // 启动 Bun HTTP + WebSocket 服务
  const server = Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }
        return undefined;
      }

      // 状态 API
      if (url.pathname === '/api/state') {
        const state = buildState();
        return new Response(JSON.stringify(state), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 客户端页面
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(getWebMirrorClientPage(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return new Response('Not found', { status: 404 });
    },
    websocket: {
      open(ws) {
        const client: ClientConnection = { ws, connectedAt: Date.now() };
        clients.add(client);

        // 发送全量快照
        const state = buildState();
        if (state) {
          ws.send(JSON.stringify({ type: 'snapshot', data: state } as ServerMessage));
        }

        console.error(`[WebMirror] Client connected (total: ${clients.size})`);
      },
      message(ws, message) {
        // 客户端可以发 ping
        if (message === 'ping') {
          ws.send('pong');
        }
      },
      close(ws) {
        for (const client of clients) {
          if (client.ws === ws) {
            clients.delete(client);
            break;
          }
        }
        console.error(`[WebMirror] Client disconnected (total: ${clients.size})`);
      },
    },
  });

  // 启动轮询
  const pollTimer = setInterval(poll, pollInterval);

  const localIP = getLocalIP();
  console.error(`\n┌─────────────────────────────────────────────┐`);
  console.error(`│  🌐 Web Mirror Started                       │`);
  console.error(`│                                             │`);
  console.error(`│  Local:   http://localhost:${port}             │`);
  console.error(`│  Network: http://${localIP}:${port}       │`);
  console.error(`│                                             │`);
  console.error(`│  Open on phone to watch Flow progress! 📱   │`);
  console.error(`└─────────────────────────────────────────────┘\n`);

  // 优雅退出
  process.on('SIGINT', () => {
    clearInterval(pollTimer);
    server.stop();
    process.exit(0);
  });
}