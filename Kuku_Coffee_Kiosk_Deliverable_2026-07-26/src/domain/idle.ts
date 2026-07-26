import type { KioskScreen } from "./kioskState";

export type IdlePolicy = {
  warningAfterMs: number | null;
  timeoutAfterMs: number | null;
};

export type IdlePolicies = Readonly<Record<KioskScreen, IdlePolicy>>;

export const IDLE_PROMPT_AFTER_MS = 90_000;
export const IDLE_RETURN_COUNTDOWN_SECONDS = 10;
export const IDLE_RETURN_AFTER_MS =
  IDLE_PROMPT_AFTER_MS + IDLE_RETURN_COUNTDOWN_SECONDS * 1_000;
export const MASCOT_SLEEP_AFTER_RETURN_MS = 5_000;
export const LOCAL_IDLE_TEST_PROMPT_AFTER_MS = 2_000;
export const LOCAL_IDLE_TEST_RETURN_AFTER_MS = 5_000;

const returnHomePolicy: IdlePolicy = Object.freeze({
  warningAfterMs: IDLE_PROMPT_AFTER_MS,
  timeoutAfterMs: IDLE_RETURN_AFTER_MS,
});

function createPolicies(returnPolicy: IdlePolicy): IdlePolicies {
  return Object.freeze({
    welcome: returnPolicy,
    impact: returnPolicy,
    drink: returnPolicy,
    customize: returnPolicy,
    confirm: returnPolicy,
    submitting: { warningAfterMs: null, timeoutAfterMs: null },
    brewing: { warningAfterMs: null, timeoutAfterMs: null },
    pickup: returnPolicy,
    recovering: { warningAfterMs: null, timeoutAfterMs: null },
    out_of_service: { warningAfterMs: null, timeoutAfterMs: null },
  });
}

export const defaultIdlePolicies: IdlePolicies = createPolicies(returnHomePolicy);

export const localIdleTestPolicies: IdlePolicies = Object.freeze({
  ...createPolicies(
    Object.freeze({
      warningAfterMs: LOCAL_IDLE_TEST_PROMPT_AFTER_MS,
      timeoutAfterMs: LOCAL_IDLE_TEST_RETURN_AFTER_MS,
    }),
  ),
  // Keep the returned home screen stable long enough to verify the real
  // five-second sleep transition during accelerated local QA.
  impact: {
    warningAfterMs: null,
    timeoutAfterMs: null,
  },
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
