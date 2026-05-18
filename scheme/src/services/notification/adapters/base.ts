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
    const { title, content, timestamp, metadata } = message;
    const time = new Date(timestamp).toLocaleString('zh-CN');

    let text = `📌 ${title}\n\n${content}\n\n`;

    if (metadata) {
      if (metadata.phase) text += `📊 阶段: ${metadata.phase}\n`;
      if (metadata.toolCount) text += `🔧 工具调用: ${metadata.toolCount}\n`;
      if (metadata.sessionId) text += `🆔 Session: ${metadata.sessionId.slice(0, 8)}...\n`;
    }

    text += `\n⏰ ${time}`;

    return text;
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
