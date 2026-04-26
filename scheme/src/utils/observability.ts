/**
 * Observability utilities for error tracking and metrics.
 * Lightweight logging with categorization for production debugging.
 */

export type ErrorCategory =
  | 'parse'       // JSON/schema parsing errors
  | 'io'          // File/network I/O errors
  | 'ai'          // AI/subprocess errors
  | 'db'          // Database errors
  | 'logic'       // Business logic errors
  | 'unknown';    // Uncategorized

interface ErrorReport {
  category: ErrorCategory;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

// Simple in-memory metrics (could be exported to external system)
const metrics: Record<ErrorCategory, number> = {
  parse: 0,
  io: 0,
  ai: 0,
  db: 0,
  logic: 0,
  unknown: 0,
};

const recentErrors: ErrorReport[] = [];
const MAX_RECENT_ERRORS = 100;

/**
 * Report an error with categorization
 */
export function reportError(
  category: ErrorCategory,
  message: string,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    category,
    message,
    context,
    timestamp: Date.now(),
  };

  metrics[category]++;
  recentErrors.push(report);

  // Keep only recent errors
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.shift();
  }

  // Log to stderr for visibility
  const ctx = context ? ` | ${JSON.stringify(context)}` : '';
  console.error(`[${category}] ${message}${ctx}`);
}

/**
 * Safely execute a function, reporting errors without throwing
 */
export function safeExecute<T>(
  category: ErrorCategory,
  operation: string,
  fn: () => T,
  fallback?: T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportError(category, `${operation} failed: ${message}`, {
      operation,
      error: message,
    });
    return fallback;
  }
}

/**
 * Safely execute an async function, reporting errors without throwing
 */
export async function safeExecuteAsync<T>(
  category: ErrorCategory,
  operation: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportError(category, `${operation} failed: ${message}`, {
      operation,
      error: message,
    });
    return fallback;
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): Record<ErrorCategory, number> {
  return { ...metrics };
}

/**
 * Get recent errors for debugging
 */
export function getRecentErrors(limit = 20): ErrorReport[] {
  return recentErrors.slice(-limit);
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  for (const key of Object.keys(metrics) as ErrorCategory[]) {
    metrics[key] = 0;
  }
  recentErrors.length = 0;
}
