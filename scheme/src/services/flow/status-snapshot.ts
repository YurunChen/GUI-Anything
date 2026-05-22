import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectDir } from '../../data/session/claude-project';

type Snapshot = {
  model?: {
    id?: string;
    display_name?: string;
  };
  context_window?: {
    context_window_size?: number;
    used_percentage?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
  };
  rate_limits?: {
    five_hour?: { used_percentage?: number | null } | null;
    seven_day?: { used_percentage?: number | null } | null;
  } | null;
  cost?: {
    total_cost_usd?: number | null;
  } | null;
  effort?: string | { level?: string | null } | null;
};

interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseArgs(argv: string[]): { sessionId: string; rootDir: string; outPath: string; intervalMs: number } {
  const args = argv.slice(2);
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) continue;
    values[key] = value;
    i += 1;
  }

  const sessionId = values['session-id'] || '';
  const rootDir = values['root-dir'] || process.cwd();
  const outPath = values['out'] || '';
  const intervalMs = Math.max(200, parseInt(values['interval-ms'] || '500', 10) || 500);

  if (!sessionId || !outPath) {
    throw new Error('Usage: bun run src/runtime/flow-status-snapshot.ts --session-id <id> --root-dir <dir> --out <path> [--interval-ms 500]');
  }

  return { sessionId, rootDir, outPath, intervalMs };
}

function extractSnapshotFromJsonl(jsonlPath: string): Snapshot | null {
  if (!fs.existsSync(jsonlPath)) return null;

  const content = fs.readFileSync(jsonlPath, 'utf8');
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return null;

  let modelId: string | undefined;
  let modelDisplayName: string | undefined;
  let rateLimits: Snapshot['rate_limits'] = null;
  let contextWindow: Snapshot['context_window'] | undefined;
  let effort: Snapshot['effort'] = null;
  let costUsd: number | null = null;
  const usage: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const countedMessageIds = new Set<string>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const source = entry.source as { model?: unknown } | undefined;
      if (typeof source?.model === 'string' && source.model.trim()) {
        modelId = source.model;
      }

      const messageModel = (entry.message as { model?: unknown } | undefined)?.model;
      if (typeof messageModel === 'string' && messageModel.trim()) {
        modelId = messageModel;
      }

      const model = entry.model as { id?: unknown; display_name?: unknown } | undefined;
      if (typeof model?.id === 'string' && model.id.trim()) modelId = model.id;
      if (typeof model?.display_name === 'string' && model.display_name.trim()) modelDisplayName = model.display_name;

      if (entry.rate_limits && typeof entry.rate_limits === 'object') {
        rateLimits = entry.rate_limits as Snapshot['rate_limits'];
      }

      if (entry.context_window && typeof entry.context_window === 'object') {
        contextWindow = entry.context_window as Snapshot['context_window'];
      }

      if (entry.effort !== undefined) {
        effort = entry.effort as Snapshot['effort'];
      }

      const message = entry.message as { id?: unknown; usage?: Record<string, unknown> } | undefined;
      const entryUsage = (message?.usage ?? (entry.usage as Record<string, unknown> | undefined));
      if (entryUsage) {
        const msgId = typeof message?.id === 'string' ? message.id : undefined;
        if (!msgId || !countedMessageIds.has(msgId)) {
          usage.input += asNumber(entryUsage.input_tokens);
          usage.output += asNumber(entryUsage.output_tokens);
          usage.cacheRead += asNumber(entryUsage.cache_read_input_tokens);
          usage.cacheWrite += asNumber(entryUsage.cache_creation_input_tokens);
          if (msgId) countedMessageIds.add(msgId);
        }
      }

      if (entry.type === 'result') {
        const total = asNumber(entry.total_cost_usd);
        const delta = asNumber(entry.cost_usd);
        if (total > 0) {
          costUsd = total;
        } else if (delta > 0) {
          costUsd = (costUsd ?? 0) + delta;
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!contextWindow) {
    contextWindow = {
      current_usage: {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_creation_input_tokens: usage.cacheWrite,
        cache_read_input_tokens: usage.cacheRead,
      },
    };
  } else if (!contextWindow.current_usage) {
    contextWindow.current_usage = {
      input_tokens: usage.input,
      output_tokens: usage.output,
      cache_creation_input_tokens: usage.cacheWrite,
      cache_read_input_tokens: usage.cacheRead,
    };
  }

  const snapshot: Snapshot = {
    model: modelId || modelDisplayName ? { id: modelId, display_name: modelDisplayName } : undefined,
    context_window: contextWindow,
    rate_limits: rateLimits,
    cost: costUsd !== null ? { total_cost_usd: costUsd } : null,
    effort,
  };

  return snapshot;
}

function writeSnapshotAtomic(outPath: string, snapshot: Snapshot): void {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${outPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot), 'utf8');
  fs.renameSync(tmpPath, outPath);
}

function run(): void {
  const { sessionId, rootDir, outPath, intervalMs } = parseArgs(process.argv);
  const jsonlPath = path.join(projectDir(rootDir), `${sessionId}.jsonl`);

  const tick = (): void => {
    const snapshot = extractSnapshotFromJsonl(jsonlPath);
    if (snapshot) {
      writeSnapshotAtomic(outPath, snapshot);
    }
  };

  tick();
  setInterval(tick, intervalMs);
}

run();
