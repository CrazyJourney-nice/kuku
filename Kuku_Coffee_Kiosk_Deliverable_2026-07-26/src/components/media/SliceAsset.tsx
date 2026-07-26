"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export type SliceCrop = {
  src: string;
  sourceWidth: number;
  sourceHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function SliceAsset({
  crop,
  className = "",
  alt = "",
  fallback,
  fallbackKind = "generic",
}: {
  crop: SliceCrop;
  className?: string;
  alt?: string;
  fallback?: ReactNode;
  fallbackKind?: "generic" | "mascot" | "drink" | "impact";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === crop.src;
  const style = {
    "--slice-ratio": `${crop.width} / ${crop.height}`,
    "--slice-image-width": `${(crop.sourceWidth / crop.width) * 100}%`,
    "--slice-left": `${(-crop.x / crop.width) * 100}%`,
    "--slice-top": `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;

  const useFallback = () => {
    setFailedSrc(crop.src);
    window.dispatchEvent(
      new CustomEvent("kuku:asset-fallback", {
        detail: { src: crop.src, kind: fallbackKind },
      }),
    );
  };

  return (
    <span
      className={`slice-asset ${failed ? "slice-asset--fallback" : ""} ${className}`}
      style={style}
      {...(failed && alt ? { role: "img", "aria-label": alt } : {})}
    >
      {/* The source remains the exact user-provided slice; CSS only clips it. */}
      {failed ? (
        fallback ?? (
          <span
            className={`slice-fallback slice-fallback--${fallbackKind}`}
            aria-hidden="true"
          >
            {fallbackKind === "mascot" ? (
              <span className="slice-fallback__mascot">K</span>
            ) : fallbackKind === "drink" ? (
              <span className="slice-fallback__cup" />
            ) : fallbackKind === "impact" ? (
              <span className="slice-fallback__heart">♡</span>
            ) : (
              <span className="slice-fallback__mark">KUKU</span>
            )}
          </span>
        )
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- exact slice pixels are required */}
          <img
            src={crop.src}
            alt={alt}
            decoding="async"
            loading="eager"
            draggable={false}
            width={crop.sourceWidth}
            height={crop.sourceHeight}
            onError={useFallback}
          />
        </>
      )}
    </span>
  );
}
