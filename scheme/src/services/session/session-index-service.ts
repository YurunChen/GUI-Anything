/**
 * Session index facade — continue pointer in wiki/sessions/_index.json.
 */

import type { SessionId } from '../../data/protocol/observer-protocol';
import {
  touchLastSession as touchLastSessionRecord,
  type SessionIndex,
} from '../../data/session/session-index';
import { createLogger } from '../../utils/logger';

const log = createLogger('index');

export class SessionIndexService {
  touchLastSession(input: {
    sessionId: SessionId;
    cwd: string;
    jsonlMtime?: number;
    bundleUpdatedAt?: number;
    wikiRoot?: string;
  }): SessionIndex {
    log.debug('touch last session', {
      sessionId: input.sessionId,
      jsonlMtime: input.jsonlMtime,
      bundleUpdatedAt: input.bundleUpdatedAt,
    });
    return touchLastSessionRecord(input);
  }
}

let defaultService: SessionIndexService | null = null;

export function getSessionIndexService(): SessionIndexService {
  if (!defaultService) {
    defaultService = new SessionIndexService();
  }
  return defaultService;
}
