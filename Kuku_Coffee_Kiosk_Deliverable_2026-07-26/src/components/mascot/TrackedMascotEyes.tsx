"use client";

import { useEffect, useRef } from "react";
import type { MascotLookTarget } from "./MascotRenderer";
import type { MascotCue } from "./KukuStage";

type EyeLayout = {
  left: { x: number; y: number };
  right: { x: number; y: number };
  width: number;
  height: number;
};

export const EYE_FOLLOW_RESPONSE = 1.134;
export const EYE_HORIZONTAL_RANGE = 24;
export const EYE_VERTICAL_RANGE = 20;

const orderFlowEyeLayout: EyeLayout = {
  left: { x: 27.5, y: 63.6 },
  right: { x: 51, y: 63.6 },
  width: 16.5,
  height: 22,
};

const eyeLayouts: Partial<Record<MascotCue, EyeLayout>> = {
  idle: {
    left: { x: 34.4, y: 53.1 },
    right: { x: 58.5, y: 53.1 },
    width: 15.8,
    height: 20.5,
  },
  welcome: {
    left: { x: 34.4, y: 53.1 },
    right: { x: 58.5, y: 53.1 },
    width: 15.8,
    height: 20.5,
  },
  grateful: {
    left: { x: 26.2, y: 46 },
    right: { x: 53.6, y: 46 },
    width: 16.5,
    height: 20,
  },
  "point-options": orderFlowEyeLayout,
  approve: orderFlowEyeLayout,
  recap: {
    left: { x: 27.3, y: 61.9 },
    right: { x: 53.5, y: 61.9 },
    width: 16.3,
    height: 24.6,
  },
  wait: {
    left: { x: 32.5, y: 56.3 },
    right: { x: 56.1, y: 56.3 },
    width: 14,
    height: 18,
  },
  grind: {
    left: { x: 32.5, y: 56.3 },
    right: { x: 56.1, y: 56.3 },
    width: 14,
    height: 18,
  },
  extract: {
    left: { x: 32.5, y: 56.3 },
    right: { x: 56.1, y: 56.3 },
    width: 14,
    height: 18,
  },
  dispense: {
    left: { x: 32.5, y: 56.3 },
    right: { x: 56.1, y: 56.3 },
    width: 14,
    height: 18,
  },
  concern: {
    left: { x: 32.5, y: 56.3 },
    right: { x: 56.1, y: 56.3 },
    width: 14,
    height: 18,
  },
  celebrate: {
    left: { x: 30.1, y: 47.4 },
    right: { x: 58, y: 47.4 },
    width: 15.5,
    height: 19,
  },
  goodbye: {
    left: { x: 30.1, y: 47.4 },
    right: { x: 58, y: 47.4 },
    width: 15.5,
    height: 19,
  },
  "tap-delight": {
    left: { x: 26.2, y: 46 },
    right: { x: 53.6, y: 46 },
    width: 16.5,
    height: 20,
  },
};

export function TrackedMascotEyes({
  active = true,
  artworkCoverEnabled = true,
  commandId,
  cue,
  lookTarget,
  movementEnabled = true,
  opening = false,
  onSettled,
  testId = "mascot-tracked-eyes",
}: {
  active?: boolean;
  artworkCoverEnabled?: boolean;
  commandId?: string | null;
  cue: MascotCue;
  lookTarget?: MascotLookTarget;
  movementEnabled?: boolean;
  opening?: boolean;
  onSettled?: (commandId: string) => void;
  testId?: string | null;
}) {
  const layerRef = useRef<HTMLSpanElement | null>(null);
  const current = useRef({ x: 0, y: 0 });
  const reported = useRef<string | null>(null);
  const layout = eyeLayouts[cue];
  const targetX = lookTarget?.x ?? 0;
  const targetY = lookTarget?.y ?? 0;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !layout) return;
    const requestFrame =
      window.requestAnimationFrame?.bind(window) ??
      ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 16));
    const cancelFrame =
      window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout.bind(window);
    let animationFrame = 0;
    let stableFrames = 0;

    if (!active) {
      current.current.x = movementEnabled ? targetX : 0;
      current.current.y = movementEnabled ? targetY : 0;
      layer.style.setProperty(
        "--pupil-x",
        `${current.current.x * EYE_HORIZONTAL_RANGE}%`,
      );
      layer.style.setProperty(
        "--pupil-y",
        `${current.current.y * EYE_VERTICAL_RANGE}%`,
      );
      return;
    }

    const draw = () => {
      if (movementEnabled) {
        current.current.x +=
          (targetX - current.current.x) * EYE_FOLLOW_RESPONSE;
        current.current.y +=
          (targetY - current.current.y) * EYE_FOLLOW_RESPONSE;
      } else {
        current.current.x = 0;
        current.current.y = 0;
      }
      const distance = Math.hypot(
        current.current.x - targetX,
        current.current.y - targetY,
      );
      stableFrames = distance < 0.012 ? stableFrames + 1 : 0;
      layer.style.setProperty(
        "--pupil-x",
        `${current.current.x * EYE_HORIZONTAL_RANGE}%`,
      );
      layer.style.setProperty(
        "--pupil-y",
        `${current.current.y * EYE_VERTICAL_RANGE}%`,
      );
      if (stableFrames > 10 && commandId && commandId !== reported.current) {
        reported.current = commandId;
        onSettled?.(commandId);
      }
      animationFrame = requestFrame(draw);
    };

    draw();
    return () => cancelFrame(animationFrame);
  }, [
    active,
    commandId,
    layout,
    movementEnabled,
    onSettled,
    targetX,
    targetY,
  ]);

  if (!layout) return null;
  return (
    <span
      ref={layerRef}
      className={[
        "kuku-tracked-eyes",
        opening ? "is-opening" : "",
        artworkCoverEnabled ? "has-artwork-cover" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-artwork-cover={artworkCoverEnabled ? "true" : "false"}
      {...(testId ? { "data-testid": testId } : {})}
      data-active={active ? "true" : "false"}
      data-look-active={lookTarget ? "true" : "false"}
      data-movement-enabled={movementEnabled ? "true" : "false"}
      data-opening={opening ? "true" : "false"}
      data-cue={cue}
      aria-hidden="true"
    >
      {(["left", "right"] as const).map((side) => (
        <span
          key={side}
          className={`kuku-tracked-eye-slot kuku-tracked-eye-slot--${side}`}
          style={{
            left: `${layout[side].x}%`,
            top: `${layout[side].y}%`,
            width: `${layout.width}%`,
            height: `${layout.height}%`,
          }}
        >
          <i className="kuku-tracked-eye__concealer" data-eye-concealer="true" />
          <span className={`kuku-tracked-eye kuku-tracked-eye--${side}`}>
            <i className="kuku-tracked-eye__pupil" />
          </span>
        </span>
      ))}
    </span>
  );
}
