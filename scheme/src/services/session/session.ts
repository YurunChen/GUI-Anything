import { startClaudeStdoutStream } from '../stream/claude';
import { parseClaudeJsonLine } from '../protocol/parser';
import type { ParseContext, CliEventEnvelope } from '../../domain/protocol';
import { ActivityTreeBuilder } from '../../domain/tree-builder';

export async function createSession(
  prompt: string,
  onTreeChange: (tree: ActivityTreeBuilder['getTree'] extends () => infer T ? T : never) => void,
  onComplete: () => void,
  onError: (error: string) => void
): Promise<void> {
  const sessionId = `session_${Date.now()}`;

  const ctx: ParseContext = {
    seq: 0,
    source: { agent: 'claude', sessionId, model: undefined },
    traceId: `trace_${Date.now()}`
  };

  const builder = new ActivityTreeBuilder(prompt, {
    onChange: (tree) => onTreeChange(tree),
    onComplete,
    onError
  });

  startClaudeStdoutStream({
    prompt,
    onStdoutLine: (line: string) => {
      const event = parseClaudeJsonLine(line, ctx);
      if (event) {
        builder.addEvent(event);
      }
    },
    onStderrLine: () => {},
    onExit: () => {
      builder.markComplete();
    }
  });
}
