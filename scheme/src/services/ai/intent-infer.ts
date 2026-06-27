/**
 * Deterministic intent_key inference — fallback when the Summary LLM omits flowchart.
 *
 * Keyword heuristics mapped to the fixed session intent catalog. Used to synthesize a
 * FlowchartHint so the Wiki bucketing pipeline (useWikiCurator → intent buckets → curator)
 * is never starved of intent signals just because the model produced a flowchart-less summary.
 */

import {
  normalizeSessionIntentKey,
  SESSION_INTENT_GREETING,
  type SessionIntentTaskKey,
} from '../../constants/session-intent-keys';
import type { FlowchartHint } from '../../data/protocol/observer-protocol';

const GREETING_WORDS = new Set([
  'hello', 'hi', 'hey', 'thanks', 'thank you', 'thx', 'ping', 'test',
  '你好', '您好', '在吗', '谢谢', '哈喽', '嗨',
]);

interface IntentRule {
  key: SessionIntentTaskKey;
  patterns: RegExp[];
}

/** Order matters: earlier (more specific) rules win. */
const INTENT_RULES: IntentRule[] = [
  {
    key: 'debug',
    patterns: [/报错|错误|失败|修复|修\s*bug|异常|崩溃|不工作|不对劲|不生效|stack\s?trace|traceback|\berror\b|\bfix\b|\bfails?\b|\bbug\b/i],
  },
  {
    key: 'test_verify',
    patterns: [/测试|单测|集成测|验收|回归|跑测|用例|覆盖率|\btest(s|ing|case)?\b|verify|coverage|\bci\b/i],
  },
  {
    key: 'devops',
    patterns: [/部署|发布|上线|运行|跑一次|跑起来|启动|构建|编译|脚本|环境变量|flow-?run|observer|终端|\bdeploy\b|\bbuild\b|\brun\b|\bscript\b/i],
  },
  {
    key: 'refactor',
    patterns: [/重构|整理|去冗余|拆模块|抽取|重命名|clean\s?up|\brefactor\b|\brename\b/i],
  },
  {
    key: 'implement',
    patterns: [/实现|新增|添加|加一个|写一个|改成|改一下|修改|开发|落地|实装|接入|\bimplement\b|\badd\b|\bcreate\b|改代码|写代码|加功能/i],
  },
  {
    key: 'project_design',
    patterns: [/架构|设计|方案|介绍.*(项目|功能)|项目.*(功能|架构|结构)|可优化|优化点|评审|职责|分层|readme|data-?flow|契约|\bwiki\b|文档/i],
  },
  {
    key: 'research',
    patterns: [/调研|文献|竞品|实验设计|选型|对比方案|\bresearch\b|benchmark|paper/i],
  },
  {
    key: 'explore',
    patterns: [/在哪|哪里|找一下|找找|看看|查看|读一下|了解|弄清|是什么|怎么实现|如何使用|\bwhere\b|\blocate\b|how does|看一下/i],
  },
];

/** Pure greeting / no real task (no tool work expected). */
export function isGreetingRequest(question: string): boolean {
  const q = (question || '').trim().toLowerCase();
  if (!q) return false;
  if (GREETING_WORDS.has(q)) return true;
  // short greeting prefixes with nothing substantial after
  return /^(你好|您好|hello|hi|hey)[\s,，。!！?？]*$/i.test(q);
}

/**
 * Infer a catalog intent_key from the user's question.
 * Prefers an explicit keyword match, then continuity with the prior real intent, else 'general'.
 * Returns greeting only for pure greetings.
 */
export function inferIntentKeyFromText(
  question: string,
  priorIntentKey?: string | null,
): string {
  const q = (question || '').trim();
  const prior = normalizeSessionIntentKey(priorIntentKey ?? '');
  const priorReal = prior && prior !== SESSION_INTENT_GREETING ? prior : '';

  if (!q) return priorReal || 'general';
  if (isGreetingRequest(q)) return SESSION_INTENT_GREETING;

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((re) => re.test(q))) {
      return rule.key;
    }
  }
  // No keyword matched: keep continuity with the prior real intent, else general.
  return priorReal || 'general';
}

/** Note stamped on synthesized hints so downstream layers can recognize/filter the fallback. */
export const AUTO_INFERRED_FLOWCHART_NOTE = 'auto-inferred (flowchart missing)';

export interface SynthesizeFlowchartInput {
  question: string;
  priorIntentKey?: string | null;
  nodeTitleMaxLen?: number;
}

/**
 * Build a deterministic FlowchartHint when the model omits/garbles it.
 * Drives Wiki bucketing without depending on the model emitting valid flowchart JSON.
 */
export function synthesizeFlowchartHint(input: SynthesizeFlowchartInput): FlowchartHint {
  const intentKey = inferIntentKeyFromText(input.question, input.priorIntentKey);
  const isGreeting = intentKey === SESSION_INTENT_GREETING;
  const prior = normalizeSessionIntentKey(input.priorIntentKey ?? '');
  const priorReal = prior && prior !== SESSION_INTENT_GREETING ? prior : '';
  const nodeTitle = buildNodeTitle(input.question, input.nodeTitleMaxLen ?? 40)
    || (isGreeting ? '待具体任务' : intentKey);

  const titleDelta = isGreeting
    ? 'idle'
    : (priorReal && priorReal === intentKey ? 'continue' : 'pivot');

  return {
    nodeId: `auto_${intentKey}`,
    nodeTitle,
    parentId: titleDelta === 'pivot' && priorReal ? priorReal : null,
    branchType: 'trunk',
    importance: 'medium',
    dropFromChart: isGreeting,
    intentKey,
    titleDelta,
    titleDeltaNote: AUTO_INFERRED_FLOWCHART_NOTE,
  };
}

function buildNodeTitle(question: string, maxLen: number): string {
  const q = (question || '').replace(/\s+/g, ' ').trim();
  if (!q) return '';
  if (q.length <= maxLen) return q;
  return `${q.slice(0, maxLen - 1)}…`;
}
