import { startClaudeStdoutStream } from '../services/stream/claude';
import { parseClaudeJsonLine } from '../services/protocol/parser';
import type { ParseContext } from '../domain/protocol';
import { ActivityTreeBuilder } from '../domain/tree-builder';

let activeBuilder: ActivityTreeBuilder | null = null;
let lastPrompt = '';

export function startWebServer(port: number, flowMode = false): void {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // ── Start session ──
      if (url.pathname === '/api/start' && req.method === 'POST') {
        const body = await req.text();
        const prompt = body || url.searchParams.get('prompt') || '';
        if (!prompt) {
          return new Response('Missing prompt', { status: 400 });
        }
        lastPrompt = prompt;

        activeBuilder = new ActivityTreeBuilder(prompt, {
          onChange: () => {},
          onComplete: () => {},
          onError: (e) => console.error('[web error]', e)
        });

        const sessionId = `web_${Date.now()}`;
        const ctx: ParseContext = {
          seq: 0,
          source: { agent: 'claude', sessionId, model: undefined },
          traceId: `trace_${Date.now()}`
        };

        startClaudeStdoutStream({
          prompt,
          onStdoutLine: (line: string) => {
            const events = parseClaudeJsonLine(line, ctx);
            for (const event of events) {
              activeBuilder?.addEvent(event);
            }
          },
          onStderrLine: () => {},
          onExit: () => {
            activeBuilder?.markComplete();
          }
        });

        return new Response('Session started', { status: 200 });
      }

      // ── Activity tree ──
      if (url.pathname === '/api/tree') {
        if (!activeBuilder) {
          return new Response('No active session', { status: 404 });
        }
        const tree = activeBuilder.getTree();
        return new Response(JSON.stringify(tree), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ── Flow HTML page ──
      if (url.pathname === '/' && flowMode) {
        return new Response(flowHtml(lastPrompt), {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return new Response('Not found', { status: 404 });
    }
  });

  console.log(`Web API listening on http://localhost:${server.port}`);
}

function flowHtml(prompt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scheme5 Flow</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1b26;color:#c0caf5;font-family:'SF Mono',Menlo,monospace;font-size:13px;padding:16px}
h1{color:#7aa2f7;font-size:16px;margin-bottom:12px}
.session{background:#24283b;border:1px solid #3d4259;border-radius:6px;padding:12px;margin-bottom:8px;cursor:pointer}
.session:hover{border-color:#7aa2f7}
.session h2{color:#a9b1d6;font-size:14px;margin-bottom:4px}
.session .meta{color:#565f89;font-size:11px}
.node{padding:4px 0;border-bottom:1px solid #2f3449;cursor:pointer}
.node:hover{background:#24283b}
.node .icon{color:#7aa2f7}
.node .time{color:#565f89;margin-right:8px}
.node .summary{color:#c0caf5}
.detail{background:#1f2335;border:1px solid #7aa2f7;border-radius:6px;padding:12px;margin-top:8px;display:none}
.detail.active{display:block}
.detail pre{background:#1a1b26;padding:8px;border-radius:4px;overflow-x:auto;font-size:11px;max-height:300px;overflow-y:auto}
</style>
</head>
<body>
<h1>🌊 Flow Sessions</h1>
<div id="sessions"></div>
<div id="nodes"></div>
<div id="detail" class="detail"><pre id="detail-content"></pre></div>
<script>
const API = '/api';
let currentSession = null;

async function loadSessions(){
  const res = await fetch(API+'/tree');
  if(!res.ok) return;
  const tree = await res.json();
  const el = document.getElementById('sessions');
  if(!tree){
    el.innerHTML='<div class="session"><h2>No active session</h2><p class="meta">Start a flow session with POST /api/start</p></div>';
    return;
  }
  el.innerHTML='<div class="session"><h2>'+(tree.prompt || 'Active Session').slice(0,60)+'</h2>'+
    '<div class="meta">Phase: '+(tree.phase?.current || 'idle')+' | Nodes: '+(tree.nodes?.size || 0)+'</div></div>';
}

loadSessions();
setInterval(loadSessions, 2000);
</script>
</body>
</html>`;
}
