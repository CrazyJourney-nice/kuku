"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SliceAsset,
  type SliceCrop,
} from "@/src/components/media/SliceAsset";
import type { MascotLookTarget } from "./MascotRenderer";
import { StaticMascotRenderer } from "./StaticMascotRenderer";

export type MascotCue =
  | "idle"
  | "welcome"
  | "grateful"
  | "point-options"
  | "approve"
  | "recap"
  | "wait"
  | "grind"
  | "extract"
  | "dispense"
  | "celebrate"
  | "goodbye"
  | "concern"
  | "tap-delight";

type KukuStageProps = {
  cue: MascotCue;
  size?: "compact" | "medium" | "hero";
  speech?: string;
  onTap?: () => void;
  lookTarget?: MascotLookTarget;
  lookCommandId?: string | null;
  onEyesSettled?: (commandId: string) => void;
};

type EyeLayout = {
  left: { x: number; y: number };
  right: { x: number; y: number };
  width: number;
  height: number;
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
  "point-options": {
    left: { x: 29.2, y: 60.7 },
    right: { x: 52.4, y: 60.7 },
    width: 16.8,
    height: 21,
  },
  approve: {
    left: { x: 27.5, y: 63.6 },
    right: { x: 51, y: 63.6 },
    width: 16.5,
    height: 22,
  },
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
};

function TrackedMascotEyes({
  commandId,
  cue,
  lookTarget,
  onSettled,
}: {
  commandId?: string | null;
  cue: MascotCue;
  lookTarget?: MascotLookTarget;
  onSettled?: (commandId: string) => void;
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

    const draw = () => {
      current.current.x += (targetX - current.current.x) * 0.14;
      current.current.y += (targetY - current.current.y) * 0.14;
      const distance = Math.hypot(
        current.current.x - targetX,
        current.current.y - targetY,
      );
      stableFrames = distance < 0.012 ? stableFrames + 1 : 0;
      layer.style.setProperty("--pupil-x", `${current.current.x * 13}%`);
      layer.style.setProperty("--pupil-y", `${current.current.y * 12}%`);
      if (
        stableFrames > 10 &&
        commandId &&
        commandId !== reported.current
      ) {
        reported.current = commandId;
        onSettled?.(commandId);
      }
      animationFrame = requestFrame(draw);
    };

    draw();
    return () => cancelFrame(animationFrame);
  }, [commandId, layout, onSettled, targetX, targetY]);

  if (!layout) return null;
  return (
    <span
      ref={layerRef}
      className="kuku-tracked-eyes"
      data-testid="mascot-tracked-eyes"
      data-look-active={lookTarget ? "true" : "false"}
      aria-hidden="true"
    >
      {(["left", "right"] as const).map((side) => (
        <span
          key={side}
          className={`kuku-tracked-eye kuku-tracked-eye--${side}`}
          style={{
            left: `${layout[side].x}%`,
            top: `${layout[side].y}%`,
            width: `${layout.width}%`,
            height: `${layout.height}%`,
          }}
        >
          <i className="kuku-tracked-eye__pupil" />
        </span>
      ))}
    </span>
  );
}

const mascotCrops: Record<MascotCue, SliceCrop> = {
  idle: {
    src: "/assets/reference/k1.png",
    sourceWidth: 979,
    sourceHeight: 1606,
    x: 282,
    y: 500,
    width: 424,
    height: 458,
  },
  welcome: {
    src: "/assets/reference/k1.png",
    sourceWidth: 979,
    sourceHeight: 1606,
    x: 282,
    y: 500,
    width: 424,
    height: 458,
  },
  grateful: {
    src: "/assets/reference/k2.png",
    sourceWidth: 979,
    sourceHeight: 1606,
    x: 302,
    y: 612,
    width: 420,
    height: 424,
  },
  "point-options": {
    src: "/assets/reference/k3.png",
    sourceWidth: 1150,
    sourceHeight: 1368,
    x: 84,
    y: 148,
    width: 250,
    height: 238,
  },
  approve: {
    src: "/assets/reference/k4.png",
    sourceWidth: 1148,
    sourceHeight: 1371,
    x: 92,
    y: 150,
    width: 255,
    height: 236,
  },
  recap: {
    src: "/assets/reference/k5.png",
    sourceWidth: 1149,
    sourceHeight: 1369,
    x: 96,
    y: 160,
    width: 282,
    height: 252,
  },
  wait: {
    src: "/assets/reference/k6.png",
    sourceWidth: 975,
    sourceHeight: 1612,
    x: 320,
    y: 445,
    width: 335,
    height: 336,
  },
  grind: {
    src: "/assets/reference/k6.png",
    sourceWidth: 975,
    sourceHeight: 1612,
    x: 320,
    y: 445,
    width: 335,
    height: 336,
  },
  extract: {
    src: "/assets/reference/k6.png",
    sourceWidth: 975,
    sourceHeight: 1612,
    x: 320,
    y: 445,
    width: 335,
    height: 336,
  },
  dispense: {
    src: "/assets/reference/k6.png",
    sourceWidth: 975,
    sourceHeight: 1612,
    x: 320,
    y: 445,
    width: 335,
    height: 336,
  },
  celebrate: {
    src: "/assets/reference/k7.png",
    sourceWidth: 966,
    sourceHeight: 1628,
    x: 316,
    y: 438,
    width: 345,
    height: 342,
  },
  goodbye: {
    src: "/assets/reference/k7.png",
    sourceWidth: 966,
    sourceHeight: 1628,
    x: 316,
    y: 438,
    width: 345,
    height: 342,
  },
  concern: {
    src: "/assets/reference/k6.png",
    sourceWidth: 975,
    sourceHeight: 1612,
    x: 320,
    y: 445,
    width: 335,
    height: 336,
  },
  "tap-delight": {
    src: "/assets/reference/k2.png",
    sourceWidth: 979,
    sourceHeight: 1606,
    x: 302,
    y: 612,
    width: 420,
    height: 424,
  },
};

export function KukuStage({
  cue,
  size = "medium",
  speech,
  onTap,
  lookTarget = null,
  lookCommandId = null,
  onEyesSettled,
}: KukuStageProps) {
  const [temporaryCue, setTemporaryCue] = useState<MascotCue | null>(null);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renderer] = useState(() => new StaticMascotRenderer());

  useEffect(() => {
    void renderer.load().catch(() => {
      window.dispatchEvent(new CustomEvent("kuku:mascot-renderer-fallback"));
    });
    return () => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
      renderer.dispose();
    };
  }, [renderer]);

  useEffect(() => {
    renderer.setCue(temporaryCue ?? cue);
  }, [cue, renderer, temporaryCue]);

  useEffect(() => {
    renderer.setLookTarget(lookTarget);
  }, [lookTarget, renderer]);

  const delight = () => {
    if (cue === "concern") return;
    setTemporaryCue("tap-delight");
    onTap?.();
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    restoreTimer.current = setTimeout(() => setTemporaryCue(null), 720);
  };

  const stage = (
    <div
      className={`kuku-stage kuku-stage--${size}`}
      data-cue={temporaryCue ?? cue}
    >
      <button
        type="button"
        className="kuku"
        aria-label="和 Kuku 打个招呼"
        onClick={delight}
      >
        <SliceAsset
          crop={mascotCrops[temporaryCue ?? cue]}
          alt="Kuku 咖啡助手"
          fallbackKind="mascot"
        />
        <TrackedMascotEyes
          cue={temporaryCue ?? cue}
          lookTarget={lookTarget}
          commandId={lookCommandId}
          onSettled={onEyesSettled}
        />
      </button>
      {speech ? (
        <p className="kuku-speech" aria-live="polite">
          {speech}
        </p>
      ) : null}
    </div>
  );
  return stage;
}

export function PersistentKukuStage({
  targetId,
  ...stageProps
}: KukuStageProps & { targetId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const target = document.getElementById(targetId);
    const app = host?.closest(".kiosk-app");
    if (!host || !target || !(app instanceof HTMLElement)) {
      if (host) host.style.visibility = "hidden";
      return;
    }

    const align = () => {
      const targetRect = target.getBoundingClientRect();
      const appRect = app.getBoundingClientRect();
      host.style.left = `${targetRect.left - appRect.left}px`;
      host.style.top = `${targetRect.top - appRect.top}px`;
      host.style.width = `${targetRect.width}px`;
      host.style.height = `${targetRect.height}px`;
      host.style.visibility = "visible";
    };

    align();
    const observer = new ResizeObserver(align);
    observer.observe(target);
    observer.observe(app);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [targetId]);

  return (
    <div
      ref={hostRef}
      className="persistent-kuku-host"
      data-persistent-renderer="true"
    >
      <KukuStage {...stageProps} />
    </div>
  );
}
