import type { GraphPatch } from '../../data/protocol/observer-protocol';
import type { GraphDigest } from '../session/graph-digest-service';
import { runClaudePrintPrompt } from './flow-summaries';
import { validateGraphConsolidationOutput } from './structured-output';

const GRAPH_CONSOLIDATION_PROMPT = `你是 flowchart 整合器。输入是压缩后的全局 graph 视图。
你的任务是判断：
1) 保持增量不变（keep_incremental），或
2) 输出 graph_patch 数组做结构整合（patch）。

限制：
- 只输出严格 JSON，不要 Markdown。
- 不得编造不存在的 intent key。
- 当证据不足时返回 keep_incremental。

输出契约：
{
  "action": "keep_incremental" | "patch",
  "graph_patch": [
    {
      "op": "merge_intents" | "rename_intent" | "reparent_intent" | "drop_intent",
      "target_intent_key": "string",
      "source_intent_keys": ["string"],
      "new_title": "string",
      "new_parent_intent_key": "string|null",
      "reason": "string",
      "confidence": 0-1
    }
  ]
}`;

export interface GraphConsolidationInput {
  digest: GraphDigest;
  model?: string;
}

export interface GraphConsolidationResult {
  action: 'keep_incremental' | 'patch';
  graphPatch: GraphPatch[];
  reason?: string;
}

export type GraphConsolidationRunner = (
  promptText: string,
  model?: string,
) => Promise<{ ok: boolean; output: string; reason?: string }>;

function formatGraphDigest(input: GraphDigest): string {
  const nodes = input.nodes
    .map((node) => `${node.id}|title=${node.title}|status=${node.status}|parents=${node.parentIds.join(',') || 'none'}|summary=${node.summary}`)
    .join('\n');
  const edges = input.edges.map((edge) => `${edge.from}->${edge.to}|${edge.kind}`).join('\n');
  return `nodes:\n${nodes || 'none'}\n\nedges:\n${edges || 'none'}`;
}

export async function generateGraphConsolidationAI(
  input: GraphConsolidationInput,
  runner: GraphConsolidationRunner = (promptText, model) => runClaudePrintPrompt(promptText, {
    model,
    timeoutMs: 45000,
    taskIdPrefix: 'graph_patch',
  }),
): Promise<GraphConsolidationResult> {
  if (input.digest.nodes.length < 2) {
    return { action: 'keep_incremental', graphPatch: [], reason: 'insufficient_nodes' };
  }
  const promptText = `${GRAPH_CONSOLIDATION_PROMPT}\n\n${formatGraphDigest(input.digest)}`;
  const response = await runner(promptText, input.model);
  if (!response.ok) {
    return { action: 'keep_incremental', graphPatch: [], reason: response.reason || 'runner_failed' };
  }
  const parsed = validateGraphConsolidationOutput(response.output);
  if (!parsed.success) {
    return { action: 'keep_incremental', graphPatch: [], reason: parsed.fallbackReason };
  }
  return {
    action: parsed.data.action,
    graphPatch: parsed.data.graph_patch,
  };
}
