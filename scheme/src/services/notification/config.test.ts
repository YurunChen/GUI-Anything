import { describe, expect, test } from 'bun:test';
import { resolveWechatServiceUrl } from './config';

describe('resolveWechatServiceUrl', () => {
  test('uses explicit service URL before host and port', () => {
    expect(resolveWechatServiceUrl({
      FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:7777',
      FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
    } as NodeJS.ProcessEnv)).toBe('http://127.0.0.1:7777');
    expect(resolveWechatServiceUrl({
      FLOW_NOTIFY_WECHAT_SERVICE_URL: 'http://127.0.0.1:7777/',
    } as NodeJS.ProcessEnv)).toBe('http://127.0.0.1:7777');
  });

  test('builds URL from host and port overrides', () => {
    expect(resolveWechatServiceUrl({
      FLOW_NOTIFY_WECHAT_SERVICE_HOST: '0.0.0.0',
      FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
    } as NodeJS.ProcessEnv)).toBe('http://0.0.0.0:9999');
    expect(resolveWechatServiceUrl({
      FLOW_NOTIFY_WECHAT_SERVICE_PORT: '9999',
    } as NodeJS.ProcessEnv)).toBe('http://127.0.0.1:9999');
  });
});
