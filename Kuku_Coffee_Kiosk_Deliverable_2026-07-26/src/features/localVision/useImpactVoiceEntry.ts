"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const IMPACT_EYE_OPEN_MS = 3_000;
export const IMPACT_ENTRY_COUNTDOWN_SECONDS = 10;
export const IMPACT_ENTRY_CANCEL_COOLDOWN_MS = 2 * 60_000;

export type ImpactVoiceEntryPhase =
  | "closed"
  | "opening"
  | "countdown"
  | "cooldown";

export function useImpactVoiceEntry({
  active,
  greetingEventId,
  onComplete,
}: {
  active: boolean;
  greetingEventId: string | null;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<ImpactVoiceEntryPhase>("closed");
  const [remainingSeconds, setRemainingSeconds] = useState(
    IMPACT_ENTRY_COUNTDOWN_SECONDS,
  );
  const [hasOpened, setHasOpened] = useState(false);
  const seenGreeting = useRef<string | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setPhase("closed");
      setRemainingSeconds(IMPACT_ENTRY_COUNTDOWN_SECONDS);
      return;
    }
    if (
      greetingEventId &&
      greetingEventId !== seenGreeting.current &&
      phase === "closed"
    ) {
      seenGreeting.current = greetingEventId;
      setRemainingSeconds(IMPACT_ENTRY_COUNTDOWN_SECONDS);
      setPhase(hasOpened ? "countdown" : "opening");
    }
  }, [active, greetingEventId, hasOpened, phase]);

  useEffect(() => {
    if (!active || phase !== "opening") return;
    const timer = window.setTimeout(() => {
      setHasOpened(true);
      setRemainingSeconds(IMPACT_ENTRY_COUNTDOWN_SECONDS);
      setPhase("countdown");
    }, IMPACT_EYE_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [active, phase]);

  useEffect(() => {
    if (!active || phase !== "countdown") return;
    const deadline = Date.now() + IMPACT_ENTRY_COUNTDOWN_SECONDS * 1_000;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        completeRef.current();
      }
    };
    const interval = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(interval);
  }, [active, phase]);

  useEffect(() => {
    if (!active || phase !== "cooldown") return;
    const timer = window.setTimeout(() => {
      setRemainingSeconds(IMPACT_ENTRY_COUNTDOWN_SECONDS);
      setPhase("countdown");
    }, IMPACT_ENTRY_CANCEL_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [active, phase]);

  const cancel = useCallback(() => {
    setHasOpened(true);
    setRemainingSeconds(IMPACT_ENTRY_COUNTDOWN_SECONDS);
    setPhase("cooldown");
  }, []);

  return {
    cancel,
    eyesOpening: phase === "opening",
    eyesVisible: hasOpened || phase === "opening",
    hasOpened,
    phase,
    remainingSeconds,
    showCountdown: phase === "countdown",
  } as const;
}
