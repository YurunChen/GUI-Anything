import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { resetLoggerConfigForTests } from '../../utils/logger';
import { NotificationService } from './service';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.FLOW_LOG_DISABLED = '1';
  resetLoggerConfigForTests();
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetLoggerConfigForTests();
  globalThis.fetch = originalFetch;
});

describe('NotificationService', () => {
  test('skips when WeChat user id is not configured', async () => {
    delete process.env.FLOW_NOTIFY_WECHAT_USER_ID;
    const service = new NotificationService();

    const results = await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
    });

    expect(results).toEqual([]);
  });

  test('sends a WeChat notification through the local service', async () => {
    process.env.FLOW_NOTIFY_WECHAT_USER_ID = 'user@im.wechat';
    const requests: string[] = [];
    globalThis.fetch = mockFetch((url) => {
      requests.push(url);
      if (url.endsWith('/status')) {
        return jsonResponse({ logged_in: true, account_id: 'bot@im.bot' });
      }
      return jsonResponse({ success: true, message: 'ok' });
    });

    const service = new NotificationService();
    const results = await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ platform: 'wechat', success: true });
    expect(requests).toEqual([
      'http://127.0.0.1:8765/status',
      'http://127.0.0.1:8765/send',
    ]);
  });

  test('reports WeChat send failure without throwing', async () => {
    process.env.FLOW_NOTIFY_WECHAT_USER_ID = 'user@im.wechat';
    globalThis.fetch = mockFetch((url) => {
      if (url.endsWith('/status')) {
        return jsonResponse({ logged_in: true, account_id: 'bot@im.bot' });
      }
      return jsonResponse({ success: false });
    });

    const service = new NotificationService();
    const results = await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ platform: 'wechat', success: false });
  });

  test('filters below minimum priority', async () => {
    process.env.FLOW_NOTIFY_WECHAT_USER_ID = 'user@im.wechat';
    let calls = 0;
    globalThis.fetch = mockFetch(() => {
      calls += 1;
      return jsonResponse({ logged_in: true });
    });

    const service = new NotificationService({
      filters: {
        minPriority: 'urgent',
        quietHours: { enabled: false, start: '22:00', end: '08:00' },
      },
    });
    const results = await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
    });

    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});

function mockFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url);
  }) as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
