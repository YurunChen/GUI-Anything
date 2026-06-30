import { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationService, FlowNotificationListener } from '../../../services/notification';
import type { ActivityTree } from '../../../domain/types';
import type { Exploration } from '../../../data/protocol/observer-protocol';
import { SUMMARY_REASON_LIVE_PREVIEW } from '../../../data/protocol/summary-provenance';

type NotifySummaryItem = {
  id: string;
  explorationId?: string;
  text?: string;
  status?: string;
  source?: string;
  reason?: string;
  flowchart?: { nodeTitle?: string };
  persistMeta?: { should_persist?: boolean } | null;
};

type CompletedExplorationNotification = {
  exploration: Exploration;
  summary?: NotifySummaryItem;
};

export function isKnowledgeNotifyEligible(item: NotifySummaryItem): boolean {
  return item.status === 'ready' && item.persistMeta?.should_persist === true;
}

export function initialNotifiedKnowledgeIds(items: NotifySummaryItem[]): Set<string> {
  return new Set(items.filter(isKnowledgeNotifyEligible).map((item) => item.id));
}

export function consumeNewKnowledgeNotifications(
  items: NotifySummaryItem[],
  notifiedIds: Set<string>
): NotifySummaryItem[] {
  const notifications: NotifySummaryItem[] = [];
  for (const item of items) {
    if (!isKnowledgeNotifyEligible(item)) continue;
    if (notifiedIds.has(item.id)) continue;
    notifiedIds.add(item.id);
    notifications.push(item);
  }
  return notifications;
}

export function initialNotifiedExplorationIds(explorations: Exploration[]): Set<string> {
  return new Set(explorations.map((exploration) => exploration.id));
}

export function consumeCompletedExplorationNotifications(
  explorations: Exploration[],
  notifiedIds: Set<string>,
  summaryItems?: Record<string, NotifySummaryItem>,
  pendingByExplorationId: Record<string, boolean> = {},
): CompletedExplorationNotification[] {
  const notifications: CompletedExplorationNotification[] = [];
  for (const exploration of explorations) {
    if (exploration.status !== 'complete') continue;
    if (notifiedIds.has(exploration.id)) continue;
    if (pendingByExplorationId[exploration.id]) continue;
    const summary = findSummaryForExploration(summaryItems, exploration.id);
    if (!summary || summary.status === 'pending') continue;
    if (isLiveSummaryPreview(summary)) continue;
    notifiedIds.add(exploration.id);
    notifications.push({ exploration, summary });
  }
  return notifications;
}

/**
 * 通知服务 Hook
 * 负责初始化通知服务并监听关键事件
 */
export function useNotification(
  sessionId?: string,
  tree?: ActivityTree,
  explorations: Exploration[] = [],
  summaryItems?: Record<string, NotifySummaryItem>,
  pendingByExplorationId: Record<string, boolean> = {},
) {
  const wechatUserId = process.env.FLOW_NOTIFY_WECHAT_USER_ID;
  const [notificationEnabled] = useState(() => {
    const envEnabled = process.env.FLOW_NOTIFY_ENABLED;
    return envEnabled !== 'false' && Boolean(wechatUserId);
  });

  const [lastNotifyStatus, setLastNotifyStatus] = useState<string>(() => {
    if (process.env.FLOW_NOTIFY_ENABLED === 'false') return 'WeChat notify disabled';
    if (!wechatUserId) return 'WeChat notify not configured';
    return '';
  });
  const [notifyArmed, setNotifyArmed] = useState(false);
  const listenerRef = useRef<FlowNotificationListener | null>(null);
  const notifiedKnowledgeIdsRef = useRef<Set<string>>(new Set());
  const notifiedExplorationIdsRef = useRef<Set<string>>(new Set());
  const knowledgeInitializedRef = useRef(false);

  // 初始化通知服务
  useEffect(() => {
    if (!notificationEnabled) return;

    // 从环境变量读取配置
    const config = {
      enabled: true,
      autoTriggers: {
        onError: process.env.FLOW_NOTIFY_ON_ERROR !== 'false',
        onCompletion: process.env.FLOW_NOTIFY_ON_COMPLETION !== 'false',
        onKnowledge: process.env.FLOW_NOTIFY_ON_KNOWLEDGE !== 'false',
        progressInterval: parseInt(process.env.FLOW_NOTIFY_PROGRESS_INTERVAL || '0'),
      },
      filters: {
        minPriority: (process.env.FLOW_NOTIFY_MIN_PRIORITY || 'low') as any,
        quietHours: {
          enabled: process.env.FLOW_NOTIFY_QUIET_HOURS_ENABLED === 'true',
          start: process.env.FLOW_NOTIFY_QUIET_HOURS_START || '22:00',
          end: process.env.FLOW_NOTIFY_QUIET_HOURS_END || '08:00',
        },
      },
    };

    const service = new NotificationService(config);

    const listener = new FlowNotificationListener(
      service,
      sessionId,
      process.env.FLOW_PROJECT_DIR || process.cwd()
    );
    listenerRef.current = listener;
    notifiedKnowledgeIdsRef.current = new Set();
    notifiedExplorationIdsRef.current = new Set();
    knowledgeInitializedRef.current = false;
    setNotifyArmed(false);
    setLastNotifyStatus('');

    return () => {
      listenerRef.current = null;
    };
  }, [notificationEnabled, sessionId]);

  // 监听 tree 更新
  useEffect(() => {
    if (!notifyArmed || !tree || !listenerRef.current) return;
    void listenerRef.current.onTreeUpdate(tree).catch(() => undefined);
  }, [notifyArmed, tree]);

  useEffect(() => {
    if (!notifyArmed || !listenerRef.current) return;
    for (const item of consumeCompletedExplorationNotifications(
      explorations,
      notifiedExplorationIdsRef.current,
      summaryItems,
      pendingByExplorationId,
    )) {
      void listenerRef.current.onExplorationComplete(
        item.exploration,
        item.summary,
      ).catch(() => undefined);
    }
  }, [explorations, notifyArmed, summaryItems, pendingByExplorationId]);

  // 监听知识提取（基于新的可持久化 summary item）
  useEffect(() => {
    if (!notifyArmed || !summaryItems || !listenerRef.current) return;

    const items = Object.values(summaryItems);
    if (!knowledgeInitializedRef.current) {
      notifiedKnowledgeIdsRef.current = initialNotifiedKnowledgeIds(items);
      knowledgeInitializedRef.current = true;
      return;
    }

    for (const item of consumeNewKnowledgeNotifications(items, notifiedKnowledgeIdsRef.current)) {
      void listenerRef.current.onKnowledgeExtracted(
        '新发现',
        item.text || '检测到新的关键知识点'
      ).catch(() => undefined);
    }
  }, [notifyArmed, summaryItems]);

  /**
   * 手动开启本轮微信通知
   */
  const enableNotify = useCallback(
    () => {
      if (!listenerRef.current) {
        setLastNotifyStatus('⚠ WeChat notify unavailable');
        return;
      }

      if (tree) {
        listenerRef.current.prime(tree);
      }
      notifiedExplorationIdsRef.current = initialNotifiedExplorationIds(explorations);
      knowledgeInitializedRef.current = false;
      notifiedKnowledgeIdsRef.current = new Set();
      setNotifyArmed(true);
      setLastNotifyStatus('✓ WeChat notify on');
    },
    [explorations, tree]
  );

  /**
   * 手动发送完成通知
   */
  const sendCompletion = useCallback(
    (summary?: string) => {
      if (!tree || !listenerRef.current) return;
      if (!notifyArmed) return;
      void listenerRef.current.onCompletion(tree, summary);
    },
    [notifyArmed, tree]
  );

  return {
    notificationEnabled,
    enableNotify,
    sendCompletion,
    lastNotifyStatus,
  };
}

function findSummaryForExploration(
  items: Record<string, NotifySummaryItem> | undefined,
  explorationId: string,
): NotifySummaryItem | undefined {
  if (!items) return undefined;
  return Object.values(items).find((item) => (
    item.explorationId === explorationId
    || item.id === explorationId
    || item.id.endsWith(`:${explorationId}`)
  ));
}

function isLiveSummaryPreview(item: NotifySummaryItem): boolean {
  return item.source === 'excerpt' && item.reason === SUMMARY_REASON_LIVE_PREVIEW;
}
