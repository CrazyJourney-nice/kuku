from __future__ import annotations

import hashlib
import json
import threading
import time
from threading import Condition, Event, Lock, RLock, Thread
from typing import Any

import cv2
import msgpack

from .config import PROJECT_ROOT, ConfigStore
from .decision import (
    AttentionEvaluator,
    ProximityEvaluator,
    TargetArbitrator,
    VisualTargetArbitrator,
    VoiceJourneyCoordinator,
    VoiceOutputCoordinator,
)
from .domain import (
    AttentionState,
    Frame,
    Mode,
    ProximityDecision,
    ProximityReason,
    ProximityState,
    Reason,
    RuntimeHealth,
    VisualTargetReason,
    VoiceEvent,
)
from .outputs import LocalAfplayVoiceOutput, ScreenEyeAdapter
from .perception import (
    HeadPoseEstimator,
    MediaPipeFacePerceptor,
    ModelUnavailable,
    OpenVINOGazeEstimator,
    timed_call,
)
from .sources import MacCameraSource
from .tracking import AnonymousTracker


class DemoRuntime:
    """Live-only local vision and two-stage voice runtime."""

    def __init__(self, config_store: ConfigStore | None = None) -> None:
        self.config_store = config_store or ConfigStore()
        config = self.config_store.get()
        model_dir = PROJECT_ROOT / "models"
        self.face = MediaPipeFacePerceptor(
            model_dir / "face_landmarker.task",
            int(config["attention"]["max_faces"]),
            float(config["attention"]["face_confidence_min"]),
        )
        self.gaze = OpenVINOGazeEstimator(
            model_dir / "gaze-estimation-adas-0002.xml",
            model_dir / "gaze-estimation-adas-0002.bin",
        )
        self.head = HeadPoseEstimator()
        self.tracker = AnonymousTracker(float(config["attention"]["track_ttl_ms"]))
        self.evaluator = AttentionEvaluator(config)
        self.proximity = ProximityEvaluator(config)
        self.arbitrator = TargetArbitrator(
            float(config["attention"]["winner_margin"]),
            int(config["attention"]["max_faces"]),
            float(config["attention"]["winner_hold_ms"]),
        )
        self.visual_arbitrator = VisualTargetArbitrator()
        self.voice_journey = VoiceJourneyCoordinator(config)
        self.voice_output = VoiceOutputCoordinator(config)
        self.eyes = ScreenEyeAdapter(float(config["attention"]["eye_settle_ms"]))
        self.voice = LocalAfplayVoiceOutput(
            PROJECT_ROOT / str(config["voice"]["path"])
        )
        self._voice_muted = bool(config["voice"]["muted"])
        self.health = RuntimeHealth(
            audio="READY" if self.voice.health() else "UNAVAILABLE"
        )
        self.mode = Mode.LIVE
        self.source: MacCameraSource | None = None
        self._stop = Event()
        self._thread: Thread | None = None
        self._lock = Lock()
        self._response_lock = RLock()
        self._packet_condition = Condition(Lock())
        self._packet: bytes | None = None
        self._packet_version = 0
        self._last_packet_dict: dict[str, Any] | None = None
        self._model_loaded = False
        self._processed_count = 0
        self._processed_started = 0.0
        self._last_frame_received_ms: float | None = None

    @property
    def voice_muted(self) -> bool:
        with self._response_lock:
            return self._voice_muted

    @voice_muted.setter
    def voice_muted(self, muted: bool) -> None:
        with self._response_lock:
            self._voice_muted = bool(muted)
            if self._voice_muted:
                self.voice.stop()

    def _load_models(self) -> None:
        if self._model_loaded:
            return
        try:
            self.health.face_model = "LOADING"
            self.face.load()
            self.health.face_model = "READY"
            self.health.gaze_model = "LOADING"
            self.gaze.load()
            self.health.gaze_model = "READY"
            self._model_loaded = True
        except ModelUnavailable as exc:
            self.health.pipeline = "FAULT"
            self.health.detail["model"] = str(exc)
            self.health.face_model = (
                "READY" if self.face.available else "UNAVAILABLE"
            )
            self.health.gaze_model = (
                "READY" if self.gaze.available else "UNAVAILABLE"
            )
            raise

    def preflight(self) -> dict[str, Any]:
        assets: dict[str, dict[str, Any]] = {}
        manifest_path = PROJECT_ROOT / "assets" / "manifest.json"
        manifest = (
            json.loads(manifest_path.read_text(encoding="utf-8"))
            if manifest_path.exists()
            else {"assets": []}
        )
        for asset in manifest["assets"]:
            path = PROJECT_ROOT / asset["path"]
            actual = (
                hashlib.sha256(path.read_bytes()).hexdigest()
                if path.is_file()
                else None
            )
            assets[asset["id"]] = {
                "present": path.is_file(),
                "sha256": actual,
                "hash_valid": bool(
                    actual
                    and (
                        not asset.get("sha256")
                        or actual == asset["sha256"]
                    )
                ),
            }
        try:
            self._load_models()
        except ModelUnavailable:
            pass
        if self.health.pipeline != "RUNNING":
            camera = self.config_store.get()["camera"]
            probe = MacCameraSource(
                int(camera["index"]),
                int(camera["width"]),
                int(camera["height"]),
                int(camera["fps"]),
            )
            try:
                probe.start()
                frame = probe.read_latest(1)
                self.health.camera = "READY" if frame is not None else "UNAVAILABLE"
                if frame is None:
                    self.health.detail["camera"] = (
                        "camera opened but no frame arrived"
                    )
            except Exception as exc:
                self.health.camera = "UNAVAILABLE"
                self.health.detail["camera"] = str(exc)
            finally:
                probe.stop()
        frontend_ready = (
            PROJECT_ROOT / "frontend" / "dist" / "index.html"
        ).is_file()
        checks = [
            {
                "label": "Local face model",
                "status": (
                    "PASS" if self.health.face_model == "READY" else "FAIL"
                ),
                "detail": self.health.detail.get("model"),
            },
            {
                "label": "Local gaze model",
                "status": (
                    "PASS" if self.health.gaze_model == "READY" else "FAIL"
                ),
                "detail": self.health.detail.get("model"),
            },
            {
                "label": "MacBook camera",
                "status": (
                    "PASS" if self.health.camera == "READY" else "FAIL"
                ),
                "detail": self.health.detail.get("camera"),
            },
            {
                "label": "Local audio",
                "status": "PASS" if self.voice.health() else "FAIL",
                "detail": (
                    None
                    if self.voice.health()
                    else "welcome.wav or afplay unavailable"
                ),
            },
            {
                "label": "Local frontend bundle",
                "status": "PASS" if frontend_ready else "FAIL",
                "detail": (
                    None
                    if frontend_ready
                    else "frontend/dist/index.html missing"
                ),
            },
        ]
        return {
            "local_only": True,
            "bind_host": self.config_store.get()["runtime"]["bind_host"],
            "assets": assets,
            "models": {
                "face": self.health.face_model,
                "gaze": self.health.gaze_model,
            },
            "audio": "READY" if self.voice.health() else "UNAVAILABLE",
            "camera": self.health.camera,
            "voice_muted": self.voice_muted,
            "frontend_ready": frontend_ready,
            "checks": checks,
            "ready": all(item["status"] == "PASS" for item in checks)
            and all(item["hash_valid"] for item in assets.values()),
        }

    def _new_source(self) -> MacCameraSource:
        camera = self.config_store.get()["camera"]
        return MacCameraSource(
            int(camera["index"]),
            int(camera["width"]),
            int(camera["height"]),
            int(camera["fps"]),
        )

    def start(self, mode: Mode | str = Mode.LIVE) -> dict[str, Any]:
        if Mode(mode) != Mode.LIVE:
            raise ValueError("only LIVE mode is supported")
        with self._lock:
            self._load_models()
            source = self._new_source()
            self.stop()
            self._reset_state()
            try:
                info = source.start()
            except Exception as exc:
                self.health.pipeline = "FAULT"
                self.health.camera = "UNAVAILABLE"
                self.health.detail["camera"] = str(exc)
                with self._response_lock:
                    self.eyes.safe_stop()
                    self.voice.stop()
                raise
            self.source = source
            self._stop.clear()
            self._processed_started = time.monotonic()
            self._thread = Thread(target=self._pipeline_loop, daemon=True)
            self._thread.start()
            self.health.pipeline = "RUNNING"
            self.health.camera = "READY"
            return {"started": True, **info}

    def stop(self) -> None:
        self._stop.set()
        if self.source:
            self.source.stop()
        if (
            self._thread
            and self._thread.is_alive()
            and self._thread is not threading.current_thread()
        ):
            self._thread.join(timeout=1.5)
        self.source = None
        self._thread = None
        with self._response_lock:
            self.proximity.reset()
            self.voice_journey.reset()
            self.voice.stop()
            self.eyes.safe_stop()
        if self.health.pipeline != "FAULT":
            self.health.pipeline = "STOPPED"

    def _reset_state(self) -> None:
        self.tracker.reset()
        self.evaluator.reset()
        self.proximity.reset()
        self.arbitrator.reset()
        with self._response_lock:
            self.visual_arbitrator.reset()
            self.voice_journey.reset()
            self.eyes.neutral()
        self._processed_count = 0
        self._last_frame_received_ms = None

    def _pipeline_loop(self) -> None:
        while not self._stop.is_set() and self.source is not None:
            frame = self.source.read_latest(0.2)
            now_ms = time.monotonic_ns() / 1_000_000
            if frame is None:
                if self.source.error or (
                    self._last_frame_received_ms is not None
                    and now_ms - self._last_frame_received_ms > 1000
                ):
                    self._fault(Reason.CAMERA_STALLED)
                    break
                continue
            self._last_frame_received_ms = now_ms
            try:
                self.publish(self.process_frame(frame))
            except ModelUnavailable:
                self._fault(Reason.MODEL_UNAVAILABLE)
                break
            except Exception as exc:
                self.health.detail["pipeline"] = str(exc)
                self._fault(Reason.MODEL_UNAVAILABLE)
                break
        if self.health.pipeline != "FAULT":
            self.health.pipeline = "STOPPED"

    def _fault(self, reason: Reason) -> None:
        self.health.pipeline = "FAULT"
        with self._response_lock:
            self.proximity.reset()
            self.voice_journey.reset()
            self.eyes.safe_stop()
            self.voice.stop()
        self.publish(self._fault_packet(reason))

    @staticmethod
    def _eye_packet(status: Any) -> dict[str, Any]:
        return {
            "command_id": status.command_id,
            "target": {"x": status.target[0], "y": status.target[1]},
            "moving": status.moving,
            "settled": status.settled,
            "started_at_ms": status.started_at_ms,
            "settled_at_ms": status.settled_at_ms,
        }

    def _voice_packet(self, event: VoiceEvent) -> dict[str, Any]:
        return {
            **event.as_dict(),
            "played_at_ms": (
                self.voice.last_played_at_ms
                if event.event_id == self.voice.last_played_event_id
                else None
            ),
        }

    def _fault_packet(self, reason: Reason) -> dict[str, Any]:
        now = time.monotonic_ns() / 1_000_000
        return {
            "frame_id": 0,
            "source_timestamp_ms": now,
            "processed_timestamp_ms": now,
            "mode": Mode.LIVE.value,
            "image_jpeg": b"",
            "tracks": [],
            "selected_target_id": None,
            "visual_target_id": None,
            "visual_target_reason": VisualTargetReason.FAULT.value,
            "attention_state": AttentionState.FAULT.value,
            "proximity": ProximityDecision(
                ProximityState.UNKNOWN,
                None,
                None,
                False,
                None,
                ProximityReason.FAULT,
            ).as_dict(),
            "voice_journey": self.voice_journey.snapshot().as_dict(),
            "mascot_state": self._eye_packet(self.eyes.status),
            "voice_event": self._voice_packet(
                VoiceEvent(status="UNAVAILABLE")
            ),
            "trigger_reason": None,
            "rejection_reason": reason.value,
            "stage_latency_ms": {},
            "fps": {"capture": 0.0, "processed": 0.0},
            "dropped_frames": (
                self.source.queue.dropped if self.source else 0
            ),
            "queue_depth": self.source.queue.depth if self.source else 0,
            "stale_fields": ["image_jpeg", "tracks"],
        }

    def process_frame(self, frame: Frame) -> dict[str, Any]:
        config = self.config_store.get()
        now = time.monotonic_ns() / 1_000_000
        age = now - frame.source_timestamp_ms
        if age > float(config["runtime"]["stale_after_ms"]):
            return self._process_stale_frame(frame, now, age, config)

        latency: dict[str, float] = {}
        observations, latency["face"] = timed_call(
            self.face.detect, frame.image, now
        )
        height, width = frame.image.shape[:2]
        tracks, latency["tracking"] = timed_call(
            self.tracker.update, observations, now, width
        )
        proximity_decision, latency["proximity"] = timed_call(
            self.proximity.evaluate, tracks, now
        )

        started = time.monotonic_ns()
        for track in tracks:
            if not track.stale:
                track.raw_head_pose = self.head.estimate(
                    track.landmarks, width, height
                )
        latency["head_pose"] = (
            time.monotonic_ns() - started
        ) / 1_000_000

        started = time.monotonic_ns()
        for track in sorted(
            tracks, key=lambda item: item.face_width_px, reverse=True
        )[:2]:
            track.gaze = (
                self.gaze.estimate(
                    frame.image, track.landmarks, track.raw_head_pose
                )
                if track.raw_head_pose
                and track.face_width_px
                >= float(config["attention"]["face_width_for_gaze_px"])
                and not track.stale
                else None
            )
        latency["gaze"] = (time.monotonic_ns() - started) / 1_000_000

        started = time.monotonic_ns()
        evidences = [
            self.evaluator.evaluate(track, now) for track in tracks
        ]
        self.evaluator.prune({track.track_id for track in tracks})
        decision = self.arbitrator.select(tracks, evidences, now)
        before_response = time.monotonic_ns() / 1_000_000
        age = before_response - frame.source_timestamp_ms
        if age > float(config["runtime"]["stale_after_ms"]):
            return self._process_stale_frame(
                frame, before_response, age, config
            )

        with self._response_lock:
            journey_trigger = self.voice_journey.on_proximity(
                proximity_decision
            )
            if journey_trigger is None:
                journey_trigger = self.voice_journey.on_attention(
                    decision, proximity_decision, now
                )
            visual_decision = self.visual_arbitrator.select(tracks, now)
            if visual_decision.selected_track_id is not None:
                eye = self.eyes.look_at(
                    visual_decision.target,
                    f"visual-track-{visual_decision.selected_track_id}",
                    now,
                )
            else:
                self.eyes.neutral()
                eye = self.eyes.status

            voice_event = VoiceEvent()
            suppression: Reason | None = None
            if journey_trigger is not None:
                play, suppression, voice_event = self.voice_output.decide(
                    journey_trigger,
                    self._voice_muted,
                    self.voice.health(),
                )
                if play:
                    voice_event = self.voice.play_once(voice_event)
            journey_snapshot = self.voice_journey.snapshot(
                journey_trigger
            ).as_dict()

        latency["decision"] = (
            time.monotonic_ns() - started
        ) / 1_000_000
        encoded_started = time.monotonic_ns()
        ok, encoded = cv2.imencode(
            ".jpg",
            frame.image,
            [
                cv2.IMWRITE_JPEG_QUALITY,
                int(config["runtime"]["jpeg_quality"]),
            ],
        )
        if not ok:
            raise RuntimeError("local JPEG encoding failed")
        latency["jpeg"] = (
            time.monotonic_ns() - encoded_started
        ) / 1_000_000
        processed = time.monotonic_ns() / 1_000_000
        self._processed_count += 1
        rejection = suppression or (
            None
            if decision.reason == Reason.ATTENTION_CONFIRMED
            else decision.reason
        )
        return {
            "frame_id": frame.frame_id,
            "source_timestamp_ms": frame.source_timestamp_ms,
            "processed_timestamp_ms": processed,
            "mode": Mode.LIVE.value,
            "image_jpeg": encoded.tobytes(),
            "tracks": [self._track_packet(track) for track in tracks],
            "selected_target_id": decision.selected_track_id,
            "visual_target_id": visual_decision.selected_track_id,
            "visual_target_reason": visual_decision.reason.value,
            "attention_state": decision.state.value,
            "proximity": proximity_decision.as_dict(),
            "voice_journey": journey_snapshot,
            "mascot_state": self._eye_packet(eye),
            "voice_event": self._voice_packet(voice_event),
            "trigger_reason": (
                journey_trigger.stage.value if journey_trigger else None
            ),
            "rejection_reason": (
                rejection.value if rejection else None
            ),
            "stage_latency_ms": {
                **latency,
                "frame_age": max(
                    processed - frame.source_timestamp_ms, 0
                ),
            },
            "fps": {
                "capture": (
                    self.source.capture_fps if self.source else 0.0
                ),
                "processed": self._processed_count
                / max(time.monotonic() - self._processed_started, 1e-6),
            },
            "dropped_frames": (
                self.source.queue.dropped if self.source else 0
            ),
            "queue_depth": self.source.queue.depth if self.source else 0,
            "stale_fields": [],
        }

    def _process_stale_frame(
        self,
        frame: Frame,
        processed: float,
        age: float,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        self.evaluator.reset()
        self.proximity.reset()
        self.arbitrator.reset()
        with self._response_lock:
            self.visual_arbitrator.reset()
            self.voice_journey.reset()
            self.voice.stop()
            self.eyes.safe_stop()
            eye = self.eyes.status
        started = time.monotonic_ns()
        ok, encoded = cv2.imencode(
            ".jpg",
            frame.image,
            [
                cv2.IMWRITE_JPEG_QUALITY,
                int(config["runtime"]["jpeg_quality"]),
            ],
        )
        return {
            "frame_id": frame.frame_id,
            "source_timestamp_ms": frame.source_timestamp_ms,
            "processed_timestamp_ms": processed,
            "mode": Mode.LIVE.value,
            "image_jpeg": encoded.tobytes() if ok else b"",
            "tracks": [],
            "selected_target_id": None,
            "visual_target_id": None,
            "visual_target_reason": VisualTargetReason.STALE_RESULT.value,
            "attention_state": AttentionState.LOST.value,
            "proximity": ProximityDecision(
                ProximityState.UNKNOWN,
                None,
                None,
                False,
                None,
                ProximityReason.STALE_RESULT,
            ).as_dict(),
            "voice_journey": self.voice_journey.snapshot().as_dict(),
            "mascot_state": self._eye_packet(eye),
            "voice_event": self._voice_packet(
                VoiceEvent(status="SUPPRESSED")
            ),
            "trigger_reason": None,
            "rejection_reason": Reason.STALE_RESULT.value,
            "stage_latency_ms": {
                "frame_age": max(age, 0),
                "jpeg": (
                    time.monotonic_ns() - started
                ) / 1_000_000,
            },
            "fps": {
                "capture": (
                    self.source.capture_fps if self.source else 0.0
                ),
                "processed": 0.0,
            },
            "dropped_frames": (
                self.source.queue.dropped if self.source else 0
            ),
            "queue_depth": self.source.queue.depth if self.source else 0,
            "stale_fields": ["tracks"],
        }

    @staticmethod
    def _track_packet(track: Any) -> dict[str, Any]:
        return {
            "track_id": track.track_id,
            "bbox": list(track.bbox),
            "face_confidence": track.face_confidence,
            "face_width_px": track.face_width_px,
            "raw_head_pose": (
                track.raw_head_pose.as_dict()
                if track.raw_head_pose
                else None
            ),
            "filtered_head_pose": (
                track.filtered_head_pose.as_dict()
                if track.filtered_head_pose
                else None
            ),
            "gaze": track.gaze.as_dict() if track.gaze else None,
            "motion": track.motion,
            "dwell_ms": track.dwell_ms,
            "attention_score": track.attention_score,
            "state": track.state.value,
            "reason": track.reason.value,
            "selected": track.selected,
            "stale": track.stale,
        }

    def publish(self, packet: dict[str, Any]) -> None:
        packed = msgpack.packb(packet, use_bin_type=True)
        with self._packet_condition:
            self._packet = packed
            self._last_packet_dict = packet
            self._packet_version += 1
            self._packet_condition.notify_all()

    def wait_packet(
        self, version: int, timeout: float = 1
    ) -> tuple[int, bytes | None]:
        with self._packet_condition:
            if version == self._packet_version:
                self._packet_condition.wait(timeout)
            return self._packet_version, self._packet

    @property
    def last_packet(self) -> dict[str, Any] | None:
        with self._packet_condition:
            return self._last_packet_dict

    def eye_settled(self, command_id: str) -> bool:
        with self._response_lock:
            if self.eyes.status.command_id != command_id:
                return False
            self.eyes.status.moving = False
            self.eyes.status.settled = True
            self.eyes.status.settled_at_ms = (
                time.monotonic_ns() / 1_000_000
            )
            return True
