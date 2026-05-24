import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';
import { LiveObserverContainer } from '../observer/LiveObserverContainer';

export function LiveObserverView(): ReactNode {
  return <LiveObserverContainer />;
}

export async function renderLiveObserver(_cwd?: string): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
    enableMouseMovement: false,
  });
  const root = createRoot(renderer);
  root.render(<LiveObserverView />);
}
