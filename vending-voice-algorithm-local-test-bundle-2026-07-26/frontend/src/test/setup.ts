import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const context = {
  scale: vi.fn(),
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  fillText: vi.fn(),
  setLineDash: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "left",
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: vi.fn(() => context),
});

Object.defineProperty(HTMLCanvasElement.prototype, "getBoundingClientRect", {
  value: vi.fn(() => ({
    width: 960,
    height: 540,
    top: 0,
    left: 0,
    right: 960,
    bottom: 540,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })),
});

globalThis.requestAnimationFrame = vi.fn(() => 1);
globalThis.cancelAnimationFrame = vi.fn();
