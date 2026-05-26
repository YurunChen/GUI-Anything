import type { LiveIntentChromeView } from './intent-chrome';
import type { SessionPresentationMode } from '../../../services/session/session-runtime-policy';

/** View-model chrome props — UI components implement these shapes. */
export interface ObserverStatusBarViewProps {
  sessionMode: SessionPresentationMode;
  runtimeModel: string;
  tokenDisplay: string;
  completedCount: number;
  errorCount: number;
  notifyStatus?: string;
  themeNotification?: string;
  terminalWidth: number;
  fileAccessLine?: string;
  /** Session narrative: prior exploration labels joined with → */
  sessionArc?: string;
  /** Current trunk intent title (flowchart.node_title). */
  liveIntent?: LiveIntentChromeView;
}
