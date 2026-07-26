"use client";

import type { AnimationEvent, ReactNode } from "react";

type ScreenTransitionDeckProps = {
  screenKey: string;
  children: ReactNode;
  onTransitionComplete: () => void;
};

/**
 * Keeps only the current screen mounted.
 *
 * Retaining the complete outgoing screen doubled layout, paint and image work
 * during every navigation. The page itself now performs a compositor-only
 * entrance, while the stable deck background provides visual continuity.
 */
export function ScreenTransitionDeck({
  screenKey,
  children,
  onTransitionComplete,
}: ScreenTransitionDeckProps) {
  const finishScreenAnimation = (event: AnimationEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.classList.contains("screen") &&
      (event.animationName.startsWith("screen-") ||
        event.animationName === "reduced-fade")
    ) {
      onTransitionComplete();
    }
  };

  return (
    <div className="screen-deck" data-current-screen={screenKey}>
      <div
        className="screen-page screen-page--incoming"
        key={screenKey}
        onAnimationEnd={finishScreenAnimation}
      >
        {children}
      </div>
    </div>
  );
}
