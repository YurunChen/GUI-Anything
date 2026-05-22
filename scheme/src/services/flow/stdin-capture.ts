/**
 * ABOUTME: Captures Claude Code statusline stdin JSON and writes to snapshot file.
 * Background helper in the Claude pane layout; bridges Claude statusline → Flow observer.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface StatuslinePayload {
  model?: {
    id?: string;
    display_name?: string;
  };
  context_window?: {
    context_window_size?: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
  };
  rate_limits?: {
    five_hour?: {
      used_percentage?: number | null;
      resets_at?: number | null;
    } | null;
    seven_day?: {
      used_percentage?: number | null;
      resets_at?: number | null;
    } | null;
  } | null;
  cost?: {
    total_cost_usd?: number | null;
    total_duration_ms?: number | null;
  } | null;
  effort?: string | { level?: string | null } | null;
  transcript_path?: string;
  cwd?: string;
}

interface Snapshot extends StatuslinePayload {
  _meta?: {
    captured_at: string;
    source: 'stdin-capture';
  };
}

function parseArgs(argv: string[]): { outPath: string; intervalMs: number } {
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

  const outPath = values['out'] || '';
  const intervalMs = Math.max(100, parseInt(values['interval-ms'] || '300', 10) || 300);

  if (!outPath) {
    console.error('Usage: bun run src/runtime/flow-stdin-capture.ts --out <snapshot-path> [--interval-ms 300]');
    process.exit(1);
  }

  return { outPath, intervalMs };
}

function writeSnapshotAtomic(outPath: string, snapshot: Snapshot): void {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${outPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.renameSync(tmpPath, outPath);
}

async function readStdinSnapshot(): Promise<StatuslinePayload | null> {
  const stdin = process.stdin;
  
  if (stdin.isTTY) {
    // Not running as statusline, no stdin data available
    return null;
  }

  return new Promise((resolve) => {
    let raw = '';
    let settled = false;
    
    const cleanup = (): void => {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('error', onError);
      stdin.pause();
    };
    
    const finish = (value: StatuslinePayload | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    
    const onData = (chunk: string | Buffer): void => {
      raw += String(chunk);
      
      // Try parse complete JSON object
      try {
        const trimmed = raw.trim();
        if (trimmed) {
          const parsed = JSON.parse(trimmed) as StatuslinePayload;
          finish(parsed);
        }
      } catch {
        // Incomplete JSON, continue reading
      }
    };
    
    const onEnd = (): void => {
      try {
        const trimmed = raw.trim();
        if (trimmed) {
          const parsed = JSON.parse(trimmed) as StatuslinePayload;
          finish(parsed);
        } else {
          finish(null);
        }
      } catch {
        finish(null);
      }
    };
    
    const onError = (): void => {
      finish(null);
    };
    
    // Timeout after 5 seconds if no data
    const timeout = setTimeout(() => {
      finish(null);
    }, 5000);
    
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.on('end', onEnd);
    stdin.on('error', onError);
    
    // Cleanup timeout on finish
    const originalFinish = finish;
    const wrappedFinish = (value: StatuslinePayload | null): void => {
      clearTimeout(timeout);
      originalFinish(value);
    };
  });
}

async function run(): Promise<void> {
  const { outPath, intervalMs } = parseArgs(process.argv);
  
  console.error(`[flow-stdin-capture] Starting, writing to: ${outPath}`);
  console.error(`[flow-stdin-capture] Interval: ${intervalMs}ms`);
  
  let lastPayload: StatuslinePayload | null = null;
  
  // Continuous capture loop
  while (true) {
    try {
      const payload = await readStdinSnapshot();
      
      if (payload) {
        lastPayload = payload;
        
        const snapshot: Snapshot = {
          ...payload,
          _meta: {
            captured_at: new Date().toISOString(),
            source: 'stdin-capture',
          },
        };
        
        writeSnapshotAtomic(outPath, snapshot);
        console.error(`[flow-stdin-capture] Updated snapshot`);
      } else if (lastPayload) {
        // No new data but we have last payload, write it with refresh timestamp
        const snapshot: Snapshot = {
          ...lastPayload,
          _meta: {
            captured_at: new Date().toISOString(),
            source: 'stdin-capture',
          },
        };
        writeSnapshotAtomic(outPath, snapshot);
      }
    } catch (err) {
      console.error(`[flow-stdin-capture] Error: ${err}`);
    }
    
    // Wait before next capture cycle
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

run().catch(console.error);
