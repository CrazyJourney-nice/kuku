import type {
  MascotLookTarget,
  MascotRenderer,
} from "./MascotRenderer";
import type { MascotCue } from "./KukuStage";

export class StaticMascotRenderer implements MascotRenderer {
  private loaded = false;
  private cue: MascotCue = "idle";
  private lookTarget: MascotLookTarget = null;
  private energy = 0.5;

  async load(): Promise<void> {
    this.loaded = true;
  }

  setCue(cue: MascotCue): void {
    this.cue = cue;
  }

  setLookTarget(target: MascotLookTarget): void {
    this.lookTarget = target;
  }

  setEnergy(value: number): void {
    this.energy = Math.max(0, Math.min(1, value));
  }

  dispose(): void {
    this.loaded = false;
    this.lookTarget = null;
  }

  getSnapshot() {
    return {
      loaded: this.loaded,
      cue: this.cue,
      lookTarget: this.lookTarget,
      energy: this.energy,
    } as const;
  }
}
