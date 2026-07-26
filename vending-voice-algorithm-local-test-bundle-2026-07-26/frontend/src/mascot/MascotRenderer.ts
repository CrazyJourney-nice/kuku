import {
  Alignment,
  Fit,
  Layout,
  Rive,
  RuntimeLoader,
  type ViewModelInstance,
  type ViewModelInstanceNumber,
  type ViewModelInstanceString,
  type ViewModelInstanceTrigger,
} from "@rive-app/canvas";
import riveWasmUrl from "@rive-app/canvas/rive.wasm?url";
import { FallbackMascotRenderer } from "./FallbackMascotRenderer";
import type { TrackingOutput } from "./tracking/types";

RuntimeLoader.setWasmUrl(riveWasmUrl);
RuntimeLoader.setWasmFallbackUrl(null);

const ARTBOARD = "MascotTracking_1254";
const STATE_MACHINE = "SM_MascotTracking";
const VIEW_MODEL = "VM_MascotTracking";
const DEFAULT_INSTANCE = "MascotTracking_Default";

export type RendererStatus =
  | "checking"
  | "rive"
  | "vector"
  | "missing"
  | "invalid";

interface RiveBindings {
  mode: ViewModelInstanceString;
  bodyYaw: ViewModelInstanceNumber;
  bodyPitch: ViewModelInstanceNumber;
  eyeX: ViewModelInstanceNumber;
  eyeY: ViewModelInstanceNumber;
  blink: ViewModelInstanceTrigger;
  reset: ViewModelInstanceTrigger;
  bodyScaleX: ViewModelInstanceNumber;
  faceOffsetX: ViewModelInstanceNumber;
  bodyScaleY: ViewModelInstanceNumber;
  faceOffsetY: ViewModelInstanceNumber;
  pupilLX: ViewModelInstanceNumber;
  pupilRX: ViewModelInstanceNumber;
  pupilLY: ViewModelInstanceNumber;
  pupilRY: ViewModelInstanceNumber;
  blinkScale: ViewModelInstanceNumber;
}

export class MascotRenderer {
  readonly #host: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #fallback = new FallbackMascotRenderer();
  readonly #assetPath: string;
  readonly #onStatus: (status: RendererStatus, detail: string) => void;
  readonly #resizeObserver: ResizeObserver | null;
  #rive: Rive | null = null;
  #viewModelInstance: ViewModelInstance | null = null;
  #bindings: RiveBindings | null = null;
  #lastBlinkSequence = 0;
  #blinkStartedMs: number | null = null;
  #lastOutput: TrackingOutput | null = null;
  #destroyed = false;

  constructor(
    host: HTMLElement,
    assetPath = "./mascot-tracking-pilot-v1.riv",
    onStatus: (status: RendererStatus, detail: string) => void = () => undefined,
  ) {
    this.#host = host;
    this.#assetPath = assetPath;
    this.#onStatus = onStatus;
    this.#canvas = document.createElement("canvas");
    this.#canvas.className = "mascot-canvas";
    this.#canvas.setAttribute("aria-label", "Rive mascot backing canvas");
    this.#canvas.hidden = true;
    this.#host.append(this.#canvas, this.#fallback.element);
    this.#resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            this.#rive?.resizeDrawingSurfaceToCanvas();
          });
    this.#resizeObserver?.observe(this.#canvas);
  }

  async initialize(): Promise<void> {
    this.#onStatus("checking", "Loading local Rive mascot");
    let buffer: ArrayBuffer;
    try {
      const response = await fetch(this.#assetPath, { cache: "no-store" });
      if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
        this.#onStatus("vector", "Local animated vector compatibility renderer");
        return;
      }
      buffer = await response.arrayBuffer();
    } catch {
      this.#onStatus("vector", "Local animated vector compatibility renderer");
      return;
    }
    if (this.#destroyed) return;

    await new Promise<void>((resolve) => {
      this.#rive = new Rive({
        buffer,
        canvas: this.#canvas,
        artboard: ARTBOARD,
        stateMachines: STATE_MACHINE,
        autoplay: true,
        autoBind: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        useOffscreenRenderer: true,
        shouldDisableRiveListeners: true,
        onLoad: () => {
          if (this.#destroyed) {
            this.#rive?.cleanup();
            this.#rive = null;
            resolve();
            return;
          }
          // Measure only after the square canvas is visible. Measuring the
          // hidden canvas can leave Rive's viewport clipped to the fixed feet.
          this.#canvas.hidden = false;
          this.#rive?.resizeDrawingSurfaceToCanvas();
          if (!this.#connectBindings()) {
            this.#canvas.hidden = true;
            this.#rive?.cleanup();
            this.#rive = null;
            this.#fallback.element.hidden = false;
            this.#onStatus("vector", "Local animated vector compatibility renderer");
            resolve();
            return;
          }
          // The embedded Rive viewport currently clips the deforming body
          // layer in this narrow React card. Keep the validated runtime loaded,
          // but present the transfer package's animated vector renderer.
          this.#canvas.hidden = true;
          this.#fallback.element.hidden = false;
          this.#onStatus("vector", "Rive-linked animated vector renderer");
          requestAnimationFrame(() => {
            this.#rive?.resizeDrawingSurfaceToCanvas();
          });
          if (this.#lastOutput) this.update(this.#lastOutput);
          resolve();
        },
        onLoadError: () => {
          this.#rive?.cleanup();
          this.#rive = null;
          this.#fallback.element.hidden = false;
          this.#onStatus("vector", "Local animated vector compatibility renderer");
          resolve();
        },
      });
    });
  }

  update(output: TrackingOutput): void {
    this.#lastOutput = output;
    this.#fallback.update(output);
    if (!this.#bindings) return;

    this.#bindings.mode.value = output.mode;
    this.#bindings.bodyYaw.value = output.bodyYaw;
    this.#bindings.bodyPitch.value = output.bodyPitch;
    this.#bindings.eyeX.value = output.eyeX;
    this.#bindings.eyeY.value = output.eyeY;
    this.#bindings.bodyScaleX.value = 1 - 0.14 * Math.abs(output.bodyYaw);
    this.#bindings.faceOffsetX.value = 32 * output.bodyYaw;
    this.#bindings.bodyScaleY.value = 1 + 0.04 * output.bodyPitch;
    this.#bindings.faceOffsetY.value = -18 * output.bodyPitch;
    this.#bindings.pupilLX.value = 21.95 + 18 * output.eyeX;
    this.#bindings.pupilRX.value = -20.45 + 18 * output.eyeX;
    this.#bindings.pupilLY.value = 6.15 - 12 * output.eyeY;
    this.#bindings.pupilRY.value = 6.25 - 12 * output.eyeY;

    if (output.blinkSequence !== this.#lastBlinkSequence) {
      this.#lastBlinkSequence = output.blinkSequence;
      this.#blinkStartedMs = performance.now();
      this.#bindings.blink.trigger();
    }
    this.#bindings.blinkScale.value = this.#currentBlinkScale(performance.now());
  }

  reset(): void {
    this.#bindings?.reset.trigger();
  }

  resize(): void {
    this.#rive?.resizeDrawingSurfaceToCanvas();
  }

  destroy(): void {
    this.#destroyed = true;
    this.#resizeObserver?.disconnect();
    this.#bindings = null;
    this.#viewModelInstance?.cleanup();
    this.#viewModelInstance = null;
    this.#rive?.cleanup();
    this.#rive = null;
    this.#canvas.remove();
  }

  #connectBindings(): boolean {
    if (!this.#rive) return false;
    const viewModel = this.#rive.viewModelByName(VIEW_MODEL);
    const instance =
      viewModel?.instanceByName(DEFAULT_INSTANCE) ??
      viewModel?.defaultInstance() ??
      this.#rive.viewModelInstance;
    if (!instance) return false;

    const bindings = {
      mode: instance.string("mode"),
      bodyYaw: instance.number("bodyYaw"),
      bodyPitch: instance.number("bodyPitch"),
      eyeX: instance.number("eyeX"),
      eyeY: instance.number("eyeY"),
      blink: instance.trigger("blink"),
      reset: instance.trigger("reset"),
      bodyScaleX: instance.number("_bodyScaleX"),
      faceOffsetX: instance.number("_faceOffsetX"),
      bodyScaleY: instance.number("_bodyScaleY"),
      faceOffsetY: instance.number("_faceOffsetY"),
      pupilLX: instance.number("_pupilLX"),
      pupilRX: instance.number("_pupilRX"),
      pupilLY: instance.number("_pupilLY"),
      pupilRY: instance.number("_pupilRY"),
      blinkScale: instance.number("_blinkScale"),
    };
    if (Object.values(bindings).some((binding) => !binding)) {
      instance.cleanup();
      return false;
    }

    this.#rive.bindViewModelInstance(instance);
    this.#viewModelInstance = instance;
    this.#bindings = bindings as RiveBindings;
    return true;
  }

  #currentBlinkScale(nowMs: number): number {
    if (this.#blinkStartedMs === null) return 1;
    const elapsedMs = nowMs - this.#blinkStartedMs;
    if (elapsedMs <= 45) return 1 - (elapsedMs / 45) * 0.92;
    if (elapsedMs <= 70) return 0.08;
    if (elapsedMs <= 130) return 0.08 + ((elapsedMs - 70) / 60) * 0.92;
    this.#blinkStartedMs = null;
    return 1;
  }
}
