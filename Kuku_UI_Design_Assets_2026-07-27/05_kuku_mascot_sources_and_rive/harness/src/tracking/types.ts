export type TrackingMode =
  | "IDLE"
  | "ACQUIRE"
  | "TRACK"
  | "HOLD"
  | "RETURN"
  | "FAULT";

export interface NormalizedTrackingSample {
  targetPresent: boolean;
  /** -1 viewer-left → +1 viewer-right. */
  targetX: number;
  /** -1 down → +1 up. */
  targetY: number;
  confidence: number;
  timestampMs: number;
}

export interface TrackingSource {
  start(onSample: (sample: NormalizedTrackingSample) => void): void;
  stop(): void;
}

export interface TrackingControllerConfig {
  confidenceThreshold: number;
  horizontalDeadZone: number;
  verticalDeadZone: number;
  acquireStabilityMs: number;
  lostTargetHoldMs: number;
  returnCentreMs: number;
  staleSampleMs: number;
  faultRecoveryMs: number;
  eyeResponseMs: number;
  bodyResponseMs: number;
  yawRangeDegrees: number;
  pitchRangeDegrees: number;
  bodyYawDeadZoneDegrees: number;
  bodyPitchDeadZoneDegrees: number;
  eyeYawRangeDegrees: number;
  eyePitchRangeDegrees: number;
  blinkMinMs: number;
  blinkMaxMs: number;
}

export interface TrackingOutput {
  mode: TrackingMode;
  bodyYaw: number;
  bodyPitch: number;
  eyeX: number;
  eyeY: number;
  targetX: number;
  targetY: number;
  confidence: number;
  targetPresent: boolean;
  blinkSequence: number;
}

export const DEFAULT_TRACKING_CONFIG: Readonly<TrackingControllerConfig> = {
  confidenceThreshold: 0.65,
  horizontalDeadZone: 0.08,
  verticalDeadZone: 0.1,
  acquireStabilityMs: 300,
  lostTargetHoldMs: 650,
  returnCentreMs: 700,
  staleSampleMs: 400,
  faultRecoveryMs: 150,
  eyeResponseMs: 100,
  bodyResponseMs: 350,
  yawRangeDegrees: 45,
  pitchRangeDegrees: 18,
  bodyYawDeadZoneDegrees: 8,
  bodyPitchDeadZoneDegrees: 6,
  eyeYawRangeDegrees: 12,
  eyePitchRangeDegrees: 10,
  blinkMinMs: 4_000,
  blinkMaxMs: 8_000,
};
