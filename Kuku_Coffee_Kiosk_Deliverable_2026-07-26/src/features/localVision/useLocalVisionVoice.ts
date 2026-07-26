"use client";

import { decode } from "@msgpack/msgpack";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MascotLookTarget } from "@/src/components/mascot/MascotRenderer";
import type { KioskScreen } from "@/src/domain/kioskState";

const LOCAL_RUNTIME_ORIGIN = "http://127.0.0.1:8765";
const LOCAL_TELEMETRY_URL = "ws://127.0.0.1:8765/ws/telemetry";
export const DEFAULT_VOICE_MUTED = false;
export type HostVoiceClipId = "quick_buy_prompt" | "order_thanks";

export function hostVoiceClipForScreen(
  screen: KioskScreen,
  clientOrderId: string | null,
): HostVoiceClipId | null {
  if (screen === "welcome") return "quick_buy_prompt";
  if (screen === "brewing" && clientOrderId) return "order_thanks";
  return null;
}

export type RuntimeStatus =
  | "connecting"
  | "live"
  | "camera-off"
  | "unavailable";

type LocalFrame = {
  commandId: string | null;
  lookTarget: MascotLookTarget;
  personDetected: boolean;
  proximityGreetingEventId: string | null;
};

type RuntimeHealth = {
  status?: string;
  voice_muted?: boolean;
};

type VoicePlayResult = {
  status?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const EMPTY_FRAME: LocalFrame = {
  commandId: null,
  lookTarget: null,
  personDetected: false,
  proximityGreetingEventId: null,
};

export function readLocalFrame(value: unknown): LocalFrame | null {
  if (!isRecord(value) || !isRecord(value.mascot_state)) return null;
  const mascotState = value.mascot_state;
  const rawTarget = mascotState.target;
  if (!isRecord(rawTarget) || !finiteNumber(rawTarget.x) || !finiteNumber(rawTarget.y)) {
    return null;
  }
  const commandId =
    typeof mascotState.command_id === "string" ? mascotState.command_id : null;
  const voiceEvent = isRecord(value.voice_event) ? value.voice_event : null;
  const voiceJourney = isRecord(value.voice_journey)
    ? value.voice_journey
    : null;
  const playedGreetingEventId =
    voiceEvent?.status === "PLAYED" &&
    voiceEvent.clip_id === "proximity_greeting" &&
    typeof voiceEvent.event_id === "string"
      ? voiceEvent.event_id
      : null;
  const latchedGreetingEventId =
    Array.isArray(voiceJourney?.completed_stages) &&
    voiceJourney.completed_stages.includes("PROXIMITY_GREETING") &&
    typeof voiceJourney.interaction_id === "string"
      ? `proximity-greeting:${voiceJourney.interaction_id}`
      : null;
  return {
    commandId,
    personDetected:
      typeof value.visual_target_id === "number" &&
      Number.isFinite(value.visual_target_id),
    // The kiosk and the local camera use the same mirrored visual convention.
    lookTarget: {
      x: Math.max(-1, Math.min(1, -rawTarget.x)),
      y: Math.max(-1, Math.min(1, rawTarget.y)),
    },
    proximityGreetingEventId:
      playedGreetingEventId ?? latchedGreetingEventId,
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
  const [frame, setFrame] = useState<LocalFrame>(EMPTY_FRAME);
  const [status, setStatus] = useState<RuntimeStatus>("connecting");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraBusy, setCameraBusy] = useState(true);
  const [proximityGreetingEventId, setProximityGreetingEventId] = useState<
    string | null
  >(null);
  const [voiceMuted, setVoiceMuted] = useState(DEFAULT_VOICE_MUTED);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

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
      socketRef.current = socket;
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        if (!disposed) {
          setStatus("live");
          setCameraBusy(false);
        }
      };
      socket.onmessage = (event) => {
        if (disposed || !(event.data instanceof ArrayBuffer)) return;
        try {
          const nextFrame = readLocalFrame(decode(new Uint8Array(event.data)));
          if (nextFrame) {
            setFrame(nextFrame);
            if (nextFrame.proximityGreetingEventId) {
              setProximityGreetingEventId(
                nextFrame.proximityGreetingEventId,
              );
            }
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
        socketRef.current = null;
        setFrame(EMPTY_FRAME);
        setStatus("unavailable");
        setCameraBusy(false);
        scheduleRetry(boot);
      };
    };

    const boot = async () => {
      if (disposed) return;
      setStatus("connecting");
      setCameraBusy(true);
      try {
        const health = await localRequest<RuntimeHealth>("/health");
        if (disposed) return;
        // Product default: voice is on whenever the kiosk reconnects.
        if (health.voice_muted !== DEFAULT_VOICE_MUTED) {
          await localRequest("/api/voice/mute", {
            method: "POST",
            body: JSON.stringify({ muted: DEFAULT_VOICE_MUTED }),
          });
        }
        setVoiceMuted(DEFAULT_VOICE_MUTED);
        if (health.status !== "RUNNING") {
          await localRequest("/api/mode", {
            method: "POST",
            body: JSON.stringify({ mode: "LIVE" }),
          });
        }
        if (!disposed) connectTelemetry();
      } catch {
        if (disposed) return;
        setFrame(EMPTY_FRAME);
        setStatus("unavailable");
        setCameraBusy(false);
        scheduleRetry(boot);
      }
    };

    if (!cameraEnabled) {
      setFrame(EMPTY_FRAME);
      setStatus("camera-off");
      setCameraBusy(false);
      return () => {
        disposed = true;
      };
    }

    void boot();
    return () => {
      disposed = true;
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [cameraEnabled]);

  const toggleCamera = useCallback(async () => {
    if (cameraBusy) return;
    if (!cameraEnabled) {
      setCameraEnabled(true);
      return;
    }

    setCameraBusy(true);
    try {
      await localRequest("/api/session/stop", { method: "POST" });
      socketRef.current?.close();
      socketRef.current = null;
      setCameraEnabled(false);
      setFrame(EMPTY_FRAME);
      setStatus("camera-off");
    } catch {
      setStatus("unavailable");
      setCameraBusy(false);
    }
  }, [cameraBusy, cameraEnabled]);

  const toggleVoice = useCallback(async () => {
    if (!cameraEnabled || status !== "live" || voiceBusy) return;
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
  }, [cameraEnabled, status, voiceBusy, voiceMuted]);

  const cancelVoiceFollowup = useCallback(async () => {
    if (status !== "live") return false;
    try {
      await localRequest("/api/voice/cancel-followup", {
        method: "POST",
      });
      return true;
    } catch {
      return false;
    }
  }, [status]);

  const playVoiceClip = useCallback(async (clipId: HostVoiceClipId) => {
    if (status !== "live") return false;
    try {
      const result = await localRequest<VoicePlayResult>("/api/voice/play", {
        method: "POST",
        body: JSON.stringify({ clip_id: clipId }),
      });
      return result.status === "PLAYED" || result.status === "MUTED";
    } catch {
      return false;
    }
  }, [status]);

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
    cameraBusy,
    cameraEnabled,
    cancelVoiceFollowup,
    commandId: frame.commandId,
    lookTarget: status === "live" ? frame.lookTarget : null,
    personDetected: status === "live" && frame.personDetected,
    playVoiceClip,
    proximityGreetingEventId,
    reportEyesSettled,
    status,
    toggleCamera,
    toggleVoice,
    voiceBusy,
    voiceMuted,
  } as const;
}
