from __future__ import annotations

import math
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from .domain import FaceObservation, Gaze, Pose


class ModelUnavailable(RuntimeError):
    pass


class MediaPipeFacePerceptor:
    def __init__(self, model_path: Path, max_faces: int = 4, min_confidence: float = 0.6) -> None:
        self.model_path, self.max_faces, self.min_confidence = model_path, max_faces, min_confidence
        self._landmarker: Any = None

    @property
    def available(self) -> bool:
        return self._landmarker is not None

    def load(self) -> None:
        if not self.model_path.is_file():
            raise ModelUnavailable(f"missing face model: {self.model_path.name}")
        try:
            import mediapipe as mp
            options = mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(self.model_path)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                num_faces=self.max_faces,
                min_face_detection_confidence=self.min_confidence,
                min_face_presence_confidence=self.min_confidence,
                min_tracking_confidence=0.5,
            )
            self._landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)
            self._mp = mp
        except Exception as exc:
            raise ModelUnavailable(f"face model failed to load: {exc}") from exc

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
        self._landmarker = None

    def detect(self, image: np.ndarray, timestamp_ms: float) -> list[FaceObservation]:
        if self._landmarker is None:
            raise ModelUnavailable("face model is not loaded")
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = self._landmarker.detect_for_video(
            self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb), int(timestamp_ms)
        )
        observations = []
        for face in result.face_landmarks[: self.max_faces]:
            points = np.asarray([(p.x, p.y, p.z) for p in face], dtype=np.float64)
            if points.shape[0] < 10 or not np.isfinite(points).all():
                continue
            lo, hi = points[:, :2].min(0), points[:, :2].max(0)
            x, y = np.clip(lo, 0, 1)
            right, bottom = np.clip(hi, 0, 1)
            width, height = right - x, bottom - y
            if width <= 0 or height <= 0:
                continue
            # MediaPipe supplies no calibrated per-face score. This conservative
            # landmark-quality proxy never maps missing presence to 100%.
            in_bounds = float(np.mean(
                (points[:, 0] >= -.05) & (points[:, 0] <= 1.05)
                & (points[:, 1] >= -.05) & (points[:, 1] <= 1.05)
            ))
            quality = .55 + .25 * in_bounds + .15 * min(max(min(width, height) * 5, 0), 1)
            presences = [
                float(value) for p in face
                if (value := getattr(p, "presence", None)) is not None and np.isfinite(float(value))
            ]
            if presences:
                quality = min(quality, float(np.median(presences)))
            observations.append(FaceObservation(
                (float(x), float(y), float(width), float(height)),
                float(np.clip(quality, 0, .95)),
                points,
            ))
        return observations


class HeadPoseEstimator:
    LANDMARK_INDICES = (1, 152, 33, 263, 61, 291)
    MODEL_POINTS = np.asarray([
        (0., 0., 0.), (0., -63.6, -12.5), (-43.3, 32.7, -26.),
        (43.3, 32.7, -26.), (-28.9, -28.9, -24.1), (28.9, -28.9, -24.1),
    ])

    def estimate(self, landmarks: np.ndarray, width: int, height: int) -> Pose | None:
        if landmarks.shape[0] <= max(self.LANDMARK_INDICES) or not np.isfinite(landmarks).all():
            return None
        points = np.asarray([(landmarks[i, 0] * width, landmarks[i, 1] * height) for i in self.LANDMARK_INDICES])
        focal = float(width)
        camera = np.asarray([[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1.]])
        success, rotation_vector, _ = cv2.solvePnP(
            self.MODEL_POINTS, points, camera, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return None
        rotation, _ = cv2.Rodrigues(rotation_vector)
        angles, *_ = cv2.RQDecomp3x3(rotation)
        pitch, yaw, roll = map(float, angles)
        return Pose(yaw, pitch, roll) if all(map(math.isfinite, (yaw, pitch, roll))) else None


class OpenVINOGazeEstimator:
    LEFT_EYE = (362, 263, 386, 374)
    RIGHT_EYE = (33, 133, 159, 145)

    def __init__(self, xml_path: Path, bin_path: Path) -> None:
        self.xml_path, self.bin_path, self._compiled = xml_path, bin_path, None

    @property
    def available(self) -> bool:
        return self._compiled is not None

    def load(self) -> None:
        if not self.xml_path.is_file() or not self.bin_path.is_file():
            raise ModelUnavailable("missing OpenVINO gaze model XML/BIN")
        try:
            from openvino import Core
            core = Core()
            model = core.read_model(model=str(self.xml_path), weights=str(self.bin_path))
            self._compiled = core.compile_model(model, "CPU")
            self._output = self._compiled.output(0)
        except Exception as exc:
            raise ModelUnavailable(f"gaze model failed to load: {exc}") from exc

    @staticmethod
    def _crop_eye(image: np.ndarray, landmarks: np.ndarray, indices: tuple[int, ...]) -> np.ndarray | None:
        height, width = image.shape[:2]
        points = landmarks[list(indices), :2] * np.asarray([width, height])
        center, size = (points.min(0) + points.max(0)) / 2, max(float(np.ptp(points[:, 0])) * 2.2, 20)
        x1, y1 = np.floor(center - size / 2).astype(int)
        x2, y2 = np.ceil(center + size / 2).astype(int)
        x1, y1, x2, y2 = max(x1, 0), max(y1, 0), min(x2, width), min(y2, height)
        if x2 - x1 < 10 or y2 - y1 < 10:
            return None
        return np.transpose(cv2.resize(image[y1:y2, x1:x2], (60, 60)), (2, 0, 1))[None].astype(np.float32)

    def estimate(self, image: np.ndarray, landmarks: np.ndarray, pose: Pose) -> Gaze | None:
        if self._compiled is None:
            raise ModelUnavailable("gaze model is not loaded")
        if landmarks.shape[0] <= 386 or not np.isfinite(landmarks).all():
            return None
        left, right = self._crop_eye(image, landmarks, self.LEFT_EYE), self._crop_eye(image, landmarks, self.RIGHT_EYE)
        if left is None or right is None:
            return None
        result = self._compiled({
            "left_eye_image": left, "right_eye_image": right,
            "head_pose_angles": np.asarray([[pose.yaw, pose.pitch, pose.roll]], dtype=np.float32),
        })
        vector = np.asarray(result[self._output]).reshape(-1)
        norm = float(np.linalg.norm(vector[:3])) if vector.size >= 3 else 0
        return self._vector_to_angles(vector[:3] / norm) if norm >= 1e-6 else None

    @staticmethod
    def _vector_to_angles(vector: np.ndarray) -> Gaze:
        x, y, z = map(float, vector)
        forward = -z
        return Gaze(
            math.degrees(math.atan2(x, max(forward, 1e-6))),
            math.degrees(math.atan2(y, math.sqrt(x * x + forward * forward))),
        )


def timed_call(callable_: Any, *args: Any, **kwargs: Any) -> tuple[Any, float]:
    started = time.monotonic_ns()
    return callable_(*args, **kwargs), (time.monotonic_ns() - started) / 1_000_000
