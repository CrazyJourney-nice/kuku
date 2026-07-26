import { useEffect, useRef, useState } from "react";
import type { DemoFramePacket } from "../contracts";
import { packetToVisualTargetSample } from "../mascot/visualTargetAdapter";
import {
  MascotRenderer,
  type RendererStatus,
} from "../mascot/MascotRenderer";
import { TrackingController } from "../mascot/tracking/controller";

export function MascotEyes({
  packet,
  onSettled,
}: {
  packet: DemoFramePacket | null;
  onSettled: (id: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<MascotRenderer | null>(null);
  const controller = useRef(
    new TrackingController({
      acquireStabilityMs: 0,
      lostTargetHoldMs: 0,
    }),
  );
  const reported = useRef<string | null>(null);
  const [runtime, setRuntime] = useState<RendererStatus>("checking");
  const [runtimeDetail, setRuntimeDetail] = useState("Loading local Rive mascot");

  useEffect(() => {
    if (!stage.current) return;
    const riveRenderer = new MascotRenderer(
      stage.current,
      "./mascot-tracking-pilot-v1.riv",
      (status, detail) => {
        setRuntime(status);
        setRuntimeDetail(detail);
      },
    );
    renderer.current = riveRenderer;
    void riveRenderer.initialize();

    let animationFrame = 0;
    const draw = (nowMs: number) => {
      riveRenderer.update(controller.current.tick(nowMs));
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    const resize = () => riveRenderer.resize();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      riveRenderer.destroy();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    const nowMs = performance.now();
    if (packet) {
      controller.current.ingest(packetToVisualTargetSample(packet, nowMs));
    } else {
      controller.current.reset(nowMs);
      renderer.current?.reset();
    }
  }, [packet]);

  useEffect(() => {
    const commandId = packet?.mascot_state.command_id;
    if (packet?.mascot_state.settled && commandId && commandId !== reported.current) {
      reported.current = commandId;
      onSettled(commandId);
    }
  }, [packet?.mascot_state.command_id, packet?.mascot_state.settled, onSettled]);

  const hasVisualTarget = Boolean(
    packet?.visual_target_id !== null &&
      packet?.visual_target_id !== undefined &&
      packet?.mascot_state.command_id,
  );
  const targetLabel = hasVisualTarget
    ? `Following face T${packet?.visual_target_id}`
    : packet
      ? "Waiting for gaze"
      : "Neutral";
  const runtimeLabel =
    runtime === "rive" || runtime === "vector"
      ? hasVisualTarget
        ? "TRACKING"
        : "READY"
      : runtime === "checking"
        ? "LOADING"
        : "RIVE ERROR";

  return (
    <section
      className={`simple-eyes-card ${hasVisualTarget ? "is-active" : "is-neutral"}`}
      data-runtime={runtime}
    >
      <div className="simple-eyes-heading">
        <div>
          <p className="eyebrow">LIVE RIVE MASCOT</p>
          <h2>{targetLabel}</h2>
        </div>
        <span className={hasVisualTarget ? "is-live" : ""}>{runtimeLabel}</span>
      </div>
      <div className="simple-mascot-stage">
        <div ref={stage} className="simple-mascot-runtime" />
        {runtime === "checking" && (
          <div className="mascot-runtime-message" role="status">
            <span className="loader-orbit" />
            <strong>Loading mascot animation</strong>
            <small>{runtimeDetail}</small>
          </div>
        )}
      </div>
      <p className="eyes-policy">
        {hasVisualTarget
          ? "The backend-selected face position drives the mascot eyes; the body follows with slower damping."
          : "The mascot returns to neutral when no visual face target is available."}
      </p>
    </section>
  );
}
