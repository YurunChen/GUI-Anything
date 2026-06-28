#!/usr/bin/env bun

/**
 * Render the intent buddy strip through the real OpenTUI renderer.
 *
 * This is a developer preview only: it exercises the same status bar component
 * used by the app, then exits automatically so it is safe in CI-ish terminals.
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { useEffect, useMemo, useState } from 'react';
import { resolveBuddyProfileFromIntent } from '../src/app/observer/view-model/buddy-profile';
import { ObserverStatusBar } from '../src/app/ui/flow/ObserverStatusBar';
import { useTuiTheme } from '../src/app/ui/theme';

const PREVIEW_INTENTS = [
  { intentKey: 'explore', title: 'Trace project shape' },
  { intentKey: 'project_design', title: 'Map system architecture' },
  { intentKey: 'implement', title: 'Ship the smallest complete feature' },
  { intentKey: 'refactor', title: 'Polish motion and layout' },
  { intentKey: 'debug', title: 'Pin down broken state' },
  { intentKey: 'research', title: 'Collect durable knowledge' },
] as const;

function readDurationMs(): number {
  const raw = Bun.argv.find(arg => arg.startsWith('--duration='))?.slice('--duration='.length);
  const parsed = raw ? Number(raw) : 1800;
  return Number.isFinite(parsed) ? Math.max(300, parsed) : 1800;
}

function BuddyStatusPreviewApp(): JSX.Element {
  const theme = useTuiTheme();
  const [motionFrame, setMotionFrame] = useState(0);
  const terminalWidth = Math.max(84, Math.min(120, process.stdout.columns || 96));

  useEffect(() => {
    const timer = setInterval(() => setMotionFrame(frame => frame + 1), 180);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(() => PREVIEW_INTENTS.map(intent => ({
    ...intent,
    buddy: resolveBuddyProfileFromIntent(intent.intentKey, 'en'),
  })), []);

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: theme.semantic.fill.base,
        paddingTop: 1,
      }}
    >
      <text wrapMode="none" fg={theme.semantic.label.muted}>
        {'OpenTUI buddy status preview · fixed-height intent animals · auto exit'}
      </text>
      {rows.map((row, index) => (
        <box
          key={row.intentKey}
          style={{
            width: '100%',
            flexDirection: 'column',
            marginTop: index === 0 ? 1 : 0,
          }}
        >
          <ObserverStatusBar
            sessionMode="live"
            runtimeModel="qwen3.6-flash"
            tokenDisplay="Tok 0"
            completedCount={index}
            errorCount={0}
            terminalWidth={terminalWidth}
            viewMode="timeline"
            liveIntent={row}
            intentBuddy={row.buddy}
            buddyMotionFrame={motionFrame + index}
          />
        </box>
      ))}
    </box>
  );
}

async function main(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: false,
    enableMouseMovement: false,
    targetFps: 12,
  });
  const root = createRoot(renderer);
  const cleanup = () => {
    root.unmount();
    renderer.destroy();
  };

  root.render(<BuddyStatusPreviewApp />);
  setTimeout(() => {
    cleanup();
    process.exit(0);
  }, readDurationMs());
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
