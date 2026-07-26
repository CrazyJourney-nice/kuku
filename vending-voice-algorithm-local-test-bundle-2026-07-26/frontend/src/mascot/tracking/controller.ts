import {
  applyDeadZone,
  clamp,
  clampUnit,
  damp,
  finiteOr,
  smoothstep,
} from "./math";
import { OneEuroFilter } from "./oneEuroFilter";
import {
  DEFAULT_TRACKING_CONFIG,
  type NormalizedTrackingSample,
  type TrackingControllerConfig,
  type TrackingMode,
  type TrackingOutput,
} from "./types";

export class TrackingController {
  readonly config: TrackingControllerConfig;
  readonly #filterX = new OneEuroFilter();
  readonly #filterY = new OneEuroFilter();
  readonly #random: () => number;
  #mode: TrackingMode = "IDLE";
  #modeStartedMs = 0;
  #lastTickMs: number | null = null;
  #lastSampleMs: number | null = null;
  #lastValidSampleMs: number | null = null;
  #hasDeclaredLoss = false;
  #filteredX = 0;
  #filteredY = 0;
  #confidence = 0;
  #bodyYaw = 0;
  #bodyPitch = 0;
  #eyeX = 0;
  #eyeY = 0;
  #blinkSequence = 0;
  #nextBlinkMs = 0;

  constructor(
    config: Partial<TrackingControllerConfig> = {},
    random: () => number = Math.random,
  ) {
    this.config = { ...DEFAULT_TRACKING_CONFIG, ...config };
    this.#random = random;
    this.#scheduleBlink(0);
  }

  ingest(sample: NormalizedTrackingSample): void {
    if (!this.#isStructurallyValid(sample)) {
      this.fault(finiteOr(sample.timestampMs, this.#lastTickMs ?? 0));
      return;
    }
    const timestampMs = Math.max(
      sample.timestampMs,
      this.#lastSampleMs ?? sample.timestampMs,
    );
    this.#lastSampleMs = timestampMs;

    if (!sample.targetPresent) {
      this.#declareLoss(timestampMs);
      return;
    }
    if (sample.confidence < this.config.confidenceThreshold) return;

    this.#hasDeclaredLoss = false;
    this.#lastValidSampleMs = timestampMs;
    this.#confidence = clamp(sample.confidence, 0, 1);
    this.#filteredX = this.#filterX.filter(clampUnit(sample.targetX), timestampMs);
    this.#filteredY = this.#filterY.filter(clampUnit(sample.targetY), timestampMs);

    if (this.#mode === "IDLE") this.#transition("ACQUIRE", timestampMs);
    else if (
      this.#mode === "ACQUIRE" &&
      timestampMs - this.#modeStartedMs >= this.config.acquireStabilityMs
    ) {
      this.#transition("TRACK", timestampMs);
    } else if (this.#mode === "HOLD" || this.#mode === "RETURN") {
      this.#transition("TRACK", timestampMs);
    }
  }

  tick(timestampMs: number): TrackingOutput {
    const safeNow = Math.max(
      finiteOr(timestampMs, this.#lastTickMs ?? 0),
      this.#lastTickMs ?? timestampMs,
    );
    const deltaMs =
      this.#lastTickMs === null ? 0 : clamp(safeNow - this.#lastTickMs, 0, 100);
    this.#lastTickMs = safeNow;

    if (
      (this.#mode === "ACQUIRE" || this.#mode === "TRACK") &&
      this.#lastValidSampleMs !== null &&
      safeNow - this.#lastValidSampleMs > this.config.staleSampleMs
    ) {
      this.#declareLoss(safeNow);
    }
    if (
      this.#mode === "ACQUIRE" &&
      this.#lastValidSampleMs !== null &&
      safeNow - this.#modeStartedMs >= this.config.acquireStabilityMs
    ) {
      this.#transition("TRACK", safeNow);
    }
    if (
      this.#mode === "HOLD" &&
      safeNow - this.#modeStartedMs >= this.config.lostTargetHoldMs
    ) {
      this.#transition("RETURN", safeNow);
    }
    if (
      this.#mode === "FAULT" &&
      safeNow - this.#modeStartedMs >= this.config.faultRecoveryMs
    ) {
      this.#transition("IDLE", safeNow);
    }

    const returning = this.#mode === "RETURN" || this.#mode === "FAULT";
    if (
      this.#mode === "RETURN" &&
      safeNow - this.#modeStartedMs >= this.config.returnCentreMs
    ) {
      this.#bodyYaw = 0;
      this.#bodyPitch = 0;
      this.#eyeX = 0;
      this.#eyeY = 0;
      this.#filteredX = 0;
      this.#filteredY = 0;
      this.#transition("IDLE", safeNow);
    }

    const goals = returning
      ? { bodyYaw: 0, bodyPitch: 0, eyeX: 0, eyeY: 0 }
      : this.#calculateGoals();
    this.#bodyYaw = damp(
      this.#bodyYaw,
      goals.bodyYaw,
      deltaMs,
      this.config.bodyResponseMs,
    );
    this.#bodyPitch = damp(
      this.#bodyPitch,
      goals.bodyPitch,
      deltaMs,
      this.config.bodyResponseMs,
    );
    this.#eyeX = damp(
      this.#eyeX,
      goals.eyeX,
      deltaMs,
      this.config.eyeResponseMs,
    );
    this.#eyeY = damp(
      this.#eyeY,
      goals.eyeY,
      deltaMs,
      this.config.eyeResponseMs,
    );

    if (this.#mode === "IDLE" && safeNow >= this.#nextBlinkMs) {
      this.#blinkSequence += 1;
      this.#scheduleBlink(safeNow);
    }
    return this.output;
  }

  fault(timestampMs: number): void {
    this.#confidence = 0;
    this.#hasDeclaredLoss = true;
    this.#transition("FAULT", finiteOr(timestampMs, this.#lastTickMs ?? 0));
  }

  reset(timestampMs = 0): void {
    this.#mode = "IDLE";
    this.#modeStartedMs = timestampMs;
    this.#lastTickMs = timestampMs;
    this.#lastSampleMs = null;
    this.#lastValidSampleMs = null;
    this.#hasDeclaredLoss = false;
    this.#filteredX = 0;
    this.#filteredY = 0;
    this.#confidence = 0;
    this.#bodyYaw = 0;
    this.#bodyPitch = 0;
    this.#eyeX = 0;
    this.#eyeY = 0;
    this.#filterX.reset();
    this.#filterY.reset();
    this.#scheduleBlink(timestampMs);
  }

  get output(): TrackingOutput {
    const targetPresent =
      this.#mode === "ACQUIRE" ||
      this.#mode === "TRACK" ||
      this.#mode === "HOLD";
    return {
      mode: this.#mode,
      bodyYaw: clampUnit(this.#bodyYaw),
      bodyPitch: clampUnit(this.#bodyPitch),
      eyeX: clampUnit(this.#eyeX),
      eyeY: clampUnit(this.#eyeY),
      targetX: clampUnit(this.#filteredX),
      targetY: clampUnit(this.#filteredY),
      confidence: this.#confidence,
      targetPresent,
      blinkSequence: this.#blinkSequence,
    };
  }

  #calculateGoals() {
    if (this.#mode === "IDLE") {
      return { bodyYaw: 0, bodyPitch: 0, eyeX: 0, eyeY: 0 };
    }
    const x = applyDeadZone(this.#filteredX, this.config.horizontalDeadZone);
    const y = applyDeadZone(this.#filteredY, this.config.verticalDeadZone);
    const desiredYaw = x * this.config.yawRangeDegrees;
    const desiredPitch = y * this.config.pitchRangeDegrees;
    const bodyYaw =
      Math.sign(desiredYaw) *
      smoothstep(
        this.config.bodyYawDeadZoneDegrees,
        this.config.yawRangeDegrees,
        Math.abs(desiredYaw),
      );
    const bodyPitch =
      Math.sign(desiredPitch) *
      smoothstep(
        this.config.bodyPitchDeadZoneDegrees,
        this.config.pitchRangeDegrees,
        Math.abs(desiredPitch),
      );
    const eyeX =
      clamp(
        desiredYaw - this.#bodyYaw * this.config.yawRangeDegrees,
        -this.config.eyeYawRangeDegrees,
        this.config.eyeYawRangeDegrees,
      ) / this.config.eyeYawRangeDegrees;
    const eyeY =
      clamp(
        desiredPitch - this.#bodyPitch * this.config.pitchRangeDegrees,
        -this.config.eyePitchRangeDegrees,
        this.config.eyePitchRangeDegrees,
      ) / this.config.eyePitchRangeDegrees;
    return { bodyYaw, bodyPitch, eyeX, eyeY };
  }

  #declareLoss(timestampMs: number): void {
    if (this.#hasDeclaredLoss) return;
    this.#hasDeclaredLoss = true;
    this.#confidence = 0;
    if (this.#mode === "TRACK") this.#transition("HOLD", timestampMs);
    else if (this.#mode === "ACQUIRE") this.#transition("RETURN", timestampMs);
  }

  #transition(mode: TrackingMode, timestampMs: number): void {
    if (this.#mode === mode) return;
    this.#mode = mode;
    this.#modeStartedMs = timestampMs;
    if (mode === "IDLE") {
      this.#confidence = 0;
      this.#scheduleBlink(timestampMs);
    }
  }

  #scheduleBlink(timestampMs: number): void {
    const range = this.config.blinkMaxMs - this.config.blinkMinMs;
    this.#nextBlinkMs =
      timestampMs +
      this.config.blinkMinMs +
      range * clamp(this.#random(), 0, 1);
  }

  #isStructurallyValid(sample: NormalizedTrackingSample): boolean {
    return (
      typeof sample.targetPresent === "boolean" &&
      Number.isFinite(sample.targetX) &&
      Number.isFinite(sample.targetY) &&
      Number.isFinite(sample.confidence) &&
      Number.isFinite(sample.timestampMs)
    );
  }
}
