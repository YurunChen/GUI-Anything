import { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationService, FlowNotificationListener } from '../../../services/notification';
import type { ActivityTree } from '../../../domain/types';
import type { NotificationResult } from '../../../services/notification';

type NotifySummaryItem = {
  id: string;
  text?: string;
  status?: string;
  persistMeta?: { should_persist?: boolean } | null;
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

/**
 * 通知服务 Hook
 * 负责初始化通知服务并监听关键事件
 */
export function useNotification(
  sessionId?: string,
  tree?: ActivityTree,
  summaryItems?: Record<string, NotifySummaryItem>
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
  const notificationServiceRef = useRef<NotificationService | null>(null);
  const listenerRef = useRef<FlowNotificationListener | null>(null);
  const notifiedKnowledgeIdsRef = useRef<Set<string>>(new Set());
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
    notificationServiceRef.current = service;

    const listener = new FlowNotificationListener(
      service,
      sessionId,
      process.env.FLOW_PROJECT_DIR || process.cwd()
    );
    listenerRef.current = listener;
    notifiedKnowledgeIdsRef.current = new Set();
    knowledgeInitializedRef.current = false;

    // 发送启动测试消息（静默，不影响用户）
    // service.testAll().then((results) => {
    //   const successCount = Object.values(results).filter(Boolean).length;
    //   if (successCount > 0) {
    //     setLastNotifyStatus(`✓ ${successCount} platform(s) ready`);
    //   }
    // });

    return () => {
      notificationServiceRef.current = null;
      listenerRef.current = null;
    };
  }, [notificationEnabled, sessionId]);

  // 监听 tree 更新
  useEffect(() => {
    if (!tree || !listenerRef.current) return;
    void listenerRef.current.onTreeUpdate(tree).catch(() => undefined);
  }, [tree]);

  // 监听知识提取（基于新的可持久化 summary item）
  useEffect(() => {
    if (!summaryItems || !listenerRef.current) return;

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
  }, [summaryItems]);

  /**
   * 手动发送快照
   */
  const sendManualSnapshot = useCallback(
    (note?: string) => {
      if (!tree || !listenerRef.current) {
        setLastNotifyStatus('⚠ No active session');
        return;
      }

      listenerRef.current.sendManualSnapshot(tree, note).then((results) => {
        setLastNotifyStatus(formatNotifyStatus(results));
        setTimeout(() => setLastNotifyStatus(''), 3000);
      }).catch((error) => {
        setLastNotifyStatus(`⚠ ${error instanceof Error ? error.message : String(error)}`);
        setTimeout(() => setLastNotifyStatus(''), 3000);
      });
    },
    [tree]
  );

  /**
   * 手动发送完成通知
   */
  const sendCompletion = useCallback(
    (summary?: string) => {
      if (!tree || !listenerRef.current) return;
      listenerRef.current.onCompletion(tree, summary);
    },
    [tree]
  );

  return {
    notificationEnabled,
    sendManualSnapshot,
    sendCompletion,
    lastNotifyStatus,
  };
}

function formatNotifyStatus(results: NotificationResult[]): string {
  if (results.length === 0) return '⚠ WeChat notification skipped';
  const failed = results.find((result) => !result.success);
  if (!failed) return '✓ WeChat snapshot sent';
  return failed.error ? `⚠ WeChat send failed: ${failed.error}` : '⚠ WeChat send failed';
}
