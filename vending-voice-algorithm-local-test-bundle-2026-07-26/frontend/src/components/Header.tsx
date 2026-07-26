import type { ConnectionState } from "../hooks/useTelemetry";

export function Header({
  open,
  ready,
  busy,
  voiceMuted,
  onToggle,
  onToggleSound,
}: {
  open: boolean;
  ready: boolean;
  busy: boolean;
  connection: ConnectionState;
  voiceMuted: boolean;
  onToggle: () => void;
  onToggleSound: () => void;
}) {
  const healthy = open && ready;
  return (
    <header className="simple-header">
      <a className="brand" href="#demo">
        <span className="brand-mark">VA</span>
        <span>
          <strong>Vending Attention</strong>
          <small>Face tracking demo · local only</small>
        </span>
      </a>
      <div className={`simple-runtime-status ${healthy ? "is-live" : ""}`}>
        <span className="live-dot" />
        {healthy ? "CAMERA LIVE" : open ? "STARTING" : "DEMO CLOSED"}
      </div>
      <button
        className={`sound-button ${voiceMuted ? "is-muted" : "is-enabled"}`}
        disabled={busy}
        onClick={onToggleSound}
        type="button"
      >
        {voiceMuted ? "Enable sound" : "Mute sound"}
      </button>
      <button
        className={`demo-power-button ${open ? "is-open" : ""}`}
        disabled={busy}
        onClick={onToggle}
        type="button"
      >
        <span aria-hidden="true">{open ? "×" : "●"}</span>
        {busy ? (open ? "Closing…" : "Opening…") : open ? "Close demo" : "Open demo"}
      </button>
    </header>
  );
}
