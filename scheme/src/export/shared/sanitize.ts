/**
 * 隐私脱敏工具
 * 处理路径、敏感信息等
 */

const HOME = process.env.HOME || '/home/user';

/** 将绝对路径转换为相对路径表示 */
export function sanitizePath(absPath: string): string {
  if (absPath.startsWith(HOME)) {
    return '~' + absPath.slice(HOME.length);
  }
  return absPath;
}

/** 过滤敏感信息 */
export function redactSecrets(text: string): string {
  // 替换常见的 token/secret 模式
  return text
    .replace(/(?:token|secret|password|api[_-]?key|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{8,}["']?/gi, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_\-./+]{20,}/g, 'Bearer [REDACTED]')
    .replace(/ghp_[A-Za-z0-9]{36,}/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED]');
}

/** 安全截断文本 */
export function truncateDetail(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '\n\n... [truncated, ' + (text.length - maxLength) + ' chars omitted]';
}