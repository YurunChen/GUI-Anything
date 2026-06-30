import { describe, expect, test } from 'bun:test';
import type { ActivityTree, RepeatAlert } from '../../domain/types';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { FlowNotificationListener } from './flow-listener';
import type { NotificationService } from './service';
import type { NotificationMessage } from './types';

describe('FlowNotificationListener', () => {
  test('only reports newly added error alerts', async () => {
    const reported: string[] = [];
    const listener = new FlowNotificationListener({
      notifyError: async (_title: string, _content: string, details?: string) => {
        reported.push(details ?? '');
        return [];
      },
      notifyProgress: async () => [],
    } as unknown as NotificationService);

    await listener.onTreeUpdate(treeWithAlerts([
      alert('Read', 'warn'),
      alert('Bash', 'error'),
    ]));
    await listener.onTreeUpdate(treeWithAlerts([
      alert('Read', 'warn'),
      alert('Bash', 'error'),
      alert('Edit', 'error'),
    ]));

    expect(reported).toHaveLength(2);
    expect(reported[0]).toContain('Bash');
    expect(reported[0]).not.toContain('Read');
    expect(reported[1]).toContain('Edit');
    expect(reported[1]).not.toContain('Read');
  });

  test('returns manual snapshot notification results', async () => {
    const listener = new FlowNotificationListener({
      notify: async () => [{ platform: 'wechat', success: true, timestamp: 123 }],
    } as unknown as NotificationService);

    const results = await listener.sendManualSnapshot(treeWithAlerts([]));

    expect(results).toEqual([{ platform: 'wechat', success: true, timestamp: 123 }]);
  });

  test('prime treats existing errors as baseline', async () => {
    const reported: string[] = [];
    const listener = new FlowNotificationListener({
      notifyError: async (_title: string, _content: string, details?: string) => {
        reported.push(details ?? '');
        return [];
      },
      notifyProgress: async () => [],
    } as unknown as NotificationService);

    listener.prime(treeWithAlerts([alert('Bash', 'error')]));
    await listener.onTreeUpdate(treeWithAlerts([alert('Bash', 'error')]));
    await listener.onTreeUpdate(treeWithAlerts([
      alert('Bash', 'error'),
      alert('Edit', 'error'),
    ]));

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('Edit');
  });

  test('sends a concise exploration digest', async () => {
    const sent: Array<{ title: string; content: string }> = [];
    const listener = new FlowNotificationListener({
      notify: async (message: NotificationMessage) => {
        sent.push({ title: message.title, content: message.content });
        return [{ platform: 'wechat', success: true, timestamp: 123 }];
      },
    } as unknown as NotificationService);

    const results = await listener.onExplorationComplete(exploration('exp-1'), {
      text: 'Implemented notify clean and verified CLI tests.',
      flowchart: { nodeTitle: '微信通知数据流' },
    });

    expect(results).toEqual([{ platform: 'wechat', success: true, timestamp: 123 }]);
    expect(sent[0].title).toBe('意图: 微信通知数据流');
    expect(sent[0].content).toContain('工具: 2 次');
    expect(sent[0].content).toContain('摘要: Implemented notify clean');
    expect(sent[0].content).not.toContain('Flow exploration 完成');
    expect(sent[0].content).not.toContain('进度:');
  });
});

function treeWithAlerts(alerts: RepeatAlert[]): ActivityTree {
  return {
    prompt: '',
    rootId: 'root',
    nodes: new Map(),
    phase: { current: 'executing', history: [] },
    stats: {
      toolCallCount: 0,
      thinkingCount: 0,
      responseCount: 0,
      repeatCount: 0,
    },
    alerts,
    fileAccess: new Map(),
  };
}

function alert(tool: string, severity: RepeatAlert['severity']): RepeatAlert {
  return {
    tool,
    params: '',
    count: severity === 'error' ? 5 : 3,
    firstSeen: 1,
    severity,
  };
}

function exploration(id: string): Exploration {
  return {
    id,
    question: 'Add notify digest',
    startedAt: 1_000,
    endedAt: 61_000,
    status: 'complete',
    currentPhase: 'verify',
    phaseSeen: { explore: true, execute: true, verify: true },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [
      { id: 'n1', timestamp: 2_000, type: 'tool', label: 'Read' },
      { id: 'n2', timestamp: 3_000, type: 'tool', label: 'Edit' },
    ],
    files: ['cli/lib/notify.mjs'],
  };
}
