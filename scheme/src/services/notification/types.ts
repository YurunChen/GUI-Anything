/**
 * Notification Types for Flow Observer
 * 微信通知类型。
 */

export type NotificationType =
  | 'error'           // 错误/异常告警
  | 'completion'      // 实验完成通知
  | 'exploration'     // 单轮 exploration digest
  | 'knowledge'       // 关键知识提取
  | 'progress'        // 阶段性进度报告
  | 'manual';         // 手动快照

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type PlatformType = 'wechat';

/**
 * 通知消息结构
 */
export interface NotificationMessage {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  content: string;
  timestamp: number;
  metadata?: {
    sessionId?: string;
    projectDir?: string;
    phase?: string;
    toolCount?: number;
    errorDetails?: string;
    [key: string]: any;
  };
}

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  name: PlatformType;
  enabled: boolean;
  send(message: NotificationMessage): Promise<boolean>;
  test(): Promise<boolean>;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  enabled: boolean;
  // 自动触发规则
  autoTriggers: {
    onError: boolean;           // 检测到错误时自动推送
    onCompletion: boolean;      // 任务完成时自动推送
    onKnowledge: boolean;       // 提取知识时自动推送
    progressInterval?: number;  // 进度报告间隔（分钟，0=禁用）
  };
  // 过滤规则
  filters: {
    minPriority: NotificationPriority;  // 最低推送优先级
    quietHours?: {                       // 免打扰时段
      enabled: boolean;
      start: string;  // HH:MM
      end: string;    // HH:MM
    };
  };
}

/**
 * 推送结果
 */
export interface NotificationResult {
  success: boolean;
  platform: PlatformType;
  error?: string;
  timestamp: number;
}
