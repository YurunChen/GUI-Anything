import { BasePlatformAdapter } from './base';
import type { NotificationMessage, PlatformType } from '../types';

/**
 * 微信推送适配器
 * 支持：
 * 1. Server酱 (https://sct.ftqq.com/)
 * 2. 企业微信机器人 Webhook
 */
export class WechatAdapter extends BasePlatformAdapter {
  name: PlatformType = 'wechat';
  private adapterType: 'serverchan' | 'work_webhook';

  constructor(webhookUrl?: string, token?: string) {
    super(webhookUrl, token);

    // 根据 URL 判断是 Server酱 还是企业微信
    if (webhookUrl?.includes('sctapi.ftqq.com')) {
      this.adapterType = 'serverchan';
    } else if (webhookUrl?.includes('qyapi.weixin.qq.com')) {
      this.adapterType = 'work_webhook';
    } else {
      this.adapterType = 'serverchan'; // 默认
    }
  }

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
      return false;
    }

    try {
      if (this.adapterType === 'serverchan') {
        return await this.sendViaServerChan(message);
      } else {
        return await this.sendViaWorkWebhook(message);
      }
    } catch (error) {
      console.error(`[WechatAdapter] Send failed:`, error);
      return false;
    }
  }

  /**
   * Server酱推送
   * URL 格式: https://sctapi.ftqq.com/YOUR_SENDKEY.send
   */
  private async sendViaServerChan(message: NotificationMessage): Promise<boolean> {
    const emoji = this.getPriorityEmoji(message.priority);
    const formattedContent = this.formatMessage(message);

    const response = await fetch(this.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${emoji} ${message.title}`,
        desp: formattedContent,
      }),
    });

    const result = await response.json();
    return result.code === 0;
  }

  /**
   * 企业微信机器人推送
   * URL 格式: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
   */
  private async sendViaWorkWebhook(message: NotificationMessage): Promise<boolean> {
    const emoji = this.getPriorityEmoji(message.priority);
    const formattedContent = this.formatMessage(message);

    const response = await fetch(this.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: `${emoji} ${message.title}\n\n${formattedContent}`,
        },
      }),
    });

    const result = await response.json();
    return result.errcode === 0;
  }
}
