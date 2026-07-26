"use client";

import { useEffect } from "react";

const immediateAssets = [
  "/assets/reference/k1.png",
  "/assets/reference/k2-impact.png",
  "/assets/reference/k2.png",
] as const;

const deferredAssets = [
  "/assets/reference/k3.png",
  "/assets/reference/k4.png",
  "/assets/reference/k5.png",
  "/assets/reference/k6.png",
  "/assets/reference/k7.png",
] as const;

const decodedAssets = new Map<string, Promise<void>>();
const retainedImages: HTMLImageElement[] = [];

function decodeAsset(src: string, priority: "high" | "low"): Promise<void> {
  const cached = decodedAssets.get(src);
  if (cached) return cached;

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = priority;
  image.src = src;
  retainedImages.push(image);

  const decoded = image.decode().catch(() => {
    // SliceAsset owns the visible fallback and telemetry for genuine failures.
  });
  decodedAssets.set(src, decoded);
  return decoded;
}

/**
 * Decodes the impact home and welcome pixels immediately, then warms the
 * remaining exact user-provided slices while the kiosk is idle.
 */
export function useKioskAssetPreload(): void {
  useEffect(() => {
    void Promise.all(immediateAssets.map((src) => decodeAsset(src, "high")));

    const preloadDeferred = () => {
      void Promise.all(deferredAssets.map((src) => decodeAsset(src, "low")));
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadDeferred, {
        timeout: 1_200,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(preloadDeferred, 180);
    return () => globalThis.clearTimeout(timer);
  }, []);
}
