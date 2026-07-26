import { useCallback, useEffect, useRef, useState } from "react";
import { demoApi } from "./api";
import { Header } from "./components/Header";
import { MascotEyes } from "./components/MascotEyes";
import { VideoStage } from "./components/VideoStage";
import { TEST_FIXTURE_NOTICE } from "./fixture";
import { useTelemetry } from "./hooks/useTelemetry";

export default function App() {
  const { packet, connection, error: telemetryError, isFixture } = useTelemetry();
  const [open, setOpen] = useState(isFixture);
  const [ready, setReady] = useState(isFixture);
  const [busy, setBusy] = useState(true);
  const [voiceMuted, setVoiceMuted] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const initialized = useRef(false);
  const packetAtOpen = useRef<string | null>(null);

  useEffect(() => {
    if (isFixture || initialized.current) {
      setBusy(false);
      return;
    }
    initialized.current = true;
    void demoApi.getHealth()
      .then((health) => {
        const alreadyOpen = health.status === "RUNNING" && health.mode === "LIVE";
        setOpen(alreadyOpen);
        setVoiceMuted(health.voice_muted ?? true);
        if (alreadyOpen) packetAtOpen.current = null;
      })
      .catch((error) =>
        setActionError(error instanceof Error ? error.message : "Local demo status is unavailable."),
      )
      .finally(() => setBusy(false));
  }, [isFixture]);

  useEffect(() => {
    if (!open || !packet) return;
    const fingerprint = `${packet.frame_id}:${packet.processed_timestamp_ms}`;
    if (packetAtOpen.current === null || fingerprint !== packetAtOpen.current) {
      setReady(true);
    }
  }, [open, packet]);

  const toggleDemo = useCallback(async () => {
    if (isFixture) return;
    setBusy(true);
    setActionError(null);
    try {
      if (open) {
        await demoApi.stopSession();
        setOpen(false);
        setReady(false);
        packetAtOpen.current = null;
      } else {
        packetAtOpen.current = packet
          ? `${packet.frame_id}:${packet.processed_timestamp_ms}`
          : null;
        setReady(false);
        await demoApi.setMode("LIVE");
        setOpen(true);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The local demo could not change state.");
    } finally {
      setBusy(false);
    }
  }, [isFixture, open, packet]);

  const toggleSound = useCallback(async () => {
    if (isFixture) {
      setVoiceMuted((muted) => !muted);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const nextMuted = !voiceMuted;
      await demoApi.setVoiceMuted(nextMuted);
      setVoiceMuted(nextMuted);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Sound could not be changed.");
    } finally {
      setBusy(false);
    }
  }, [isFixture, voiceMuted]);

  const settled = useCallback(
    (commandId: string) => {
      if (open && !isFixture) {
        demoApi.reportEyeSettled(commandId).catch(() => {
          // Eye-settle acknowledgement is optional; tracking remains active.
        });
      }
    },
    [isFixture, open],
  );

  const activePacket = open && ready ? packet : null;
  const liveConnectionStale = open && (connection === "STALE" || connection === "ERROR");

  return (
    <div className="app-shell simple-app">
      <Header
        open={open}
        ready={ready}
        busy={busy}
        connection={connection}
        voiceMuted={voiceMuted}
        onToggle={() => void toggleDemo()}
        onToggleSound={() => void toggleSound()}
      />
      {isFixture && (
        <div className="fixture-banner">
          <strong>UI TEST MODE</strong>
          {TEST_FIXTURE_NOTICE}
        </div>
      )}
      {(actionError || (open && telemetryError)) && (
        <div className="error-banner" role="alert">
          <span>!</span>
          <div>
            <strong>Demo needs attention</strong>
            <p>{actionError ?? telemetryError}</p>
          </div>
          <button onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}
      <main id="demo" className="simple-demo">
        <section className="simple-intro">
          <div>
            <p className="eyebrow">REAL LOCAL FACE INFERENCE</p>
            <h1>{open ? "Face tracking is live." : "Face tracking demo."}</h1>
            <p>
              {open
                ? "Move in front of the MacBook camera. Your face position drives the mascot eyes and body in real time."
                : "Press Open demo to start the camera, face tracking and linked mascot animation."}
            </p>
          </div>
          <div className="fixed-logic">
            <span>FIXED DEMO LOGIC</span>
            <strong>Live camera · face-linked mascot animation · two-stage local voice</strong>
          </div>
        </section>
        <section className={`simple-stage-grid ${open ? "is-open" : "is-closed"}`}>
          <div className="simple-camera-card">
            {open ? (
              <VideoStage
                packet={activePacket}
                isFixture={isFixture}
                connectionStale={liveConnectionStale}
              />
            ) : (
              <div className="demo-closed-state" role="status">
                <span className="closed-camera-icon" aria-hidden="true" />
                <strong>Camera is off</strong>
                <p>No video is being captured.</p>
              </div>
            )}
          </div>
          <MascotEyes packet={activePacket} onSettled={settled} />
        </section>
        {open && (
          <div className="simple-live-note" role="status">
            <span className="live-dot" />
            <strong>{packet?.tracks.length ?? 0} face{packet?.tracks.length === 1 ? "" : "s"} detected</strong>
            <span>
              Proximity{" "}
              {packet?.proximity.state.toLowerCase().replaceAll("_", " ") ?? "unknown"}
            </span>
            <span>
              Voice journey{" "}
              {packet?.voice_journey.state.toLowerCase().replaceAll("_", " ") ?? "idle"}
            </span>
            <span>Sound {voiceMuted ? "muted" : "enabled"}</span>
            {packet?.voice_journey.state === "GREETED" &&
              packet.voice_journey.triggered_stage === null && (
                <span>
                  Follow-up in{" "}
                  {Math.max(0, Math.ceil((15000 - packet.voice_journey.attention_dwell_ms) / 1000))}s
                </span>
              )}
            {packet?.voice_journey.triggered_stage && (
              <span>
                Voice trigger ·{" "}
                {packet.voice_journey.triggered_stage.toLowerCase().replaceAll("_", " ")}
              </span>
            )}
            <span>
              Mascot target{" "}
              {packet?.visual_target_id === null || packet?.visual_target_id === undefined
                ? "waiting"
                : `T${packet.visual_target_id}`}
            </span>
          </div>
        )}
      </main>
      <footer className="simple-footer">
        Local inference · anonymous tracking · no cloud · settings fixed for demonstration
      </footer>
    </div>
  );
}
