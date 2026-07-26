"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ScreenTransitionDeckProps = {
  screenKey: string;
  children: ReactNode;
  durationMs?: number;
};

/**
 * Keeps exactly the outgoing and incoming page alive during navigation.
 * Machine state continues to update independently while the old page exits.
 */
export function ScreenTransitionDeck({
  screenKey,
  children,
  durationMs = 420,
}: ScreenTransitionDeckProps) {
  const previous = useRef({ screenKey, children });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [outgoing, setOutgoing] = useState<ReactNode>(null);

  useLayoutEffect(() => {
    if (previous.current.screenKey !== screenKey) {
      setOutgoing(previous.current.children);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setOutgoing(null);
        timer.current = null;
      }, durationMs);
    }
    previous.current = { screenKey, children };
  }, [children, durationMs, screenKey]);

  useLayoutEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="screen-deck" data-current-screen={screenKey}>
      {outgoing ? (
        <div className="screen-page screen-page--outgoing" aria-hidden="true">
          {outgoing}
        </div>
      ) : null}
      <div className="screen-page screen-page--incoming">{children}</div>
    </div>
  );
}
