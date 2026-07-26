"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SliceAsset,
  type SliceCrop,
} from "@/src/components/media/SliceAsset";
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
  onTap,
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
