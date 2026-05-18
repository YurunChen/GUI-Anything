import type {
  NotificationMessage,
  NotificationConfig,
  NotificationResult,
  PlatformAdapter,
  PlatformType,
  NotificationType,
  NotificationPriority,
} from './types';
import { WechatAdapter, FeishuAdapter, DingTalkAdapter } from './adapters';

/**
 * 通知服务核心类
 * 负责协调多个平台适配器，处理推送逻辑
 */
export class NotificationService {
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();
  private config: NotificationConfig;
  private lastProgressNotify: number = 0;

  constructor(config?: Partial<NotificationConfig>) {
    this.config = this.mergeConfig(config);
    this.initializeAdapters();
  }

  /**
   * 初始化平台适配器
   */
  private initializeAdapters(): void {
    // 微信适配器 (iLink Bot via Python service)
    // FLOW_NOTIFY_WECHAT_USER_ID: 接收消息的微信用户ID
    const wechatUserId = process.env.FLOW_NOTIFY_WECHAT_USER_ID;
    if (wechatUserId) {
      this.adapters.set('wechat', new WechatAdapter(wechatUserId));
    }

    // 飞书适配器
    const feishuUrl = process.env.FLOW_NOTIFY_FEISHU_URL;
    const feishuToken = process.env.FLOW_NOTIFY_FEISHU_TOKEN;
    if (feishuUrl) {
      this.adapters.set('feishu', new FeishuAdapter(feishuUrl, feishuToken));
    }

    // 钉钉适配器
    const dingtalkUrl = process.env.FLOW_NOTIFY_DINGTALK_URL;
    const dingtalkToken = process.env.FLOW_NOTIFY_DINGTALK_TOKEN;
    if (dingtalkUrl) {
      this.adapters.set('dingtalk', new DingTalkAdapter(dingtalkUrl, dingtalkToken));
    }
  }

  /**
   * 发送通知消息
   */
  async notify(message: NotificationMessage): Promise<NotificationResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    // 检查优先级过滤
    if (!this.shouldSend(message)) {
      return [];
    }

    // 检查免打扰时段
    if (this.isQuietHours()) {
      return [];
    }

    const results: NotificationResult[] = [];
    const enabledPlatforms = this.getEnabledPlatforms();

    // 并发推送到所有启用的平台
    await Promise.all(
      enabledPlatforms.map(async (platform) => {
        const adapter = this.adapters.get(platform);
        if (!adapter) return;

        try {
          const success = await adapter.send(message);
          results.push({
            success,
            platform,
            timestamp: Date.now(),
          });
        } catch (error) {
          results.push({
            success: false,
            platform,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          });
        }
      })
    );

    return results;
  }

  /**
   * 快捷方法：发送错误通知
   */
  async notifyError(
    title: string,
    content: string,
    errorDetails?: string
  ): Promise<NotificationResult[]> {
    if (!this.config.autoTriggers.onError) {
      return [];
    }

    return this.notify({
      type: 'error',
      priority: 'urgent',
      title: `🚨 ${title}`,
      content,
      timestamp: Date.now(),
      metadata: { errorDetails },
    });
  }

  /**
   * 快捷方法：发送完成通知
   */
  async notifyCompletion(
    title: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult[]> {
    if (!this.config.autoTriggers.onCompletion) {
      return [];
    }

    return this.notify({
      type: 'completion',
      priority: 'normal',
      title: `✅ ${title}`,
      content,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * 快捷方法：发送知识提取通知
   */
  async notifyKnowledge(
    title: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult[]> {
    if (!this.config.autoTriggers.onKnowledge) {
      return [];
    }

    return this.notify({
      type: 'knowledge',
      priority: 'normal',
      title: `💡 ${title}`,
      content,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * 快捷方法：发送进度通知
   */
  async notifyProgress(
    title: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult[]> {
    // 检查进度通知间隔
    const interval = this.config.autoTriggers.progressInterval;
    if (!interval || interval <= 0) {
      return [];
    }

    const now = Date.now();
    const elapsed = (now - this.lastProgressNotify) / 1000 / 60; // 分钟

    if (elapsed < interval) {
      return [];
    }

    this.lastProgressNotify = now;

    return this.notify({
      type: 'progress',
      priority: 'low',
      title: `📊 ${title}`,
      content,
      timestamp: now,
      metadata,
    });
  }

  /**
   * 测试所有启用的平台
   */
  async testAll(): Promise<Record<PlatformType, boolean>> {
    const results: Partial<Record<PlatformType, boolean>> = {};
    const enabledPlatforms = this.getEnabledPlatforms();

    await Promise.all(
      enabledPlatforms.map(async (platform) => {
        const adapter = this.adapters.get(platform);
        if (adapter) {
          results[platform] = await adapter.test();
        }
      })
    );

    return results as Record<PlatformType, boolean>;
  }

  /**
   * 获取启用的平台列表
   */
  private getEnabledPlatforms(): PlatformType[] {
    return this.config.platforms.filter((platform) => {
      const adapter = this.adapters.get(platform);
      return adapter?.enabled;
    });
  }

  /**
   * 检查是否应该发送消息（优先级过滤）
   */
  private shouldSend(message: NotificationMessage): boolean {
    const priorityLevel: Record<NotificationPriority, number> = {
      low: 0,
      normal: 1,
      high: 2,
      urgent: 3,
    };

    return (
      priorityLevel[message.priority] >= priorityLevel[this.config.filters.minPriority]
    );
  }

  /**
   * 检查是否在免打扰时段
   */
  private isQuietHours(): boolean {
    const { quietHours } = this.config.filters;
    if (!quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // 跨越午夜的情况
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * 合并默认配置
   */
  private mergeConfig(config?: Partial<NotificationConfig>): NotificationConfig {
    const defaultConfig: NotificationConfig = {
      enabled: true,
      platforms: ['wechat', 'feishu', 'dingtalk'],
      autoTriggers: {
        onError: true,
        onCompletion: true,
        onKnowledge: true,
        progressInterval: 0, // 默认禁用定时进度报告
      },
      filters: {
        minPriority: 'low',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      },
    };

    return {
      ...defaultConfig,
      ...config,
      autoTriggers: {
        ...defaultConfig.autoTriggers,
        ...config?.autoTriggers,
      },
      filters: {
        ...defaultConfig.filters,
        ...config?.filters,
        quietHours: {
          ...defaultConfig.filters.quietHours,
          ...config?.filters?.quietHours,
        },
      },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = this.mergeConfig(config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}
