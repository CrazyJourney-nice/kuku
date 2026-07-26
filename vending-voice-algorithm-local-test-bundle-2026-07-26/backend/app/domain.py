from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import numpy as np


class Mode(StrEnum):
    LIVE = "LIVE"


class AttentionState(StrEnum):
    NO_TARGET = "NO_TARGET"
    TRACKING = "TRACKING"
    QUALIFYING = "QUALIFYING"
    ATTENDING = "ATTENDING"
    GROUP_ATTENTION = "GROUP_ATTENTION"
    LOST = "LOST"
    CROWD_SAFE = "CROWD_SAFE"
    FAULT = "FAULT"


class ProximityState(StrEnum):
    UNKNOWN = "UNKNOWN"
    FAR = "FAR"
    APPROACHING = "APPROACHING"
    NEAR = "NEAR"
    LEAVING = "LEAVING"


class ProximityReason(StrEnum):
    NO_FACE = "NO_FACE"
    OUTSIDE_INTERACTION_ZONE = "OUTSIDE_INTERACTION_ZONE"
    FACE_EDGE_CROPPED = "FACE_EDGE_CROPPED"
    LOW_FACE_CONFIDENCE = "LOW_FACE_CONFIDENCE"
    STALE_RESULT = "STALE_RESULT"
    BELOW_ENTER_THRESHOLD = "BELOW_ENTER_THRESHOLD"
    ENTER_DWELL_PENDING = "ENTER_DWELL_PENDING"
    NEAR_ENTERED = "NEAR_ENTERED"
    NEAR_HELD = "NEAR_HELD"
    EXIT_DWELL_PENDING = "EXIT_DWELL_PENDING"
    ZONE_CLEARED = "ZONE_CLEARED"
    FAULT = "FAULT"


class Reason(StrEnum):
    NO_FACE = "NO_FACE"
    FACE_TOO_SMALL = "FACE_TOO_SMALL"
    LOW_FACE_CONFIDENCE = "LOW_FACE_CONFIDENCE"
    HEAD_OUTSIDE_ROI = "HEAD_OUTSIDE_ROI"
    GAZE_UNAVAILABLE = "GAZE_UNAVAILABLE"
    GAZE_OUTSIDE_ROI = "GAZE_OUTSIDE_ROI"
    DWELL_PENDING = "DWELL_PENDING"
    PASSERBY_TOO_FAST = "PASSERBY_TOO_FAST"
    TARGET_AMBIGUOUS = "TARGET_AMBIGUOUS"
    GROUP_ATTENTION = "GROUP_ATTENTION"
    CROWD_SAFE = "CROWD_SAFE"
    VOICE_MUTED = "VOICE_MUTED"
    CAMERA_UNAVAILABLE = "CAMERA_UNAVAILABLE"
    CAMERA_STALLED = "CAMERA_STALLED"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    AUDIO_UNAVAILABLE = "AUDIO_UNAVAILABLE"
    STALE_RESULT = "STALE_RESULT"
    ATTENTION_CONFIRMED = "ATTENTION_CONFIRMED"


class VisualTargetReason(StrEnum):
    NO_FACE = "NO_FACE"
    STABILIZING_FIRST_ENTRANT = "STABILIZING_FIRST_ENTRANT"
    FIRST_STABLE_ENTRANT = "FIRST_STABLE_ENTRANT"
    CURRENT_TARGET_LOCK = "CURRENT_TARGET_LOCK"
    TARGET_LOSS_GRACE = "TARGET_LOSS_GRACE"
    HANDOFF_PENDING = "HANDOFF_PENDING"
    CROWD_SAFE = "CROWD_SAFE"
    STALE_RESULT = "STALE_RESULT"
    FAULT = "FAULT"


class VoiceStage(StrEnum):
    PROXIMITY_GREETING = "PROXIMITY_GREETING"
    ATTENTION_FOLLOW_UP = "ATTENTION_FOLLOW_UP"


class VoiceJourneyState(StrEnum):
    IDLE = "IDLE"
    GREETED = "GREETED"
    FOLLOWED_UP = "FOLLOWED_UP"


@dataclass(slots=True)
class Frame:
    frame_id: int
    image: np.ndarray
    source_timestamp_ms: float
    mode: Mode


@dataclass(slots=True)
class FaceObservation:
    bbox: tuple[float, float, float, float]
    confidence: float
    landmarks: np.ndarray


@dataclass(slots=True)
class Pose:
    yaw: float
    pitch: float
    roll: float

    def as_dict(self) -> dict[str, float]:
        return {"yaw": self.yaw, "pitch": self.pitch, "roll": self.roll}


@dataclass(slots=True)
class Gaze:
    x: float
    y: float

    def as_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y}


@dataclass(slots=True)
class Track:
    track_id: int
    bbox: tuple[float, float, float, float]
    face_confidence: float
    face_width_px: float
    landmarks: np.ndarray
    last_seen_ms: float
    created_ms: float
    motion: float = 0.0
    raw_head_pose: Pose | None = None
    filtered_head_pose: Pose | None = None
    gaze: Gaze | None = None
    dwell_ms: float = 0.0
    attention_score: float = 0.0
    state: AttentionState = AttentionState.TRACKING
    reason: Reason = Reason.DWELL_PENDING
    selected: bool = False
    stale: bool = False

    @property
    def center(self) -> tuple[float, float]:
        x, y, w, h = self.bbox
        return x + w / 2, y + h / 2


@dataclass(slots=True)
class AttentionEvidence:
    track_id: int
    qualified: bool
    attention_score: float
    dwell_ms: float
    reason: Reason
    target: tuple[float, float]


@dataclass(slots=True)
class TargetDecision:
    state: AttentionState
    selected_track_id: int | None
    target: tuple[float, float]
    reason: Reason
    attending_ids: tuple[int, ...] = ()


@dataclass(slots=True)
class VisualTargetDecision:
    selected_track_id: int | None
    target: tuple[float, float]
    reason: VisualTargetReason


@dataclass(slots=True)
class ProximityDecision:
    state: ProximityState
    track_id: int | None
    face_width_ratio: float | None
    entered: bool
    episode_id: str | None
    reason: ProximityReason

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state.value,
            "track_id": self.track_id,
            "face_width_ratio": self.face_width_ratio,
            "entered": self.entered,
            "episode_id": self.episode_id,
            "reason": self.reason.value,
        }


@dataclass(slots=True, frozen=True)
class VoiceStageTrigger:
    event_id: str
    interaction_id: str
    stage: VoiceStage


@dataclass(slots=True)
class VoiceJourneySnapshot:
    interaction_id: str | None
    state: VoiceJourneyState
    triggered_stage: VoiceStage | None
    completed_stages: tuple[VoiceStage, ...]
    attention_dwell_ms: float

    def as_dict(self) -> dict[str, Any]:
        triggered = self.triggered_stage
        return {
            "interaction_id": self.interaction_id,
            "state": self.state.value,
            "triggered_stage": triggered.value if triggered else None,
            "proximity_greeting_triggered": (
                triggered == VoiceStage.PROXIMITY_GREETING
            ),
            "attention_followup_triggered": (
                triggered == VoiceStage.ATTENTION_FOLLOW_UP
            ),
            "completed_stages": [
                stage.value for stage in self.completed_stages
            ],
            "attention_dwell_ms": self.attention_dwell_ms,
        }


@dataclass(slots=True)
class EyeStatus:
    command_id: str | None = None
    target: tuple[float, float] = (0.0, 0.0)
    moving: bool = False
    settled: bool = True
    started_at_ms: float | None = None
    settled_at_ms: float | None = None


@dataclass(slots=True)
class VoiceEvent:
    event_id: str | None = None
    status: str = "NONE"
    clip_id: str | None = None
    episode_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "status": self.status,
            "clip_id": self.clip_id,
            "episode_id": self.episode_id,
        }


@dataclass(slots=True)
class RuntimeHealth:
    camera: str = "UNKNOWN"
    face_model: str = "UNKNOWN"
    gaze_model: str = "UNKNOWN"
    audio: str = "UNKNOWN"
    pipeline: str = "STOPPED"
    detail: dict[str, str] = field(default_factory=dict)
