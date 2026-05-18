import { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationService, FlowNotificationListener } from '../../../services/notification';
import type { ActivityTree } from '../../../domain/types';
import type { ExplorationSummary } from '../../../services/ai/flow-summaries';

/**
 * 通知服务 Hook
 * 负责初始化通知服务并监听关键事件
 */
export function useNotification(
  sessionId?: string,
  tree?: ActivityTree,
  explorationSummaries?: ExplorationSummary[]
) {
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
    const envEnabled = process.env.FLOW_NOTIFY_ENABLED;
    return envEnabled !== 'false'; // 默认启用
  });

  const [lastNotifyStatus, setLastNotifyStatus] = useState<string>('');
  const notificationServiceRef = useRef<NotificationService | null>(null);
  const listenerRef = useRef<FlowNotificationListener | null>(null);

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
    listenerRef.current.onTreeUpdate(tree);
  }, [tree]);

  // 监听知识提取（基于 explorationSummaries 增长）
  const lastSummaryCountRef = useRef(0);
  useEffect(() => {
    if (!explorationSummaries || !listenerRef.current) return;

    const currentCount = explorationSummaries.length;
    if (currentCount > lastSummaryCountRef.current) {
      const newSummary = explorationSummaries[currentCount - 1];
      if (newSummary && newSummary.shouldPersist) {
        // 新的知识被提取
        listenerRef.current.onKnowledgeExtracted(
          '新发现',
          newSummary.summary || '检测到新的关键知识点'
        );
      }
    }
    lastSummaryCountRef.current = currentCount;
  }, [explorationSummaries]);

  /**
   * 手动发送快照
   */
  const sendManualSnapshot = useCallback(
    (note?: string) => {
      if (!tree || !listenerRef.current) {
        setLastNotifyStatus('⚠ No active session');
        return;
      }

      listenerRef.current.sendManualSnapshot(tree, note).then(() => {
        setLastNotifyStatus('✓ Snapshot sent');
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
