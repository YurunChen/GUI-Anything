export const INTENT_BUDDY_PREVIEW_ITEMS = [
  { intentKey: 'explore', badge: 'Explore', title: 'Trace project shape' },
  { intentKey: 'project_design', badge: 'Design', title: 'Map system architecture' },
  { intentKey: 'implement', badge: 'Build', title: 'Ship a complete feature' },
  { intentKey: 'refactor', badge: 'Refine', title: 'Polish motion and layout' },
  { intentKey: 'debug', badge: 'Debug', title: 'Pin down broken state' },
  { intentKey: 'test_verify', badge: 'Verify', title: 'Check behavior and regressions' },
  { intentKey: 'devops', badge: 'DevOps', title: 'Run tools and terminal flows' },
  { intentKey: 'research', badge: 'Research', title: 'Collect durable knowledge' },
] as const;

export type IntentBuddyPreviewItem = (typeof INTENT_BUDDY_PREVIEW_ITEMS)[number];
