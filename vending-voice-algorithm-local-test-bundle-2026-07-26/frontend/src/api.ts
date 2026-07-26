import { decode } from "@msgpack/msgpack";
import { type DemoConfig, type DemoFramePacket, type Mode, isDemoFramePacket } from "./contracts";
export const API_ROUTES = {
  telemetry: "/ws/telemetry", health: "/health", config: "/api/config", mode: "/api/mode",
  stopSession: "/api/session/stop",
  preflight: "/api/preflight", voiceMute: "/api/voice/mute",
  eyeSettled: "/api/mascot/settled",
} as const;
export class ApiError extends Error { constructor(message: string, readonly status?: number) { super(message); this.name = "ApiError"; } }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(path, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const raw = await response.text();
      let message = raw || `Request failed (${response.status})`;
      try {
        const parsed = JSON.parse(raw) as { detail?: unknown };
        if (typeof parsed.detail === "string") message = parsed.detail;
      } catch {
        // Preserve a non-JSON local error body.
      }
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Local runtime did not respond within 8 seconds.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
export interface HealthInfo {
  status: string; mode?: Mode; config_hash?: string; model_hash?: string; bind_host?: string;
  voice_muted?: boolean;
  audio_status?: "HEALTHY" | "UNAVAILABLE" | "UNKNOWN";
  health?: { audio?: string; camera?: string; face_model?: string; gaze_model?: string; pipeline?: string };
}
export const demoApi = {
  getHealth: () => request<HealthInfo>(API_ROUTES.health),
  getConfig: () => request<DemoConfig>(API_ROUTES.config),
  setMode: (mode: Mode) => request<void>(API_ROUTES.mode, { method: "POST", body: JSON.stringify({ mode }) }),
  stopSession: () => request<{ stopped: boolean }>(API_ROUTES.stopSession, { method: "POST", body: "{}" }),
  preflight: () => request<{ ready: boolean; checks: Array<{ label: string; status: "PASS" | "FAIL"; detail?: string }> }>(API_ROUTES.preflight, { method: "POST", body: "{}" }),
  setVoiceMuted: (muted: boolean) => request<void>(API_ROUTES.voiceMute, { method: "POST", body: JSON.stringify({ muted }) }),
  reportEyeSettled: (commandId: string) => request<void>(API_ROUTES.eyeSettled, { method: "POST", body: JSON.stringify({ command_id: commandId }) }),
};
export const telemetryUrl = () => `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${API_ROUTES.telemetry}`;
export function decodeFramePacket(data: ArrayBuffer): DemoFramePacket {
  const value = decode(new Uint8Array(data));
  if (!isDemoFramePacket(value)) throw new ApiError("Telemetry packet does not match DemoFramePacket contract.");
  if (value.image_jpeg instanceof ArrayBuffer) value.image_jpeg = new Uint8Array(value.image_jpeg);
  return value;
}
