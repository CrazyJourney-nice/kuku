import type { KioskScreen } from "./kioskState";

export type IdlePolicy = {
  warningAfterMs: number | null;
  timeoutAfterMs: number | null;
};

export type IdlePolicies = Readonly<Record<KioskScreen, IdlePolicy>>;

export const defaultIdlePolicies: IdlePolicies = Object.freeze({
  welcome: { warningAfterMs: null, timeoutAfterMs: 30_000 },
  impact: { warningAfterMs: null, timeoutAfterMs: null },
  drink: { warningAfterMs: 45_000, timeoutAfterMs: 60_000 },
  customize: { warningAfterMs: 45_000, timeoutAfterMs: 60_000 },
  confirm: { warningAfterMs: 45_000, timeoutAfterMs: 60_000 },
  submitting: { warningAfterMs: null, timeoutAfterMs: null },
  brewing: { warningAfterMs: null, timeoutAfterMs: null },
  pickup: { warningAfterMs: 25_000, timeoutAfterMs: 30_000 },
  recovering: { warningAfterMs: null, timeoutAfterMs: null },
  out_of_service: { warningAfterMs: null, timeoutAfterMs: null },
});

export type IdleDecision =
  | { state: "inactive"; remainingMs: null }
  | { state: "active"; remainingMs: number }
  | { state: "warning"; remainingMs: number }
  | { state: "timeout"; remainingMs: 0 };

/**
 * Uses absolute timestamps so background timer throttling cannot extend a
 * session. A UI clock only needs to call this again after becoming visible.
 */
export function getIdleDecision(
  screen: KioskScreen,
  lastInteractionAt: number,
  now: number,
  policies: IdlePolicies = defaultIdlePolicies,
): IdleDecision {
  const policy = policies[screen];
  if (policy.timeoutAfterMs === null) {
    return { state: "inactive", remainingMs: null };
  }
  const elapsed = Math.max(0, now - lastInteractionAt);
  const remainingMs = Math.max(0, policy.timeoutAfterMs - elapsed);
  if (remainingMs === 0) return { state: "timeout", remainingMs: 0 };
  if (
    policy.warningAfterMs !== null &&
    elapsed >= policy.warningAfterMs
  ) {
    return { state: "warning", remainingMs };
  }
  return { state: "active", remainingMs };
}
