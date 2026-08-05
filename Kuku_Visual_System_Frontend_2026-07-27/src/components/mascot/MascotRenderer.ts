import type { MascotCue } from "./KukuStage";

export type MascotLookTarget = { x: number; y: number } | null;

/**
 * Runtime-neutral mascot contract. A future Rive renderer can replace the
 * static renderer without changing the kiosk state machine or page flow.
 */
export interface MascotRenderer {
  load(): Promise<void>;
  setCue(cue: MascotCue): void;
  setLookTarget(target: MascotLookTarget): void;
  setEnergy(value: number): void;
  dispose(): void;
}
