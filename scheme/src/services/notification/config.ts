export const DEFAULT_WECHAT_SERVICE_HOST = '127.0.0.1';
export const DEFAULT_WECHAT_SERVICE_PORT = 8765;
export const DEFAULT_WECHAT_SERVICE_URL = `http://${DEFAULT_WECHAT_SERVICE_HOST}:${DEFAULT_WECHAT_SERVICE_PORT}`;

function normalizeWechatServiceUrl(serviceUrl: string): string {
  return serviceUrl.replace(/\/+$/, '');
}

export function resolveWechatServiceUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicitUrl = env.FLOW_NOTIFY_WECHAT_SERVICE_URL?.trim();
  if (explicitUrl) return normalizeWechatServiceUrl(explicitUrl);

  const host = env.FLOW_NOTIFY_WECHAT_SERVICE_HOST?.trim() || DEFAULT_WECHAT_SERVICE_HOST;
  const port = env.FLOW_NOTIFY_WECHAT_SERVICE_PORT?.trim() || String(DEFAULT_WECHAT_SERVICE_PORT);
  return `http://${host}:${port}`;
}
