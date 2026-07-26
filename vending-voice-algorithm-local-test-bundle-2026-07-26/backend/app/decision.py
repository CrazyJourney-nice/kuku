from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from typing import Any

from .domain import (
    AttentionEvidence, AttentionState, Gaze, Pose, ProximityDecision,
    ProximityReason, ProximityState, Reason, TargetDecision, Track,
    VisualTargetDecision, VisualTargetReason, VoiceEvent,
    VoiceJourneySnapshot, VoiceJourneyState, VoiceStage, VoiceStageTrigger,
)
from .filters import OneEuroFilter


@dataclass(slots=True)
class _TrackState:
    candidate_since_ms: float | None = None
    last_candidate_ms: float | None = None
    filters: dict[str, OneEuroFilter] = field(default_factory=dict)


class AttentionEvaluator:
    def __init__(self, config: dict[str, Any]) -> None:
        self._state: dict[int, _TrackState] = {}
        self.update_config(config)

    def update_config(self, config: dict[str, Any]) -> None:
        self.attention = config["attention"]
        total = sum(map(float, config["scoring"].values()))
        self.weights = {key: float(value) / total for key, value in config["scoring"].items()}

    def reset(self) -> None:
        self._state.clear()

    def _get(self, track_id: int) -> _TrackState:
        state = self._state.setdefault(track_id, _TrackState())
        for key in ("yaw", "pitch", "roll", "gaze_x", "gaze_y"):
            state.filters.setdefault(key, OneEuroFilter())
        return state

    @staticmethod
    def angular_error(x: float, y: float, offset_x: float = 0, offset_y: float = 0) -> float:
        return math.hypot(x - offset_x, y - offset_y)

    @staticmethod
    def ray_hits_roi(yaw: float, pitch: float, half_width: float, half_height: float) -> bool:
        return abs(yaw) <= half_width and abs(pitch) <= half_height

    def evaluate(self, track: Track, timestamp_ms: float) -> AttentionEvidence:
        state = self._get(track.track_id)
        if track.stale:
            return self._grace(track, state, timestamp_ms, Reason.STALE_RESULT, "loss_grace_ms") or self._reject(track, state, Reason.STALE_RESULT)
        if track.face_confidence < float(self.attention["face_confidence_min"]):
            return self._grace(track, state, timestamp_ms, Reason.LOW_FACE_CONFIDENCE, "loss_grace_ms") or self._reject(track, state, Reason.LOW_FACE_CONFIDENCE)
        if track.raw_head_pose is None:
            return self._grace(track, state, timestamp_ms, Reason.HEAD_OUTSIDE_ROI, "loss_grace_ms") or self._reject(track, state, Reason.HEAD_OUTSIDE_ROI)
        raw = track.raw_head_pose
        track.filtered_head_pose = Pose(
            state.filters["yaw"](raw.yaw, timestamp_ms),
            state.filters["pitch"](raw.pitch, timestamp_ms),
            state.filters["roll"](raw.roll, timestamp_ms),
        )
        head_error = self.angular_error(
            track.filtered_head_pose.yaw, track.filtered_head_pose.pitch,
        )
        head_limit = float(self.attention["head_candidate_error_deg"])
        head_in_roi = head_error <= head_limit
        if not head_in_roi:
            return self._grace(track, state, timestamp_ms, Reason.HEAD_OUTSIDE_ROI, "exit_hold_ms") or self._reject(track, state, Reason.HEAD_OUTSIDE_ROI)
        gaze_ok = track.gaze is not None and track.face_width_px >= float(self.attention["face_width_for_gaze_px"])
        gaze_error = None
        if gaze_ok:
            assert track.gaze is not None
            track.gaze = Gaze(
                state.filters["gaze_x"](track.gaze.x, timestamp_ms),
                state.filters["gaze_y"](track.gaze.y, timestamp_ms),
            )
            gaze_error = self.angular_error(track.gaze.x, track.gaze.y)
            if gaze_error > float(self.attention["gaze_confirmation_error_deg"]):
                return self._grace(track, state, timestamp_ms, Reason.GAZE_OUTSIDE_ROI, "exit_hold_ms") or self._reject(track, state, Reason.GAZE_OUTSIDE_ROI)
        if track.motion > float(self.attention["fast_lateral_motion_norm_s"]):
            return self._reject(track, state, Reason.PASSERBY_TOO_FAST)
        state.candidate_since_ms = timestamp_ms if state.candidate_since_ms is None else state.candidate_since_ms
        state.last_candidate_ms = timestamp_ms
        dwell = max(0, timestamp_ms - state.candidate_since_ms)
        required = float(self.attention["valid_dwell_ms"] if gaze_ok else self.attention["head_only_dwell_ms"])
        qualified = dwell >= required
        error = gaze_error if gaze_error is not None else head_error
        limit = float(
            self.attention[
                "gaze_confirmation_error_deg"
                if gaze_error is not None
                else "head_candidate_error_deg"
            ]
        )
        direction = max(0, 1 - error / max(limit, 1e-6))
        stability = max(0, 1 - track.motion / max(float(self.attention["fast_lateral_motion_norm_s"]), 1e-6))
        cx, cy = track.center
        centrality = max(0, 1 - 2 * math.hypot(cx - .5, cy - .5))
        track.dwell_ms = dwell
        track.attention_score = min(max(
            self.weights["direction"] * direction
            + self.weights["dwell"] * min(dwell / required, 1)
            + self.weights["face_quality"] * track.face_confidence
            + self.weights["stability"] * stability
            + self.weights["centrality"] * centrality, 0), 1)
        track.state = AttentionState.ATTENDING if qualified else AttentionState.QUALIFYING
        track.reason = Reason.ATTENTION_CONFIRMED if qualified else (
            Reason.FACE_TOO_SMALL if not gaze_ok and track.face_width_px < float(self.attention["face_width_for_gaze_px"])
            else Reason.DWELL_PENDING
        )
        return AttentionEvidence(track.track_id, qualified, track.attention_score, dwell, track.reason, track.center)

    @staticmethod
    def _reject(track: Track, state: _TrackState, reason: Reason) -> AttentionEvidence:
        state.candidate_since_ms = state.last_candidate_ms = None
        track.dwell_ms = track.attention_score = 0
        track.state, track.reason = AttentionState.TRACKING, reason
        return AttentionEvidence(track.track_id, False, 0, 0, reason, track.center)

    def _grace(self, track: Track, state: _TrackState, timestamp_ms: float, reason: Reason, key: str) -> AttentionEvidence | None:
        if state.last_candidate_ms is None or timestamp_ms - state.last_candidate_ms > float(self.attention[key]):
            return None
        track.reason = reason
        return AttentionEvidence(
            track.track_id, track.state == AttentionState.ATTENDING,
            track.attention_score, track.dwell_ms, reason, track.center,
        )

    def prune(self, ids: set[int]) -> None:
        for track_id in set(self._state) - ids:
            self._state.pop(track_id, None)


class ProximityEvaluator:
    """Scene-level proximity band using calibrated monocular face scale.

    The signal is a normalized screen-space proxy. It deliberately does not
    claim metric depth. A scene episode stays active while any eligible face
    occupies the near zone, so anonymous track-ID changes cannot replay voice.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self._smoothed: dict[int, float] = {}
        self.state = ProximityState.UNKNOWN
        self._candidate_since_ms: float | None = None
        self._leaving_since_ms: float | None = None
        self._episode_id: str | None = None
        self.update_config(config)

    def update_config(self, config: dict[str, Any]) -> None:
        self.proximity = config["proximity"]

    def reset(self) -> None:
        self._smoothed.clear()
        self.state = ProximityState.UNKNOWN
        self._candidate_since_ms = None
        self._leaving_since_ms = None
        self._episode_id = None

    def _eligible(
        self, track: Track
    ) -> tuple[bool, ProximityReason | None]:
        if track.stale:
            return False, ProximityReason.STALE_RESULT
        if track.face_confidence < float(
            self.proximity["face_confidence_min"]
        ):
            return False, ProximityReason.LOW_FACE_CONFIDENCE
        x, y, width, height = track.bbox
        margin = float(self.proximity["edge_margin_ratio"])
        if (
            x <= margin
            or y <= margin
            or x + width >= 1 - margin
            or y + height >= 1 - margin
        ):
            return False, ProximityReason.FACE_EDGE_CROPPED
        roi_x, roi_y, roi_width, roi_height = map(
            float, self.proximity["interaction_roi"]
        )
        center_x, center_y = track.center
        if not (
            roi_x <= center_x <= roi_x + roi_width
            and roi_y <= center_y <= roi_y + roi_height
        ):
            return False, ProximityReason.OUTSIDE_INTERACTION_ZONE
        return True, None

    def _signal(self, track: Track) -> float:
        observed = max(0.0, min(float(track.bbox[2]), 1.0))
        previous = self._smoothed.get(track.track_id)
        alpha = float(self.proximity["smoothing_alpha"])
        filtered = (
            observed
            if previous is None
            else alpha * observed + (1 - alpha) * previous
        )
        self._smoothed[track.track_id] = filtered
        return filtered

    def evaluate(
        self, tracks: list[Track], timestamp_ms: float
    ) -> ProximityDecision:
        live_ids = {track.track_id for track in tracks}
        for track_id in set(self._smoothed) - live_ids:
            self._smoothed.pop(track_id, None)

        eligible: list[tuple[float, Track]] = []
        rejection = ProximityReason.NO_FACE
        for track in tracks:
            accepted, reason = self._eligible(track)
            if accepted:
                eligible.append((self._signal(track), track))
            elif rejection == ProximityReason.NO_FACE and reason is not None:
                rejection = reason

        if eligible:
            signal, selected = max(
                eligible, key=lambda item: (item[0], -item[1].track_id)
            )
            track_id = selected.track_id
        else:
            signal, track_id = None, None

        enter = float(self.proximity["enter_face_width_ratio"])
        exit_ = float(self.proximity["exit_face_width_ratio"])
        entered = False

        if self.state in {ProximityState.UNKNOWN, ProximityState.FAR}:
            if signal is not None and signal >= enter:
                self.state = ProximityState.APPROACHING
                self._candidate_since_ms = timestamp_ms
                reason = ProximityReason.ENTER_DWELL_PENDING
            elif signal is not None:
                self.state = ProximityState.FAR
                self._candidate_since_ms = None
                reason = ProximityReason.BELOW_ENTER_THRESHOLD
            else:
                reason = rejection
        elif self.state == ProximityState.APPROACHING:
            if signal is None or signal < enter:
                self.state = (
                    ProximityState.FAR
                    if signal is not None
                    else ProximityState.UNKNOWN
                )
                self._candidate_since_ms = None
                reason = (
                    ProximityReason.BELOW_ENTER_THRESHOLD
                    if signal is not None
                    else rejection
                )
            elif (
                self._candidate_since_ms is not None
                and timestamp_ms - self._candidate_since_ms
                >= float(self.proximity["enter_dwell_ms"])
            ):
                self.state = ProximityState.NEAR
                self._episode_id = str(uuid.uuid4())
                self._candidate_since_ms = None
                entered = True
                reason = ProximityReason.NEAR_ENTERED
            else:
                reason = ProximityReason.ENTER_DWELL_PENDING
        elif self.state == ProximityState.NEAR:
            if signal is not None and signal > exit_:
                self._leaving_since_ms = None
                reason = ProximityReason.NEAR_HELD
            else:
                self.state = ProximityState.LEAVING
                self._leaving_since_ms = timestamp_ms
                reason = ProximityReason.EXIT_DWELL_PENDING
        else:
            if signal is not None and signal > exit_:
                self.state = ProximityState.NEAR
                self._leaving_since_ms = None
                reason = ProximityReason.NEAR_HELD
            elif (
                self._leaving_since_ms is not None
                and timestamp_ms - self._leaving_since_ms
                >= float(self.proximity["exit_dwell_ms"])
            ):
                self.state = ProximityState.FAR
                self._leaving_since_ms = None
                self._episode_id = None
                reason = ProximityReason.ZONE_CLEARED
            else:
                reason = ProximityReason.EXIT_DWELL_PENDING

        return ProximityDecision(
            self.state,
            track_id,
            signal,
            entered,
            self._episode_id,
            reason,
        )


class TargetArbitrator:
    def __init__(self, winner_margin: float = .15, max_faces: int = 4, winner_hold_ms: float = 500) -> None:
        self.winner_margin, self.max_faces, self.winner_hold_ms = winner_margin, max_faces, winner_hold_ms
        self.current_target: int | None = None
        self._challenger: int | None = None
        self._challenger_since: float | None = None

    def reset(self) -> None:
        self.current_target = self._challenger = None
        self._challenger_since = None

    def select(self, tracks: list[Track], evidences: list[AttentionEvidence], timestamp_ms: float = 0) -> TargetDecision:
        for track in tracks:
            track.selected = False
        if len(tracks) > self.max_faces:
            self.reset()
            return TargetDecision(AttentionState.CROWD_SAFE, None, (.5, .5), Reason.CROWD_SAFE)
        qualified = sorted((e for e in evidences if e.qualified), key=lambda e: e.attention_score, reverse=True)
        if not qualified:
            self.reset()
            return TargetDecision(
                AttentionState.QUALIFYING if tracks else AttentionState.NO_TARGET,
                None, (.5, .5), evidences[0].reason if evidences else Reason.NO_FACE,
            )
        close_scores = (
            len(qualified) >= 2
            and qualified[0].attention_score - qualified[1].attention_score < self.winner_margin
        )
        if close_scores and self.current_target is not None:
            current = next((e for e in qualified if e.track_id == self.current_target), None)
            if current is not None:
                for track in tracks:
                    track.selected = track.track_id == current.track_id
                return TargetDecision(
                    AttentionState.ATTENDING,
                    current.track_id,
                    current.target,
                    Reason.TARGET_AMBIGUOUS,
                    (current.track_id,),
                )
        if close_scores:
            first, second = qualified[:2]
            self.reset()
            return TargetDecision(
                AttentionState.GROUP_ATTENTION, None,
                ((first.target[0] + second.target[0]) / 2, (first.target[1] + second.target[1]) / 2),
                Reason.GROUP_ATTENTION, (first.track_id, second.track_id),
            )
        winner = qualified[0]
        current = next((e for e in qualified if e.track_id == self.current_target), None)
        if current is not None and winner.track_id != current.track_id:
            if winner.attention_score - current.attention_score < self.winner_margin:
                winner = current
            else:
                if self._challenger != winner.track_id:
                    self._challenger, self._challenger_since = winner.track_id, timestamp_ms
                    winner = current
                elif timestamp_ms - float(self._challenger_since) < self.winner_hold_ms:
                    winner = current
        if self.current_target != winner.track_id:
            self._challenger = self._challenger_since = None
        self.current_target = winner.track_id
        for track in tracks:
            track.selected = track.track_id == winner.track_id
        return TargetDecision(AttentionState.ATTENDING, winner.track_id, winner.target, Reason.ATTENTION_CONFIRMED, (winner.track_id,))


class VisualTargetArbitrator:
    """Permanent, face-center mascot gaze policy.

    These values are intentionally fixed demo-policy values rather than operator
    configuration. They can be edited here after the capability demo has
    produced enough evidence for tuning.
    """

    ACQUIRE_STABLE_MS = 250.0
    LOSS_GRACE_MS = 500.0
    CHALLENGER_HOLD_MS = 500.0
    MAX_FACES = 4
    ENTRY_COHORT_MS = 100.0

    def __init__(self) -> None:
        self.current_target: int | None = None
        self._last_target = (.5, .5)
        self._last_seen_ms: float | None = None
        self._challenger: int | None = None
        self._challenger_since_ms: float | None = None

    def reset(self) -> None:
        self.current_target = None
        self._last_target = (.5, .5)
        self._last_seen_ms = None
        self._clear_challenger()

    def _clear_challenger(self) -> None:
        self._challenger = None
        self._challenger_since_ms = None

    @staticmethod
    def _track(
        tracks: list[Track], track_id: int | None, *, live_only: bool = False
    ) -> Track | None:
        if track_id is None:
            return None
        return next(
            (
                track
                for track in tracks
                if track.track_id == track_id and (not live_only or not track.stale)
            ),
            None,
        )

    @classmethod
    def _stable_candidates(
        cls, tracks: list[Track], timestamp_ms: float
    ) -> list[Track]:
        candidates = [
            track
            for track in tracks
            if not track.stale
            and timestamp_ms - track.created_ms >= cls.ACQUIRE_STABLE_MS
        ]
        if not candidates:
            return []
        earliest = min(track.created_ms for track in candidates)

        def tie_break(track: Track) -> tuple[float, ...]:
            cx, cy = track.center
            centrality_error = math.hypot(cx - .5, cy - .5)
            if track.created_ms - earliest <= cls.ENTRY_COHORT_MS:
                # Near-simultaneous entrants are ordered by visual salience,
                # then the anonymous track ID only as the final deterministic
                # tie-break.
                return (
                    0,
                    -track.face_width_px,
                    centrality_error,
                    track.motion,
                    track.track_id,
                )
            return (
                1,
                track.created_ms,
                -track.face_width_px,
                centrality_error,
                track.motion,
                track.track_id,
            )

        return sorted(
            candidates,
            key=tie_break,
        )

    def _lock(
        self, track: Track, timestamp_ms: float, reason: VisualTargetReason
    ) -> VisualTargetDecision:
        self.current_target = track.track_id
        self._last_target = track.center
        self._last_seen_ms = timestamp_ms
        self._clear_challenger()
        return VisualTargetDecision(track.track_id, track.center, reason)

    def _hold_current(
        self, track: Track, timestamp_ms: float, reason: VisualTargetReason
    ) -> VisualTargetDecision:
        self._last_target = track.center
        self._last_seen_ms = timestamp_ms
        return VisualTargetDecision(track.track_id, track.center, reason)

    def _hold_lost(self, reason: VisualTargetReason) -> VisualTargetDecision:
        return VisualTargetDecision(self.current_target, self._last_target, reason)

    def _start_or_hold_challenger(
        self, challenger: Track, timestamp_ms: float
    ) -> bool:
        if self._challenger != challenger.track_id:
            self._challenger = challenger.track_id
            self._challenger_since_ms = timestamp_ms
            return False
        return (
            self._challenger_since_ms is not None
            and timestamp_ms - self._challenger_since_ms
            >= self.CHALLENGER_HOLD_MS
        )

    def select(
        self,
        tracks: list[Track],
        timestamp_ms: float,
    ) -> VisualTargetDecision:
        """Select the face center that permanently drives the mascot eyes.

        Attention and gaze qualification are deliberately absent
        from first-entrant acquisition. Once acquired, the first stable face
        remains the visual target until it is lost; attention qualification
        cannot redirect the mascot eyes to a later entrant.
        """
        live_current = self._track(tracks, self.current_target, live_only=True)
        stable = self._stable_candidates(tracks, timestamp_ms)

        # Crowd-safe means no new visual acquisition. Keeping an existing lock
        # is stable and does not allow a fifth face to steal the mascot.
        if len(tracks) > self.MAX_FACES:
            if live_current is not None:
                return self._hold_current(
                    live_current, timestamp_ms, VisualTargetReason.CROWD_SAFE
                )
            if (
                self.current_target is not None
                and self._last_seen_ms is not None
                and timestamp_ms - self._last_seen_ms <= self.LOSS_GRACE_MS
            ):
                return self._hold_lost(VisualTargetReason.CROWD_SAFE)
            self.reset()
            return VisualTargetDecision(
                None, (.5, .5), VisualTargetReason.CROWD_SAFE
            )

        if live_current is not None:
            self._clear_challenger()
            return self._hold_current(
                live_current, timestamp_ms, VisualTargetReason.CURRENT_TARGET_LOCK
            )

        # Current target is temporarily absent: retain its last known direction
        # for 500ms while a stable replacement proves it is not a transient
        # detection. Both timers must pass before handoff.
        if self.current_target is not None and self._last_seen_ms is not None:
            replacement = next(
                (
                    candidate
                    for candidate in stable
                    if candidate.track_id != self.current_target
                ),
                None,
            )
            challenger_ready = (
                replacement is not None
                and self._start_or_hold_challenger(replacement, timestamp_ms)
            )
            loss_expired = (
                timestamp_ms - self._last_seen_ms > self.LOSS_GRACE_MS
            )
            if not loss_expired:
                return self._hold_lost(VisualTargetReason.TARGET_LOSS_GRACE)
            if replacement is not None and challenger_ready:
                return self._lock(
                    replacement,
                    timestamp_ms,
                    VisualTargetReason.FIRST_STABLE_ENTRANT,
                )
            if replacement is not None:
                return VisualTargetDecision(
                    None, (.5, .5), VisualTargetReason.HANDOFF_PENDING
                )
            self.reset()
            return VisualTargetDecision(
                None, (.5, .5), VisualTargetReason.NO_FACE
            )

        if stable:
            return self._lock(
                stable[0],
                timestamp_ms,
                VisualTargetReason.FIRST_STABLE_ENTRANT,
            )
        self._clear_challenger()
        return VisualTargetDecision(
            None,
            (.5, .5),
            VisualTargetReason.STABILIZING_FIRST_ENTRANT
            if any(not track.stale for track in tracks)
            else VisualTargetReason.NO_FACE,
        )


class VoiceJourneyCoordinator:
    """Interaction-level orchestration for the two core voice stages."""

    _STAGE_ORDER = (
        VoiceStage.PROXIMITY_GREETING,
        VoiceStage.ATTENTION_FOLLOW_UP,
    )

    def __init__(self, config: dict[str, Any]) -> None:
        self.interaction_id: str | None = None
        self.state = VoiceJourneyState.IDLE
        self.completed_stages: set[VoiceStage] = set()
        self.attention_since_ms: float | None = None
        self.attention_dwell_ms = 0.0
        self.update_config(config)

    def update_config(self, config: dict[str, Any]) -> None:
        self.followup_dwell_ms = float(
            config["voice_journey"]["followup_dwell_ms"]
        )

    def reset(self) -> None:
        self.interaction_id = None
        self.state = VoiceJourneyState.IDLE
        self.completed_stages.clear()
        self.attention_since_ms = None
        self.attention_dwell_ms = 0.0

    def _trigger(self, stage: VoiceStage) -> VoiceStageTrigger:
        if self.interaction_id is None:
            self.interaction_id = str(uuid.uuid4())
        self.completed_stages.add(stage)
        return VoiceStageTrigger(
            str(uuid.uuid4()), self.interaction_id, stage
        )

    def on_proximity(
        self, decision: ProximityDecision
    ) -> VoiceStageTrigger | None:
        if decision.entered and decision.episode_id is not None:
            self.reset()
            self.interaction_id = decision.episode_id
            self.state = VoiceJourneyState.GREETED
            return self._trigger(VoiceStage.PROXIMITY_GREETING)
        if (
            decision.episode_id is None
            and self.state
            in {VoiceJourneyState.GREETED, VoiceJourneyState.FOLLOWED_UP}
        ):
            self.reset()
        return None

    def on_attention(
        self,
        decision: TargetDecision,
        proximity: ProximityDecision,
        timestamp_ms: float,
    ) -> VoiceStageTrigger | None:
        eligible = (
            self.state == VoiceJourneyState.GREETED
            and self.interaction_id is not None
            and proximity.state == ProximityState.NEAR
            and proximity.episode_id == self.interaction_id
            and proximity.track_id is not None
            and decision.state == AttentionState.ATTENDING
            and decision.selected_track_id == proximity.track_id
        )
        if not eligible:
            self.attention_since_ms = None
            self.attention_dwell_ms = 0.0
            return None
        if self.attention_since_ms is None:
            self.attention_since_ms = timestamp_ms
        self.attention_dwell_ms = max(
            timestamp_ms - self.attention_since_ms, 0.0
        )
        if self.attention_dwell_ms < self.followup_dwell_ms:
            return None
        self.state = VoiceJourneyState.FOLLOWED_UP
        self.attention_since_ms = None
        self.attention_dwell_ms = self.followup_dwell_ms
        return self._trigger(VoiceStage.ATTENTION_FOLLOW_UP)

    def snapshot(
        self, trigger: VoiceStageTrigger | None = None
    ) -> VoiceJourneySnapshot:
        return VoiceJourneySnapshot(
            self.interaction_id,
            self.state,
            trigger.stage if trigger else None,
            tuple(
                stage
                for stage in self._STAGE_ORDER
                if stage in self.completed_stages
            ),
            self.attention_dwell_ms,
        )


class VoiceOutputCoordinator:
    """Maps a one-shot journey stage to local audio playback."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.update_config(config)

    def update_config(self, config: dict[str, Any]) -> None:
        self.voice = config["voice"]

    def decide(
        self,
        trigger: VoiceStageTrigger,
        muted: bool,
        available: bool,
    ) -> tuple[bool, Reason | None, VoiceEvent]:
        clip_keys = {
            VoiceStage.PROXIMITY_GREETING: "proximity_clip_id",
            VoiceStage.ATTENTION_FOLLOW_UP: "followup_clip_id",
        }
        clip = str(self.voice[clip_keys[trigger.stage]])
        event = VoiceEvent(
            trigger.event_id,
            "SUPPRESSED",
            clip,
            trigger.interaction_id,
        )
        if muted:
            event.status = "MUTED"
            return False, Reason.VOICE_MUTED, event
        if not available:
            event.status = "UNAVAILABLE"
            return False, Reason.AUDIO_UNAVAILABLE, event
        event.status = "PENDING"
        return True, None, event
