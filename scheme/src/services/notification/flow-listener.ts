import type { ActivityTree, RepeatAlert } from '../../domain/types';
import type { NotificationService } from './service';
import type { NotificationResult } from './types';

/**
 * Flow Observer 事件监听器
 * 负责监听 Observer 的关键事件并触发通知
 */
export class FlowNotificationListener {
  private lastErrorCount: number = 0;
  private lastToolCount: number = 0;
  private sessionStartTime: number = Date.now();

  constructor(
    private notificationService: NotificationService,
    private sessionId?: string,
    private projectDir?: string
  ) {}

  /**
   * 监听 ActivityTree 更新
   */
  async onTreeUpdate(tree: ActivityTree): Promise<void> {
    // 检测新错误
    await this.checkForErrors(tree);

    // 检测工具调用增长（可选的进度通知）
    await this.checkProgress(tree);
  }

  /**
   * 监听任务完成事件
   */
  async onCompletion(tree: ActivityTree, summary?: string): Promise<NotificationResult[]> {
    const duration = this.formatDuration(Date.now() - this.sessionStartTime);
    const content = summary || '任务已完成';

    return this.notificationService.notifyCompletion('Flow 任务完成', content, {
      sessionId: this.sessionId,
      projectDir: this.projectDir,
      duration,
      toolCount: tree.stats.toolCallCount,
      phase: tree.phase.current,
    });
  }

  /**
   * 监听知识提取事件
   */
  async onKnowledgeExtracted(title: string, content: string): Promise<NotificationResult[]> {
    return this.notificationService.notifyKnowledge('新知识提取', content, {
      sessionId: this.sessionId,
      projectDir: this.projectDir,
      extractedAt: new Date().toISOString(),
    });
  }

  /**
   * 手动快照推送
   */
  async sendManualSnapshot(tree: ActivityTree, note?: string): Promise<NotificationResult[]> {
    const duration = this.formatDuration(Date.now() - this.sessionStartTime);
    const content = note || this.buildSnapshotContent(tree);

    return this.notificationService.notify({
      type: 'manual',
      priority: 'normal',
      title: '📸 Flow 快照',
      content,
      timestamp: Date.now(),
      metadata: {
        sessionId: this.sessionId,
        projectDir: this.projectDir,
        duration,
        phase: tree.phase.current,
        toolCount: tree.stats.toolCallCount,
        thinkingCount: tree.stats.thinkingCount,
      },
    });
  }

  /**
   * 检测错误和告警
   */
  private async checkForErrors(tree: ActivityTree): Promise<void> {
    const currentErrorCount = tree.alerts.filter((a) => a.severity === 'error').length;
    const currentErrors = tree.alerts.filter((a) => a.severity === 'error');

    if (currentErrorCount > this.lastErrorCount) {
      const newErrors = currentErrors.slice(this.lastErrorCount);
      const errorDetails = newErrors
        .map((alert) => `${alert.tool}: ${alert.params} (${alert.count}次重复)`)
        .join('\n');

      await this.notificationService.notifyError(
        'Flow 检测到错误',
        `检测到 ${newErrors.length} 个新错误或重复操作`,
        errorDetails
      );
    }

    this.lastErrorCount = currentErrorCount;
  }

  /**
   * 检测进度变化
   */
  private async checkProgress(tree: ActivityTree): Promise<void> {
    const currentToolCount = tree.stats.toolCallCount;

    // 每 10 个工具调用触发一次进度通知检查
    if (currentToolCount - this.lastToolCount >= 10) {
      const duration = this.formatDuration(Date.now() - this.sessionStartTime);
      const content = this.buildProgressContent(tree, duration);

      await this.notificationService.notifyProgress('Flow 进度更新', content, {
        sessionId: this.sessionId,
        projectDir: this.projectDir,
        phase: tree.phase.current,
        toolCount: currentToolCount,
      });

      this.lastToolCount = currentToolCount;
    }
  }

  /**
   * 构建快照内容
   */
  private buildSnapshotContent(tree: ActivityTree): string {
    const lines: string[] = [];

    lines.push(`**当前阶段**: ${tree.phase.current}`);
    lines.push(`**工具调用**: ${tree.stats.toolCallCount}`);
    lines.push(`**思考次数**: ${tree.stats.thinkingCount}`);
    lines.push(`**回复次数**: ${tree.stats.responseCount}`);

    if (tree.alerts.length > 0) {
      lines.push(`\n⚠️ **告警**: ${tree.alerts.length} 个`);
    }

    if (tree.fileAccess.size > 0) {
      const topFiles = Array.from(tree.fileAccess.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([file, count]) => `  • ${file} (${count}次)`)
        .join('\n');
      lines.push(`\n📁 **热点文件**:\n${topFiles}`);
    }

    return lines.join('\n');
  }

  /**
   * 构建进度内容
   */
  private buildProgressContent(tree: ActivityTree, duration: string): string {
    return `当前进度:\n\n${this.buildSnapshotContent(tree)}\n\n⏱️ 已运行: ${duration}`;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}
