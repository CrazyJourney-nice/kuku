"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SliceAsset,
  type SliceCrop,
} from "@/src/components/media/SliceAsset";
import type { MascotLookTarget } from "./MascotRenderer";
import { StaticMascotRenderer } from "./StaticMascotRenderer";
import { TrackedMascotEyes } from "./TrackedMascotEyes";

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

export const DRINK_SCREEN_MASCOT_CUE: MascotCue = "approve";

export type MascotInteractionKind = "selection" | "approval";

export type MascotInteractionCommand = {
  id: number;
  kind: MascotInteractionKind;
};

export const AMBIENT_INTERACTION_MIN_MS = 8_000;
export const AMBIENT_INTERACTION_MAX_MS = 14_000;

export function getAmbientInteractionDelay(
  random: () => number = Math.random,
): number {
  const ratio = Math.min(1, Math.max(0, random()));
  return Math.round(
    AMBIENT_INTERACTION_MIN_MS +
      ratio * (AMBIENT_INTERACTION_MAX_MS - AMBIENT_INTERACTION_MIN_MS),
  );
}

type KukuStageProps = {
  cue: MascotCue;
  size?: "compact" | "medium" | "hero";
  speech?: string;
  sleeping?: boolean;
  interaction?: MascotInteractionCommand | null;
  onTap?: () => void;
  lookTarget?: MascotLookTarget;
  lookCommandId?: string | null;
  onEyesSettled?: (commandId: string) => void;
  trackedEyesEnabled?: boolean;
  trackedEyesFollowEnabled?: boolean;
  trackedEyesOpening?: boolean;
  trackedEyesArtworkCover?: boolean;
};

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
  sleeping = false,
  interaction = null,
  onTap,
  lookTarget = null,
  lookCommandId = null,
  onEyesSettled,
  trackedEyesEnabled = true,
  trackedEyesFollowEnabled = true,
  trackedEyesOpening = false,
  trackedEyesArtworkCover,
}: KukuStageProps) {
  const [temporaryCue, setTemporaryCue] = useState<MascotCue | null>(null);
  const [interactionCycle, setInteractionCycle] = useState(0);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionCommandId = useRef<number | null>(null);
  const mascotButtonRef = useRef<HTMLButtonElement | null>(null);
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

  const delight = useCallback(() => {
    if (cue === "concern" || sleeping || trackedEyesOpening) return;
    setTemporaryCue("tap-delight");
    setInteractionCycle((cycle) => cycle + 1);
    onTap?.();
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    restoreTimer.current = setTimeout(() => {
      restoreTimer.current = null;
      setTemporaryCue(null);
    }, 720);
  }, [cue, onTap, sleeping, trackedEyesOpening]);

  useEffect(() => {
    if (
      !interaction ||
      interaction.id === lastInteractionCommandId.current
    ) {
      return;
    }
    lastInteractionCommandId.current = interaction.id;
    mascotButtonRef.current?.click();
  }, [interaction]);

  useEffect(() => {
    if (!sleeping && !trackedEyesOpening) return;
    if (restoreTimer.current) {
      clearTimeout(restoreTimer.current);
      restoreTimer.current = null;
    }
    setTemporaryCue(null);
  }, [sleeping, trackedEyesOpening]);

  useEffect(() => {
    if (sleeping || trackedEyesOpening) return;
    const timer = setTimeout(() => {
      mascotButtonRef.current?.click();
    }, getAmbientInteractionDelay());
    return () => clearTimeout(timer);
  }, [interactionCycle, sleeping, trackedEyesOpening]);

  const delighting = temporaryCue === "tap-delight";
  const artworkCoverEnabled =
    trackedEyesArtworkCover ?? !trackedEyesOpening;

  const stage = (
    <div
      className={`kuku-stage kuku-stage--${size}`}
      data-cue={temporaryCue ?? cue}
      data-vision-tracking={
        trackedEyesEnabled && lookTarget ? "true" : "false"
      }
      data-eye-state={
        trackedEyesEnabled
          ? trackedEyesOpening
            ? "opening"
            : "open"
          : "closed"
      }
      data-sleeping={sleeping ? "true" : "false"}
      data-interaction={
        temporaryCue === "tap-delight" ? "tap-delight" : "idle"
      }
    >
      <button
        ref={mascotButtonRef}
        type="button"
        className="kuku"
        aria-label="和 Kuku 打个招呼"
        onClick={delight}
      >
        <span className="kuku-artwork-stack">
          <span
            className="kuku-artwork-layer kuku-artwork-layer--base"
            data-active={delighting ? "false" : "true"}
            data-artwork-layer="base"
            aria-hidden={delighting ? "true" : undefined}
          >
            <SliceAsset
              key={cue}
              crop={mascotCrops[cue]}
              alt="Kuku 咖啡助手"
              decoding="sync"
              fallbackKind="mascot"
            />
            {trackedEyesEnabled ? (
              <TrackedMascotEyes
                active={!delighting}
                artworkCoverEnabled={artworkCoverEnabled}
                cue={cue}
                lookTarget={lookTarget}
                commandId={delighting ? null : lookCommandId}
                movementEnabled={trackedEyesFollowEnabled}
                opening={!delighting && trackedEyesOpening}
                onSettled={delighting ? undefined : onEyesSettled}
                testId={delighting ? null : "mascot-tracked-eyes"}
              />
            ) : null}
          </span>
          <span
            className="kuku-artwork-layer kuku-artwork-layer--delight"
            data-active={delighting ? "true" : "false"}
            data-artwork-layer="delight"
            aria-hidden={delighting ? undefined : "true"}
          >
            <SliceAsset
              crop={mascotCrops["tap-delight"]}
              alt=""
              decoding="sync"
              fallbackKind="mascot"
            />
            {trackedEyesEnabled ? (
              <TrackedMascotEyes
                active={delighting}
                artworkCoverEnabled={artworkCoverEnabled}
                cue="tap-delight"
                lookTarget={lookTarget}
                commandId={delighting ? lookCommandId : null}
                movementEnabled={trackedEyesFollowEnabled}
                opening={delighting && trackedEyesOpening}
                onSettled={delighting ? onEyesSettled : undefined}
                testId={delighting ? "mascot-tracked-eyes" : null}
              />
            ) : null}
          </span>
        </span>
        {sleeping ? (
          <span className="kuku-sleep-mark" aria-hidden="true">
            Zzz
          </span>
        ) : null}
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
  direction,
  ...stageProps
}: KukuStageProps & {
  targetId: string;
  direction: "forward" | "backward" | "replace";
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastGeometry = useRef("");
  const alignFrame = useRef<number | null>(null);

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
      const screen = target.closest(".screen");
      const transform =
        screen instanceof HTMLElement
          ? window.getComputedStyle(screen).transform
          : "none";
      const matrix =
        transform === "none"
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(transform);
      const x = targetRect.left - appRect.left - matrix.m41;
      const y = targetRect.top - appRect.top - matrix.m42;
      const geometry = [
        x.toFixed(2),
        y.toFixed(2),
        targetRect.width.toFixed(2),
        targetRect.height.toFixed(2),
      ].join(":");
      if (geometry === lastGeometry.current) return false;

      host.style.width = `${targetRect.width}px`;
      host.style.height = `${targetRect.height}px`;
      host.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      host.style.visibility = "visible";
      lastGeometry.current = geometry;
      return true;
    };

    const scheduleAlign = () => {
      if (alignFrame.current !== null) return;
      alignFrame.current = window.requestAnimationFrame(() => {
        alignFrame.current = null;
        align();
      });
    };

    const geometryChanged = align();
    if (
      geometryChanged &&
      direction !== "replace" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const offset = app.getBoundingClientRect().width * 0.1;
      const signedOffset = direction === "forward" ? offset : -offset;
      const finalTransform = host.style.transform;
      const match = finalTransform.match(
        /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/,
      );
      if (match) {
        const x = Number(match[1]);
        const y = Number(match[2]);
        host.animate(
          [
            {
              opacity: 0.01,
              transform: `translate3d(${x + signedOffset}px, ${y}px, 0)`,
            },
            { opacity: 1, transform: finalTransform },
          ],
          {
            duration: 300,
            easing: "cubic-bezier(0.2, 0.75, 0.25, 1)",
          },
        );
      }
    }

    const observer = new ResizeObserver(scheduleAlign);
    observer.observe(target);
    window.addEventListener("resize", scheduleAlign, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleAlign);
      if (alignFrame.current !== null) {
        window.cancelAnimationFrame(alignFrame.current);
        alignFrame.current = null;
      }
    };
  }, [direction, targetId]);

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
