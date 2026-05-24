import { BasePlatformAdapter } from './base';
import type { NotificationMessage, PlatformType } from '../types';

/**
 * 钉钉推送适配器
 * 使用钉钉自定义机器人 Webhook
 * 文档: https://open.dingtalk.com/document/robots/custom-robot-access
 */
export class DingTalkAdapter extends BasePlatformAdapter {
  name: PlatformType = 'dingtalk';

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
      return false;
    }

    try {
      const emoji = this.getPriorityEmoji(message.priority);
      const formattedContent = this.formatMessage(message);

      const payload: any = {
        msgtype: 'markdown',
        markdown: {
          title: `${emoji} ${message.title}`,
          text: this.buildMarkdownText(message),
        },
      };

      // 如果配置了签名 token，添加签名
      let url = this.webhookUrl;
      if (this.token) {
        const timestamp = Date.now();
        const sign = await this.generateSign(timestamp);
        url = `${this.webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return result.errcode === 0;
    } catch (error) {
      console.error(`[DingTalkAdapter] Send failed:`, error);
      return false;
    }
  }

  /**
   * 构建 Markdown 文本
   */
  private buildMarkdownText(message: NotificationMessage): string {
    const emoji = this.getPriorityEmoji(message.priority);
    let text = `### ${emoji} ${message.title}\n\n`;
    text += `${message.content}\n\n`;

    if (message.metadata) {
      text += `---\n\n`;

      if (message.metadata.phase) {
        text += `- 📊 **阶段**: ${message.metadata.phase}\n`;
      }
      if (message.metadata.toolCount !== undefined) {
        text += `- 🔧 **工具调用**: ${message.metadata.toolCount}\n`;
      }
      if (message.metadata.sessionId) {
        text += `- 🆔 **Session**: \`${message.metadata.sessionId.slice(0, 8)}...\`\n`;
      }

      text += `\n`;
    }

    const time = new Date(message.timestamp).toLocaleString('zh-CN');
    text += `> ⏰ ${time}`;

    return text;
  }

  /**
   * 生成钉钉签名（如果配置了 token）
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
