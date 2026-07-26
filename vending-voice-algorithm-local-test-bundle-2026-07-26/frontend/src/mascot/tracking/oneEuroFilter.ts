import { finiteOr } from "./math";

interface LowPassFilterState {
  value: number;
  initialized: boolean;
}

const smoothingFactor = (deltaSeconds: number, cutoffHz: number): number => {
  const safeCutoff = Math.max(cutoffHz, 0.0001);
  const timeConstant = 1 / (2 * Math.PI * safeCutoff);
  return 1 / (1 + timeConstant / Math.max(deltaSeconds, 0.000001));
};

const lowPass = (
  state: LowPassFilterState,
  value: number,
  alpha: number,
): number => {
  if (!state.initialized) {
    state.value = value;
    state.initialized = true;
    return value;
  }
  state.value = alpha * value + (1 - alpha) * state.value;
  return state.value;
};

export class OneEuroFilter {
  readonly #minCutoffHz = 1.2;
  readonly #beta = 0.08;
  readonly #derivativeCutoffHz = 1;
  readonly #signal: LowPassFilterState = { value: 0, initialized: false };
  readonly #derivative: LowPassFilterState = { value: 0, initialized: false };
  #previousRaw = 0;
  #previousTimestampMs: number | null = null;

  filter(value: number, timestampMs: number): number {
    const safeValue = finiteOr(value, this.#signal.value);
    const safeTimestamp = finiteOr(timestampMs, this.#previousTimestampMs ?? 0);

    if (this.#previousTimestampMs === null) {
      this.#previousTimestampMs = safeTimestamp;
      this.#previousRaw = safeValue;
      this.#signal.initialized = true;
      this.#signal.value = safeValue;
      return safeValue;
    }

    const deltaSeconds = Math.max(
      (safeTimestamp - this.#previousTimestampMs) / 1_000,
      1 / 240,
    );
    const derivative = lowPass(
      this.#derivative,
      (safeValue - this.#previousRaw) / deltaSeconds,
      smoothingFactor(deltaSeconds, this.#derivativeCutoffHz),
    );
    const filtered = lowPass(
      this.#signal,
      safeValue,
      smoothingFactor(
        deltaSeconds,
        this.#minCutoffHz + this.#beta * Math.abs(derivative),
      ),
    );

    this.#previousRaw = safeValue;
    this.#previousTimestampMs = safeTimestamp;
    return filtered;
  }

  reset(): void {
    this.#signal.value = 0;
    this.#signal.initialized = false;
    this.#derivative.value = 0;
    this.#derivative.initialized = false;
    this.#previousRaw = 0;
    this.#previousTimestampMs = null;
  }
}
