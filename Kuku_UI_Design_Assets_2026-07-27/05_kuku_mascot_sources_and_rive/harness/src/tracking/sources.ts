import { clamp } from "./math";
import type { NormalizedTrackingSample, TrackingSource } from "./types";

export interface ManualTrackingState {
  targetPresent: boolean;
  targetX: number;
  targetY: number;
  confidence: number;
  jitter: number;
}

export class ManualTrackingSource implements TrackingSource {
  readonly state: ManualTrackingState;
  #onSample: ((sample: NormalizedTrackingSample) => void) | null = null;

  constructor(initial: Partial<ManualTrackingState> = {}) {
    this.state = {
      targetPresent: initial.targetPresent ?? false,
      targetX: initial.targetX ?? 0,
      targetY: initial.targetY ?? 0,
      confidence: initial.confidence ?? 0.92,
      jitter: initial.jitter ?? 0,
    };
  }

  start(onSample: (sample: NormalizedTrackingSample) => void): void {
    this.#onSample = onSample;
  }

  stop(): void {
    this.#onSample = null;
  }

  emit(timestampMs: number): void {
    if (!this.#onSample) {
      return;
    }
    const noiseX = (Math.random() * 2 - 1) * this.state.jitter;
    const noiseY = (Math.random() * 2 - 1) * this.state.jitter;
    this.#onSample({
      targetPresent: this.state.targetPresent,
      targetX: clamp(this.state.targetX + noiseX, -1, 1),
      targetY: clamp(this.state.targetY + noiseY, -1, 1),
      confidence: clamp(this.state.confidence, 0, 1),
      timestampMs,
    });
  }
}

export class WebSocketTrackingSource implements TrackingSource {
  readonly #url: string;
  #socket: WebSocket | null = null;

  constructor(url: string) {
    this.#url = url;
  }

  start(onSample: (sample: NormalizedTrackingSample) => void): void {
    this.stop();
    this.#socket = new WebSocket(this.#url);
    this.#socket.addEventListener("message", (event) => {
      try {
        const candidate = JSON.parse(String(event.data)) as NormalizedTrackingSample;
        onSample(candidate);
      } catch {
        // Malformed transport messages are intentionally ignored here. The
        // machine integration should report transport health separately.
      }
    });
  }

  stop(): void {
    this.#socket?.close();
    this.#socket = null;
  }
}

export type ScriptName = "slow-walk" | "fast-crossing" | "edge-entry";

interface ActiveScript {
  name: ScriptName;
  startedMs: number;
}

export class ScriptedMotion {
  #active: ActiveScript | null = null;

  start(name: ScriptName, timestampMs: number): void {
    this.#active = { name, startedMs: timestampMs };
  }

  stop(): void {
    this.#active = null;
  }

  apply(state: ManualTrackingState, timestampMs: number): boolean {
    if (!this.#active) {
      return false;
    }
    const elapsed = timestampMs - this.#active.startedMs;
    const duration =
      this.#active.name === "slow-walk"
        ? 8_000
        : this.#active.name === "fast-crossing"
          ? 2_500
          : 4_000;
    const progress = clamp(elapsed / duration, 0, 1);

    state.targetPresent = progress < 1;
    state.targetY = 0;
    if (this.#active.name === "slow-walk") {
      state.targetX = -1 + progress * 2;
    } else if (this.#active.name === "fast-crossing") {
      state.targetX = -1 + progress * 2;
    } else {
      state.targetX = -1 + progress;
    }

    if (progress >= 1) {
      this.stop();
      return false;
    }
    return true;
  }
}
