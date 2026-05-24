import { BasePlatformAdapter } from './base';
import type { NotificationMessage, PlatformType } from '../types';

/**
 * 飞书推送适配器
 * 使用飞书自定义机器人 Webhook
 * 文档: https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 */
export class FeishuAdapter extends BasePlatformAdapter {
  name: PlatformType = 'feishu';

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
      return false;
    }

    try {
      const emoji = this.getPriorityEmoji(message.priority);
      const formattedContent = this.formatMessage(message);

      // 飞书支持富文本，使用 post 格式
      const payload: any = {
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title: `${emoji} ${message.title}`,
              content: this.buildFeishuContent(message),
            },
          },
        },
      };

      // 如果配置了签名 token，添加签名
      if (this.token) {
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = await this.generateSign(timestamp);
        payload.timestamp = timestamp;
        payload.sign = sign;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return result.code === 0 || result.StatusCode === 0;
    } catch (error) {
      console.error(`[FeishuAdapter] Send failed:`, error);
      return false;
    }
  }

  /**
   * 构建飞书富文本内容
   */
  private buildFeishuContent(message: NotificationMessage): any[] {
    const content: any[] = [
      [{ tag: 'text', text: message.content }],
    ];

    if (message.metadata) {
      const metaLines: string[] = [];

      if (message.metadata.phase) {
        metaLines.push(`📊 阶段: ${message.metadata.phase}`);
      }
      if (message.metadata.toolCount !== undefined) {
        metaLines.push(`🔧 工具调用: ${message.metadata.toolCount}`);
      }
      if (message.metadata.sessionId) {
        metaLines.push(`🆔 Session: ${message.metadata.sessionId.slice(0, 8)}...`);
      }

      if (metaLines.length > 0) {
        content.push([{ tag: 'text', text: '\n' + metaLines.join('\n') }]);
      }
    }

    const time = new Date(message.timestamp).toLocaleString('zh-CN');
    content.push([{ tag: 'text', text: `\n⏰ ${time}` }]);

    return content;
  }

  /**
   * 生成飞书签名（如果配置了 token）
   */
  private async generateSign(timestamp: number): Promise<string> {
    if (!this.token) return '';

    const stringToSign = `${timestamp}\n${this.token}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);

    // 使用 Web Crypto API 计算 HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.token),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);

    // 转换为 Base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
}
