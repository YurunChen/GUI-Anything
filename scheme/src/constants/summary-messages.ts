import type { ObserverLocale } from './observer-locale';
import { resolveObserverLocale } from './observer-locale';

const SUMMARY_MESSAGES = {
  en: {
    trivialGreetingDistill: 'Ready when you are.',
    trivialGreetingIntentTitle: 'Awaiting task',
    assistantReplyLine: (reply: string) => `Claude Code: ${reply}`,
    roundDistillInProgress: 'In progress — see timeline.',
    roundDistillPending: (topic: string) =>
      `Working on: ${topic.length > 48 ? `${topic.slice(0, 47)}…` : topic}`,
    roundDistillWithTools: (gist: string, toolCount: number) =>
      toolCount > 1 ? `${gist} · ${toolCount} steps` : gist,
    calmNoSummary: 'No summary for this round.',
    calmNoBriefSummary: 'No brief conclusion yet — open the timeline.',
    excerptInsufficient: 'Not enough detail — see timeline nodes.',
    excerptWithOutput: (question: string, toolCount: number, outputPreview: string, errorCount: number) => {
      const err = errorCount > 0 ? ` (${errorCount} error(s))` : '';
      return `"${question}": ${toolCount} tool(s), output: ${outputPreview}${err}`;
    },
    excerptWithTools: (question: string, toolCount: number, responseCount: number) =>
      `"${question}": ${toolCount} tool(s), ${responseCount} response(s) — see timeline`,
    sessionHistoryEmpty:
      '(No prior completed rounds in this session; use this round\'s node log only.)',
    sessionIntentEmpty: '(No prior session intent; infer from this round only.)',
    sessionIntentCurrent: 'Current intent',
    sessionIntentHistory: 'Title history',
    priorSummaryPending: '(not generated yet)',
  },
  'zh-Hans': {
    trivialGreetingDistill: '已就绪，等你开口。',
    trivialGreetingIntentTitle: '待具体任务',
    assistantReplyLine: (reply: string) => `Claude Code：${reply}`,
    roundDistillInProgress: '进行中，详见时间轴。',
    roundDistillPending: (topic: string) =>
      `着手：${topic.length > 24 ? `${topic.slice(0, 23)}…` : topic}`,
    roundDistillWithTools: (gist: string, toolCount: number) =>
      toolCount > 1 ? `${gist} · ${toolCount} 步` : gist,
    calmNoSummary: '本轮暂无摘要。',
    calmNoBriefSummary: '本轮暂无简短结论，可展开时间轴查看。',
    excerptInsufficient: '信息不足，请查看时间轴节点。',
    excerptWithOutput: (question: string, toolCount: number, outputPreview: string, errorCount: number) => {
      const err = errorCount > 0 ? `（${errorCount} 次错误）` : '';
      return `围绕「${question}」，${toolCount} 次工具调用，输出：${outputPreview}${err}`;
    },
    excerptWithTools: (question: string, toolCount: number, responseCount: number) =>
      `围绕「${question}」，${toolCount} 次工具调用、${responseCount} 次回复，详见时间轴`,
    sessionHistoryEmpty: '（本 session 尚无已完成轮次；仅依据本轮节点日志。）',
    sessionIntentEmpty: '（尚无 session intent；仅依据本轮推断。）',
    sessionIntentCurrent: '当前 intent',
    sessionIntentHistory: '标题演变',
    priorSummaryPending: '（尚未生成）',
  },
} as const;

export type SummaryMessages = (typeof SUMMARY_MESSAGES)[ObserverLocale];

export function getSummaryMessages(locale?: ObserverLocale): SummaryMessages {
  const resolved = locale ?? resolveObserverLocale();
  return SUMMARY_MESSAGES[resolved];
}

export const flowNodeTypeIcons: Record<string, string> = {
  prompt: '▶',
  thinking: '💭',
  tool_call: '⚡',
  tool_result: '✓',
  response: '💬',
  group: '📁',
};
