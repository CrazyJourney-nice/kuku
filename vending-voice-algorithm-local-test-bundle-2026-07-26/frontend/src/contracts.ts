export type Mode = "LIVE";
export type AttentionState = "NO_TARGET" | "TRACKING" | "QUALIFYING" | "ATTENDING" | "GROUP_ATTENTION" | "LOST" | "CROWD_SAFE" | "FAULT";
export type ProximityState = "UNKNOWN" | "FAR" | "APPROACHING" | "NEAR" | "LEAVING";
export type VoiceStatus = "NONE" | "MUTED" | "PENDING" | "PLAYED" | "SUPPRESSED" | "UNAVAILABLE";
export type VoiceJourneyState = "IDLE" | "GREETED" | "FOLLOWED_UP";
export type VoiceStage = "PROXIMITY_GREETING" | "ATTENTION_FOLLOW_UP";
export interface Vector2 { x: number; y: number }
export interface HeadPose { yaw: number; pitch: number; roll: number }
export interface TrackSnapshot {
  track_id: number;
  bbox: [number, number, number, number];
  face_confidence: number;
  face_width_px: number;
  raw_head_pose: HeadPose | null;
  filtered_head_pose: HeadPose | null;
  gaze: Vector2 | null;
  motion: number;
  dwell_ms: number;
  attention_score: number;
  state: string;
  reason: string;
  selected: boolean;
  stale: boolean;
}
export interface DemoFramePacket {
  frame_id: number;
  source_timestamp_ms: number;
  processed_timestamp_ms: number;
  mode: Mode;
  image_jpeg: Uint8Array;
  tracks: TrackSnapshot[];
  visual_target_id: number | null;
  visual_target_reason: string;
  selected_target_id: number | null;
  attention_state: AttentionState;
  proximity: {
    state: ProximityState;
    track_id: number | null;
    face_width_ratio: number | null;
    entered: boolean;
    episode_id: string | null;
    reason: string;
  };
  mascot_state: {
    command_id: string | null;
    target: Vector2;
    moving: boolean;
    settled: boolean;
    started_at_ms: number | null;
    settled_at_ms: number | null;
  };
  voice_event: {
    event_id: string | null;
    status: VoiceStatus;
    clip_id: string | null;
    episode_id: string | null;
    played_at_ms: number | null;
  };
  voice_journey: {
    interaction_id: string | null;
    state: VoiceJourneyState;
    triggered_stage: VoiceStage | null;
    proximity_greeting_triggered: boolean;
    attention_followup_triggered: boolean;
    completed_stages: VoiceStage[];
    attention_dwell_ms: number;
  };
  trigger_reason: string | null;
  rejection_reason: string | null;
  stage_latency_ms: Record<string, number>;
  fps: { capture: number; processed: number };
  dropped_frames: number;
  queue_depth: 0 | 1;
  stale_fields: string[];
}
export interface DemoConfig {
  camera?: { index?: number; width?: number; height?: number; fps?: number };
  attention?: {
    face_confidence_min?: number;
    face_width_for_gaze_px?: number;
    head_candidate_error_deg?: number;
    gaze_confirmation_error_deg?: number;
    valid_dwell_ms?: number;
    head_only_dwell_ms?: number;
    fast_lateral_motion_norm_s?: number;
    eye_settle_ms?: number;
  };
  proximity?: {
    interaction_roi?: [number, number, number, number];
    enter_face_width_ratio?: number;
    exit_face_width_ratio?: number;
    enter_dwell_ms?: number;
    exit_dwell_ms?: number;
    smoothing_alpha?: number;
    edge_margin_ratio?: number;
    face_confidence_min?: number;
  };
  voice?: {
    muted?: boolean;
    proximity_clip_id?: string;
    followup_clip_id?: string;
    path?: string;
  };
  voice_journey?: {
    followup_dwell_ms?: number;
  };
}
const attention = new Set(["NO_TARGET","TRACKING","QUALIFYING","ATTENDING","GROUP_ATTENTION","LOST","CROWD_SAFE","FAULT"]);
const proximityStates = new Set(["UNKNOWN","FAR","APPROACHING","NEAR","LEAVING"]);
const voices = new Set(["NONE","MUTED","PENDING","PLAYED","SUPPRESSED","UNAVAILABLE"]);
const voiceJourneyStates = new Set(["IDLE","GREETED","FOLLOWED_UP"]);
const voiceStages = new Set(["PROXIMITY_GREETING","ATTENTION_FOLLOW_UP"]);
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const vector = (v: unknown): v is Vector2 => record(v) && finite(v.x) && finite(v.y);
const pose = (v: unknown): v is HeadPose | null => v === null || (record(v) && finite(v.yaw) && finite(v.pitch) && finite(v.roll));
const track = (v: unknown): v is TrackSnapshot => record(v) && Array.isArray(v.bbox) && v.bbox.length === 4 && v.bbox.every(finite) &&
  Number.isInteger(v.track_id) && finite(v.face_confidence) && finite(v.face_width_px) && pose(v.raw_head_pose) && pose(v.filtered_head_pose) &&
  (v.gaze === null || vector(v.gaze)) && finite(v.motion) && finite(v.dwell_ms) && finite(v.attention_score) &&
  typeof v.state === "string" && typeof v.reason === "string" && typeof v.selected === "boolean" && typeof v.stale === "boolean";
export function isDemoFramePacket(v: unknown): v is DemoFramePacket {
  if (!record(v)) return false;
  const m = v.mascot_state, voice = v.voice_event, journey = v.voice_journey, fps = v.fps, proximity = v.proximity;
  return Number.isInteger(v.frame_id) && finite(v.source_timestamp_ms) && finite(v.processed_timestamp_ms) &&
    v.mode === "LIVE" && (v.image_jpeg instanceof Uint8Array || v.image_jpeg instanceof ArrayBuffer) &&
    Array.isArray(v.tracks) && v.tracks.every(track) &&
    (v.visual_target_id === null || Number.isInteger(v.visual_target_id)) &&
    typeof v.visual_target_reason === "string" &&
    (v.selected_target_id === null || Number.isInteger(v.selected_target_id)) &&
    typeof v.attention_state === "string" && attention.has(v.attention_state) &&
    record(proximity) && typeof proximity.state === "string" && proximityStates.has(proximity.state) &&
    (proximity.track_id === null || Number.isInteger(proximity.track_id)) &&
    (proximity.face_width_ratio === null || finite(proximity.face_width_ratio)) &&
    typeof proximity.entered === "boolean" &&
    (proximity.episode_id === null || typeof proximity.episode_id === "string") &&
    typeof proximity.reason === "string" &&
    record(m) && (m.command_id === null || typeof m.command_id === "string") && vector(m.target) && typeof m.moving === "boolean" && typeof m.settled === "boolean" &&
    (m.started_at_ms === null || finite(m.started_at_ms)) && (m.settled_at_ms === null || finite(m.settled_at_ms)) &&
    record(voice) && (voice.event_id === null || typeof voice.event_id === "string") && typeof voice.status === "string" && voices.has(voice.status) &&
    (voice.clip_id === null || typeof voice.clip_id === "string") && (voice.episode_id === null || typeof voice.episode_id === "string") &&
    (voice.played_at_ms === null || finite(voice.played_at_ms)) &&
    record(journey) &&
    (journey.interaction_id === null || typeof journey.interaction_id === "string") &&
    typeof journey.state === "string" && voiceJourneyStates.has(journey.state) &&
    (journey.triggered_stage === null || (typeof journey.triggered_stage === "string" && voiceStages.has(journey.triggered_stage))) &&
    typeof journey.proximity_greeting_triggered === "boolean" &&
    typeof journey.attention_followup_triggered === "boolean" &&
    Array.isArray(journey.completed_stages) && journey.completed_stages.every(
      stage => typeof stage === "string" && voiceStages.has(stage),
    ) &&
    finite(journey.attention_dwell_ms) && journey.attention_dwell_ms >= 0 &&
    (v.trigger_reason === null || typeof v.trigger_reason === "string") && (v.rejection_reason === null || typeof v.rejection_reason === "string") &&
    record(v.stage_latency_ms) && Object.values(v.stage_latency_ms).every(finite) && record(fps) && finite(fps.capture) && finite(fps.processed) &&
    Number.isInteger(v.dropped_frames) && (v.queue_depth === 0 || v.queue_depth === 1) && Array.isArray(v.stale_fields) && v.stale_fields.every(x => typeof x === "string");
}
