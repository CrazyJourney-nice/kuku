import "./style.css";
import { MascotRenderer, type RendererStatus } from "./render/mascotRenderer";
import { TrackingController } from "./tracking/controller";
import { clamp } from "./tracking/math";
import {
  ManualTrackingSource,
  ScriptedMotion,
  type ScriptName,
} from "./tracking/sources";
import type { TrackingOutput } from "./tracking/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Application root is missing.");
}

app.innerHTML = `
  <header class="topbar">
    <div>
      <p class="eyebrow">Vending machine · Rive pilot v1</p>
      <h1>Mascot tracking lab</h1>
    </div>
    <div class="runtime-status">
      <span id="runtime-dot" class="runtime-status__dot"></span>
      <span>
        <strong id="runtime-label">Checking Rive asset</strong>
        <small id="runtime-detail">Runtime initialization</small>
      </span>
    </div>
  </header>

  <main class="workspace">
    <section class="stage-card">
      <div class="stage-card__header">
        <div>
          <span class="section-label">Live preview</span>
          <span id="mode-pill" class="mode-pill" data-mode="IDLE">IDLE</span>
        </div>
        <div class="frame-stats">
          <span><strong id="fps-value">—</strong> FPS</span>
          <span><strong id="frame-value">—</strong> ms</span>
        </div>
      </div>
      <div id="mascot-stage" class="mascot-stage">
        <div id="target-marker" class="target-marker" hidden>
          <span></span>
        </div>
        <div class="axis axis--horizontal"></div>
        <div class="axis axis--vertical"></div>
      </div>
      <div class="signal-strip">
        <div><small>Target</small><strong id="out-target">Absent</strong></div>
        <div><small>Filtered X</small><strong id="out-target-x">0.000</strong></div>
        <div><small>Filtered Y</small><strong id="out-target-y">0.000</strong></div>
        <div><small>Confidence</small><strong id="out-confidence">0.00</strong></div>
      </div>
    </section>

    <aside class="control-panel">
      <section class="control-section">
        <div class="control-section__title">
          <h2>ML sample</h2>
          <label class="toggle">
            <input id="target-present" type="checkbox">
            <span></span>
            Present
          </label>
        </div>

        <label class="range-control">
          <span>Horizontal <output id="target-x-label">0.00</output></span>
          <input id="target-x" type="range" min="-1" max="1" step="0.01" value="0">
          <small><i>viewer-left</i><i>viewer-right</i></small>
        </label>

        <label class="range-control">
          <span>Vertical <output id="target-y-label">0.00</output></span>
          <input id="target-y" type="range" min="-1" max="1" step="0.01" value="0">
          <small><i>down</i><i>up</i></small>
        </label>

        <label class="range-control">
          <span>Confidence <output id="confidence-label">0.92</output></span>
          <input id="confidence" type="range" min="0" max="1" step="0.01" value="0.92">
          <small><i>rejected</i><i>accepted ≥ 0.65</i></small>
        </label>

        <label class="range-control">
          <span>Jitter injection <output id="jitter-label">0.00</output></span>
          <input id="jitter" type="range" min="0" max="0.2" step="0.005" value="0">
          <small><i>clean</i><i>±0.20 noise</i></small>
        </label>
      </section>

      <section class="control-section">
        <h2>Direction presets</h2>
        <div class="preset-grid" aria-label="Nine-point target presets">
          <button data-preset="-1,1" title="Up left">↖</button>
          <button data-preset="0,1" title="Up">↑</button>
          <button data-preset="1,1" title="Up right">↗</button>
          <button data-preset="-1,0" title="Left">←</button>
          <button data-preset="0,0" title="Centre">•</button>
          <button data-preset="1,0" title="Right">→</button>
          <button data-preset="-1,-1" title="Down left">↙</button>
          <button data-preset="0,-1" title="Down">↓</button>
          <button data-preset="1,-1" title="Down right">↘</button>
        </div>
      </section>

      <section class="control-section">
        <h2>Scripted paths</h2>
        <div class="button-row button-row--stack">
          <button class="secondary" data-script="slow-walk">Slow walk · 8s</button>
          <button class="secondary" data-script="fast-crossing">Fast crossing · 2.5s</button>
          <button class="secondary" data-script="edge-entry">Left edge entry · 4s</button>
        </div>
      </section>

      <section class="control-section">
        <h2>Lifecycle</h2>
        <div class="button-row">
          <button id="lost-target" class="secondary">Lose target</button>
          <button id="reacquire" class="secondary">Reacquire</button>
        </div>
        <div class="button-row">
          <button id="fault" class="danger">Inject fault</button>
          <button id="reset" class="primary">Reset pilot</button>
        </div>
      </section>

      <section class="control-section output-section">
        <h2>Rive outputs</h2>
        <dl>
          <div><dt>bodyYaw</dt><dd id="out-body-yaw">0.000</dd></div>
          <div><dt>bodyPitch</dt><dd id="out-body-pitch">0.000</dd></div>
          <div><dt>eyeX</dt><dd id="out-eye-x">0.000</dd></div>
          <div><dt>eyeY</dt><dd id="out-eye-y">0.000</dd></div>
        </dl>
      </section>
    </aside>
  </main>
`;

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element is missing: ${selector}`);
  }
  return element;
};

const stage = required<HTMLElement>("#mascot-stage");
const modePill = required<HTMLElement>("#mode-pill");
const runtimeDot = required<HTMLElement>("#runtime-dot");
const runtimeLabel = required<HTMLElement>("#runtime-label");
const runtimeDetail = required<HTMLElement>("#runtime-detail");
const targetMarker = required<HTMLElement>("#target-marker");
const targetPresentInput = required<HTMLInputElement>("#target-present");
const targetXInput = required<HTMLInputElement>("#target-x");
const targetYInput = required<HTMLInputElement>("#target-y");
const confidenceInput = required<HTMLInputElement>("#confidence");
const jitterInput = required<HTMLInputElement>("#jitter");
const targetXLabel = required<HTMLOutputElement>("#target-x-label");
const targetYLabel = required<HTMLOutputElement>("#target-y-label");
const confidenceLabel = required<HTMLOutputElement>("#confidence-label");
const jitterLabel = required<HTMLOutputElement>("#jitter-label");
const fpsValue = required<HTMLElement>("#fps-value");
const frameValue = required<HTMLElement>("#frame-value");

const outputElements = {
  target: required<HTMLElement>("#out-target"),
  targetX: required<HTMLElement>("#out-target-x"),
  targetY: required<HTMLElement>("#out-target-y"),
  confidence: required<HTMLElement>("#out-confidence"),
  bodyYaw: required<HTMLElement>("#out-body-yaw"),
  bodyPitch: required<HTMLElement>("#out-body-pitch"),
  eyeX: required<HTMLElement>("#out-eye-x"),
  eyeY: required<HTMLElement>("#out-eye-y"),
};

const controller = new TrackingController();
const source = new ManualTrackingSource();
const motion = new ScriptedMotion();
source.start((sample) => controller.ingest(sample));

const setRuntimeStatus = (status: RendererStatus, detail: string): void => {
  const labels: Record<RendererStatus, string> = {
    checking: "Checking Rive asset",
    rive: "Rive runtime active",
    "fallback-missing": "SVG fallback active",
    "fallback-invalid": "Rive bindings incomplete",
  };
  runtimeLabel.textContent = labels[status];
  runtimeDetail.textContent = detail;
  runtimeDot.dataset.status = status;
};

const renderer = new MascotRenderer(
  stage,
  "./mascot-tracking-pilot-v1.riv",
  setRuntimeStatus,
);
void renderer.initialize();

const readControls = (): void => {
  source.state.targetPresent = targetPresentInput.checked;
  source.state.targetX = Number(targetXInput.value);
  source.state.targetY = Number(targetYInput.value);
  source.state.confidence = Number(confidenceInput.value);
  source.state.jitter = Number(jitterInput.value);
  targetXLabel.value = source.state.targetX.toFixed(2);
  targetYLabel.value = source.state.targetY.toFixed(2);
  confidenceLabel.value = source.state.confidence.toFixed(2);
  jitterLabel.value = source.state.jitter.toFixed(3);
};

const syncControlsFromState = (): void => {
  targetPresentInput.checked = source.state.targetPresent;
  targetXInput.value = String(clamp(source.state.targetX, -1, 1));
  targetYInput.value = String(clamp(source.state.targetY, -1, 1));
  readControls();
};

[
  targetPresentInput,
  targetXInput,
  targetYInput,
  confidenceInput,
  jitterInput,
].forEach((input) => input.addEventListener("input", readControls));

document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    motion.stop();
    const values = button.dataset.preset?.split(",").map(Number);
    if (!values || values.length !== 2) {
      return;
    }
    source.state.targetPresent = true;
    source.state.targetX = values[0] ?? 0;
    source.state.targetY = values[1] ?? 0;
    syncControlsFromState();
    source.emit(performance.now());
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-script]").forEach((button) => {
  button.addEventListener("click", () => {
    motion.start(button.dataset.script as ScriptName, performance.now());
    source.state.targetPresent = true;
    syncControlsFromState();
  });
});

required<HTMLButtonElement>("#lost-target").addEventListener("click", () => {
  motion.stop();
  source.state.targetPresent = false;
  syncControlsFromState();
  source.emit(performance.now());
});

required<HTMLButtonElement>("#reacquire").addEventListener("click", () => {
  source.state.targetPresent = true;
  syncControlsFromState();
  source.emit(performance.now());
});

required<HTMLButtonElement>("#fault").addEventListener("click", () => {
  motion.stop();
  source.state.targetPresent = false;
  syncControlsFromState();
  controller.fault(performance.now());
});

required<HTMLButtonElement>("#reset").addEventListener("click", () => {
  motion.stop();
  source.state.targetPresent = false;
  source.state.targetX = 0;
  source.state.targetY = 0;
  syncControlsFromState();
  const now = performance.now();
  controller.reset(now);
  renderer.reset();
});

const updateOutput = (output: TrackingOutput): void => {
  modePill.textContent = output.mode;
  modePill.dataset.mode = output.mode;
  outputElements.target.textContent = output.targetPresent ? "Present" : "Absent";
  outputElements.targetX.textContent = output.targetX.toFixed(3);
  outputElements.targetY.textContent = output.targetY.toFixed(3);
  outputElements.confidence.textContent = output.confidence.toFixed(2);
  outputElements.bodyYaw.textContent = output.bodyYaw.toFixed(3);
  outputElements.bodyPitch.textContent = output.bodyPitch.toFixed(3);
  outputElements.eyeX.textContent = output.eyeX.toFixed(3);
  outputElements.eyeY.textContent = output.eyeY.toFixed(3);

  targetMarker.hidden = !source.state.targetPresent;
  targetMarker.style.left = `${50 + source.state.targetX * 44}%`;
  targetMarker.style.top = `${50 - source.state.targetY * 44}%`;
};

let lastFrameMs = performance.now();
let lastSampleMs = 0;
let lastStatsUpdateMs = 0;
const frameHistory: number[] = [];

const frame = (timestampMs: number): void => {
  const frameMs = clamp(timestampMs - lastFrameMs, 0, 250);
  lastFrameMs = timestampMs;
  frameHistory.push(frameMs);
  if (frameHistory.length > 90) {
    frameHistory.shift();
  }

  const scriptActive = motion.apply(source.state, timestampMs);
  if (scriptActive) {
    syncControlsFromState();
  }
  if (timestampMs - lastSampleMs >= 1_000 / 30) {
    source.emit(timestampMs);
    lastSampleMs = timestampMs;
  }

  const output = controller.tick(timestampMs);
  renderer.update(output);
  updateOutput(output);

  if (timestampMs - lastStatsUpdateMs >= 250 && frameHistory.length > 0) {
    const averageMs =
      frameHistory.reduce((total, value) => total + value, 0) /
      frameHistory.length;
    frameValue.textContent = averageMs.toFixed(1);
    fpsValue.textContent =
      averageMs > 0 ? Math.min(999, 1_000 / averageMs).toFixed(0) : "—";
    lastStatsUpdateMs = timestampMs;
  }

  requestAnimationFrame(frame);
};

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    motion.stop();
    source.state.targetPresent = false;
    controller.reset(performance.now());
    renderer.reset();
  }
});

window.addEventListener("beforeunload", () => {
  source.stop();
  renderer.destroy();
});

readControls();
requestAnimationFrame(frame);
