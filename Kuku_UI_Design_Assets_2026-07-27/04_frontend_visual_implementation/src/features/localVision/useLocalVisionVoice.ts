"use client";

import { decode } from "@msgpack/msgpack";
import { useCallback, useEffect, useState } from "react";
import type { MascotLookTarget } from "@/src/components/mascot/MascotRenderer";

const LOCAL_RUNTIME_ORIGIN = "http://127.0.0.1:8765";
const LOCAL_TELEMETRY_URL = "ws://127.0.0.1:8765/ws/telemetry";

type RuntimeStatus = "connecting" | "live" | "unavailable";

type LocalFrame = {
  commandId: string | null;
  lookTarget: MascotLookTarget;
};

type RuntimeHealth = {
  status?: string;
  voice_muted?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readLocalFrame(value: unknown): LocalFrame | null {
  if (!isRecord(value) || !isRecord(value.mascot_state)) return null;
  const mascotState = value.mascot_state;
  const rawTarget = mascotState.target;
  if (!isRecord(rawTarget) || !finiteNumber(rawTarget.x) || !finiteNumber(rawTarget.y)) {
    return null;
  }
  const commandId =
    typeof mascotState.command_id === "string" ? mascotState.command_id : null;
  return {
    commandId,
    // The kiosk and the local camera use the same mirrored visual convention.
    lookTarget: {
      x: Math.max(-1, Math.min(1, -rawTarget.x)),
      y: Math.max(-1, Math.min(1, rawTarget.y)),
    },
  };
}

async function localRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${LOCAL_RUNTIME_ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Local runtime request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function useLocalVisionVoice() {
  const [frame, setFrame] = useState<LocalFrame>({
    commandId: null,
    lookTarget: null,
  });
  const [status, setStatus] = useState<RuntimeStatus>("connecting");
  const [voiceMuted, setVoiceMuted] = useState(true);
  const [voiceBusy, setVoiceBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;

    const scheduleRetry = (callback: () => void) => {
      if (disposed || retryTimer !== null) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        callback();
      }, 4_000);
    };

    const connectTelemetry = () => {
      if (disposed) return;
      socket = new WebSocket(LOCAL_TELEMETRY_URL);
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        if (!disposed) setStatus("live");
      };
      socket.onmessage = (event) => {
        if (disposed || !(event.data instanceof ArrayBuffer)) return;
        try {
          const nextFrame = readLocalFrame(decode(new Uint8Array(event.data)));
          if (nextFrame) {
            setFrame(nextFrame);
            setStatus("live");
          }
        } catch {
          // A malformed local packet is ignored; the next current frame replaces it.
        }
      };
      socket.onerror = () => {
        if (!disposed) setStatus("unavailable");
      };
      socket.onclose = () => {
        if (disposed) return;
        setFrame({ commandId: null, lookTarget: null });
        setStatus("unavailable");
        scheduleRetry(boot);
      };
    };

    const boot = async () => {
      if (disposed) return;
      setStatus("connecting");
      try {
        const health = await localRequest<RuntimeHealth>("/health");
        if (disposed) return;
        // This UI always starts silent, even if another local client left the
        // shared runtime unmuted during an earlier session.
        if (health.voice_muted === false) {
          await localRequest("/api/voice/mute", {
            method: "POST",
            body: JSON.stringify({ muted: true }),
          });
        }
        setVoiceMuted(true);
        if (health.status !== "RUNNING") {
          await localRequest("/api/mode", {
            method: "POST",
            body: JSON.stringify({ mode: "LIVE" }),
          });
        }
        if (!disposed) connectTelemetry();
      } catch {
        if (disposed) return;
        setFrame({ commandId: null, lookTarget: null });
        setStatus("unavailable");
        scheduleRetry(boot);
      }
    };

    void boot();
    return () => {
      disposed = true;
      socket?.close();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, []);

  const toggleVoice = useCallback(async () => {
    if (status !== "live" || voiceBusy) return;
    setVoiceBusy(true);
    try {
      const nextMuted = !voiceMuted;
      await localRequest("/api/voice/mute", {
        method: "POST",
        body: JSON.stringify({ muted: nextMuted }),
      });
      setVoiceMuted(nextMuted);
    } catch {
      setStatus("unavailable");
    } finally {
      setVoiceBusy(false);
    }
  }, [status, voiceBusy, voiceMuted]);

  const reportEyesSettled = useCallback((commandId: string) => {
    if (status !== "live") return;
    void localRequest("/api/mascot/settled", {
      method: "POST",
      body: JSON.stringify({ command_id: commandId }),
    }).catch(() => {
      // A newer target may replace the command before the acknowledgement arrives.
    });
  }, [status]);

  return {
    commandId: frame.commandId,
    lookTarget: status === "live" ? frame.lookTarget : null,
    reportEyesSettled,
    status,
    toggleVoice,
    voiceBusy,
    voiceMuted,
  } as const;
}
