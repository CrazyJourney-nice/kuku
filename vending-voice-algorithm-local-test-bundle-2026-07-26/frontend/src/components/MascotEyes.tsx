import { useEffect, useRef, useState } from "react";
import type { DemoFramePacket } from "../contracts";
import { mirrorHorizontal } from "../mirroring";

export function MascotEyes({
  packet,
  onSettled,
}: {
  packet: DemoFramePacket | null;
  onSettled: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef({ x: 0, y: 0 });
  const reported = useRef<string | null>(null);
  const rawTarget = packet?.mascot_state.target ?? { x: 0, y: 0 };
  const target = { x: mirrorHorizontal(rawTarget.x), y: rawTarget.y };
  const [settled, setSettled] = useState(true);

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");
    if (!el || !context) return;
    let animationFrame = 0;
    let stableFrames = 0;
    const draw = () => {
      const ratio = devicePixelRatio || 1;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (el.width !== width * ratio || el.height !== height * ratio) {
        el.width = width * ratio;
        el.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      current.current.x += (Math.max(-1, Math.min(1, target.x)) - current.current.x) * 0.14;
      current.current.y += (Math.max(-1, Math.min(1, target.y)) - current.current.y) * 0.14;
      stableFrames =
        Math.hypot(current.current.x - target.x, current.current.y - target.y) < 0.012
          ? stableFrames + 1
          : 0;
      const isSettled = stableFrames > 10;
      setSettled(isSettled);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#14201c";
      context.fillRect(0, 0, width, height);
      const eyeWidth = Math.min(126, width * 0.27);
      const eyeHeight = eyeWidth * 0.72;
      const gap = eyeWidth * 0.3;
      const pupilRadius = eyeHeight * 0.19;
      [-1, 1].forEach((side) => {
        const x = width / 2 + side * (eyeWidth / 2 + gap);
        const y = height / 2;
        context.fillStyle = "#eef6f1";
        context.beginPath();
        context.ellipse(x, y, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2);
        context.fill();
        const pupilX = x + current.current.x * eyeWidth * 0.25;
        const pupilY = y + current.current.y * eyeHeight * 0.27;
        context.fillStyle = "#0d1714";
        context.beginPath();
        context.arc(pupilX, pupilY, pupilRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#74f5b5";
        context.beginPath();
        context.arc(
          pupilX + pupilRadius * 0.28,
          pupilY - pupilRadius * 0.28,
          pupilRadius * 0.22,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      if (
        isSettled &&
        packet?.mascot_state.command_id &&
        packet.mascot_state.command_id !== reported.current
      ) {
        reported.current = packet.mascot_state.command_id;
        onSettled(packet.mascot_state.command_id);
      }
      animationFrame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [target.x, target.y, packet?.mascot_state.command_id, onSettled]);

  const targetLabel =
    packet?.visual_target_id === null || packet?.visual_target_id === undefined
      ? "Waiting for face"
      : `Following face T${packet.visual_target_id}`;

  return (
    <section className={`simple-eyes-card ${packet ? "is-active" : "is-neutral"}`}>
      <div className="simple-eyes-heading">
        <div>
          <p className="eyebrow">MASCOT EYES</p>
          <h2>{packet ? targetLabel : "Neutral"}</h2>
        </div>
        <span className={packet ? "is-live" : ""}>{packet ? (settled ? "READY" : "MOVING") : "OFF"}</span>
      </div>
      <canvas ref={canvas} className="simple-mascot-canvas" aria-label="Animated mascot eyes" />
      <p className="eyes-policy">
        {packet ? "Automatically follows the first stable visual target." : "Eyes return to neutral when closed."}
      </p>
    </section>
  );
}
