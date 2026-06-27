/**
 * Deterministic keyword → semantic icon mapping for evolution milestones/eras.
 * Used as the rule fallback when AI synthesis is off/unavailable, and to fill
 * node icons (AI only assigns era icons). Names come from EVOLUTION_ICON_NAMES.
 */

import type { EvolutionIcon } from '../../data/protocol/evolution-types';

/** Ordered rules: first matching keyword wins. Earlier = higher priority. */
const RULES: Array<{ icon: EvolutionIcon; keywords: string[] }> = [
  { icon: 'eye', keywords: ['observ', '观察', '监听', 'watch', 'timeline', '时间轴', 'monitor', '追踪'] },
  { icon: 'book', keywords: ['wiki', '知识', '沉淀', 'doc', '文档', '笔记', 'note', 'curat', '策展'] },
  { icon: 'bar-chart', keywords: ['可视化', 'visual', 'chart', '图表', '报表', 'graph', 'dashboard', '仪表'] },
  { icon: 'layout', keywords: ['ui', '界面', '布局', '前端', 'layout', '样式', 'css', 'frontend', '排版', 'html'] },
  { icon: 'database', keywords: ['数据', 'data', '存储', 'repository', '仓储', 'db', 'persist', '落盘', 'bundle'] },
  { icon: 'bug', keywords: ['修复', 'fix', 'bug', '错误', 'debug', '排查', '故障', 'error'] },
  { icon: 'wrench', keywords: ['重构', 'refactor', '改造', '清理', 'cleanup', '工具', 'tooling', '迁移', 'migrate'] },
  { icon: 'zap', keywords: ['优化', 'perf', '性能', '加速', 'speed', 'fast', 'optimi'] },
  { icon: 'shield', keywords: ['测试', 'test', '安全', 'security', '校验', 'validate', '健壮'] },
  { icon: 'rocket', keywords: ['发布', 'release', '上线', 'launch', '部署', 'deploy', 'ship', '导出', 'export'] },
  { icon: 'search', keywords: ['探索', 'explore', '分析', 'analy', '查找', 'research', '搜索', '调研', '理解'] },
  { icon: 'compass', keywords: ['设计', 'design', '规划', 'plan', '方案', '架构', 'architect'] },
  { icon: 'git-branch', keywords: ['分支', 'branch', 'pivot', '转向', '切换', '主线'] },
  { icon: 'package', keywords: ['构建', 'build', '打包', '模块', 'module', 'package', '集成', 'integrat'] },
  { icon: 'terminal', keywords: ['cli', '命令', '终端', 'shell', 'command', '脚本', 'script'] },
  { icon: 'code', keywords: ['实现', 'implement', '开发', '编码', 'code', '编写', '功能'] },
  { icon: 'sparkles', keywords: ['ai', '智能', '合成', 'feature', '新功能', 'llm', 'agent'] },
];

/** Pick the most fitting icon for a milestone/era from its title + intent key. */
export function pickIcon(text: string, intentKey?: string): EvolutionIcon {
  const haystack = `${text} ${intentKey ?? ''}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) return rule.icon;
  }
  return 'flag';
}
