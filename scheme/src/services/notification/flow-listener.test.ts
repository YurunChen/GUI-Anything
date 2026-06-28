import { describe, expect, test } from 'bun:test';
import type { ActivityTree, RepeatAlert } from '../../domain/types';
import { FlowNotificationListener } from './flow-listener';
import type { NotificationService } from './service';

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
