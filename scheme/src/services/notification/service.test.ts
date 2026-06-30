import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { resetLoggerConfigForTests } from '../../utils/logger';
import { DEFAULT_WECHAT_SERVICE_URL } from './config';
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
    let sentText = '';
    globalThis.fetch = mockFetch((url, init) => {
      requests.push(url);
      if (url.endsWith('/status')) {
        return jsonResponse({ logged_in: true, account_id: 'bot@im.bot' });
      }
      sentText = JSON.parse(String(init?.body || '{}')).text;
      return jsonResponse({ success: true, message: 'ok' });
    });

    const service = new NotificationService();
    const results = await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
      metadata: {
        phase: 'verify',
        toolCount: 3,
        sessionId: '1234567890abcdef',
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ platform: 'wechat', success: true });
    expect(requests).toEqual([
      `${DEFAULT_WECHAT_SERVICE_URL}/status`,
      `${DEFAULT_WECHAT_SERVICE_URL}/send`,
    ]);
    expect(sentText.match(/snapshot/g)?.length).toBe(1);
    expect(sentText).not.toContain('📌');
    expect(sentText).toContain('snapshot\n\nbody');
    expect(sentText).not.toContain('Session');
    expect(sentText).not.toContain('阶段 verify');
    expect(sentText).not.toContain('3 tools');
  });

  test('normalizes a trailing slash in the WeChat service URL', async () => {
    process.env.FLOW_NOTIFY_WECHAT_USER_ID = 'user@im.wechat';
    process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL = `${DEFAULT_WECHAT_SERVICE_URL}/`;
    const requests: string[] = [];
    globalThis.fetch = mockFetch((url) => {
      requests.push(url);
      if (url.endsWith('/status')) {
        return jsonResponse({ logged_in: true, account_id: 'bot@im.bot' });
      }
      return jsonResponse({ success: true, message: 'ok' });
    });

    const service = new NotificationService();
    await service.notify({
      type: 'manual',
      priority: 'normal',
      title: 'snapshot',
      content: 'body',
      timestamp: Date.now(),
    });

    expect(requests).toEqual([
      `${DEFAULT_WECHAT_SERVICE_URL}/status`,
      `${DEFAULT_WECHAT_SERVICE_URL}/send`,
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

function mockFetch(handler: (url: string, init?: RequestInit) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init);
  }) as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
