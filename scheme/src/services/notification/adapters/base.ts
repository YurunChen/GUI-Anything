import type { PlatformAdapter, NotificationMessage, PlatformType } from '../types';

/**
 * 平台适配器基类
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract name: PlatformType;
  enabled: boolean = false;

  constructor(protected webhookUrl?: string, protected token?: string) {
    this.enabled = !!webhookUrl;
  }

  abstract send(message: NotificationMessage): Promise<boolean>;

  async test(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const testMessage: NotificationMessage = {
      type: 'manual',
      priority: 'low',
      title: '🔔 Flow Notify 测试',
      content: `${this.name} 通知服务已成功配置`,
      timestamp: Date.now(),
    };

    return this.send(testMessage);
  }

  protected formatMessage(message: NotificationMessage): string {
    const { title, content, timestamp } = message;
    const time = new Date(timestamp).toLocaleString('zh-CN');

    return [
      title.trim(),
      '',
      content.trim(),
      '',
      time,
    ].filter((line): line is string => line !== null).join('\n').trim();
  }

  protected getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'normal': return 'ℹ️';
      case 'low': return '💬';
      default: return '📢';
    }
  }
}
