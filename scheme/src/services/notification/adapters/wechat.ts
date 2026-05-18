import { BasePlatformAdapter } from './base';
import type { NotificationMessage, PlatformType } from '../types';

/**
 * 微信推送适配器
 *
 * 使用 iLink Bot API（通过独立的 Python 微服务）
 * 基于 Hermes-agent 的实现，支持扫码登录
 *
 * 环境变量：
 * - FLOW_NOTIFY_WECHAT_USER_ID: 接收消息的微信用户ID
 * - FLOW_NOTIFY_WECHAT_SERVICE_URL: Python服务地址（默认: http://127.0.0.1:8765）
 */
export class WechatAdapter extends BasePlatformAdapter {
  name: PlatformType = 'wechat';
  private serviceUrl: string;
  private toUserId?: string;

  constructor(webhookUrl?: string, token?: string) {
    // webhookUrl 在这里用作 user_id
    super(webhookUrl, token);

    this.toUserId = webhookUrl; // 微信用户ID
    this.serviceUrl = process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL || 'http://127.0.0.1:8765';

    // 检查是否已配置
    this.enabled = !!this.toUserId;
  }

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled || !this.toUserId) {
      return false;
    }

    try {
      // 检查服务状态
      const statusOk = await this.checkService();
      if (!statusOk) {
        console.error('[WechatAdapter] Python service not available');
        return false;
      }

      const emoji = this.getPriorityEmoji(message.priority);
      const formattedContent = this.formatMessage(message);
      const text = `${emoji} ${message.title}\n\n${formattedContent}`;

      // 调用 Python 服务发送消息
      const response = await fetch(`${this.serviceUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: this.toUserId,
          text: text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[WechatAdapter] Send failed:`, error);
        return false;
      }

      const result = await response.json();
      return result.success === true;

    } catch (error) {
      console.error(`[WechatAdapter] Send failed:`, error);
      return false;
    }
  }

  /**
   * 检查 Python 服务是否可用
   */
  private async checkService(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/status`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const status = await response.json();

      // 检查是否已登录
      if (!status.logged_in) {
        console.error(
          '[WechatAdapter] Not logged in. Please run: ' +
          'cd scheme/src/services/notification/weixin-service && ' +
          'python server.py (then POST to /login)'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WechatAdapter] Service check failed:', error);
      return false;
    }
  }

  async test(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    // 先检查服务状态
    const serviceOk = await this.checkService();
    if (!serviceOk) {
      console.error('[WechatAdapter] Python service not ready');
      return false;
    }

    const testMessage: NotificationMessage = {
      type: 'manual',
      priority: 'low',
      title: '🔔 Flow Notify 测试',
      content: `iLink Bot 通知服务已成功配置`,
      timestamp: Date.now(),
    };

    return this.send(testMessage);
  }
}
