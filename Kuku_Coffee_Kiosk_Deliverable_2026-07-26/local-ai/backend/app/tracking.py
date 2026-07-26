from __future__ import annotations

import math

import numpy as np
from scipy.optimize import linear_sum_assignment

from .domain import FaceObservation, Track


def bbox_iou(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    area = max(0., min(ax + aw, bx + bw) - max(ax, bx)) * max(0., min(ay + ah, by + bh) - max(ay, by))
    union = aw * ah + bw * bh - area
    return area / union if union else 0.


def assignment_cost(
    track: Track,
    obs: FaceObservation,
    predicted_center: tuple[float, float] | None = None,
) -> float:
    tx, ty = predicted_center or track.center
    ox, oy, ow, oh = obs.bbox
    distance = min(math.hypot(tx - ox - ow / 2, ty - oy - oh / 2) / math.sqrt(2), 1)
    scale = min(abs(track.bbox[2] - ow) / max(track.bbox[2], ow, 1e-6), 1)
    return .55 * (1 - bbox_iou(track.bbox, obs.bbox)) + .30 * distance + .15 * scale


class AnonymousTracker:
    def __init__(self, ttl_ms: float = 600, max_cost: float = .72) -> None:
        self.ttl_ms, self.max_cost, self._next = ttl_ms, max_cost, 1
        self._tracks: dict[int, Track] = {}
        self._motion: dict[int, tuple[float, float, float]] = {}
        self._kalman: dict[int, tuple[np.ndarray, np.ndarray, float]] = {}

    def reset(self) -> None:
        self._next = 1
        self._tracks.clear()
        self._motion.clear()
        self._kalman.clear()

    def update(self, observations: list[FaceObservation], timestamp_ms: float, width: int) -> list[Track]:
        existing, assigned_tracks, assigned_obs = list(self._tracks.values()), set(), set()
        predicted = {
            track.track_id: self._predict(track.track_id, timestamp_ms)
            for track in existing
        }
        if existing and observations:
            costs = np.asarray(
                [
                    [
                        assignment_cost(t, o, predicted.get(t.track_id))
                        for o in observations
                    ]
                    for t in existing
                ]
            )
            for ti, oi in zip(*linear_sum_assignment(costs)):
                track = existing[int(ti)]
                if costs[ti, oi] > self.max_cost:
                    continue
                self._apply(track, observations[int(oi)], timestamp_ms, width)
                assigned_tracks.add(track.track_id)
                assigned_obs.add(int(oi))
        for index, obs in enumerate(observations):
            if index in assigned_obs:
                continue
            track = Track(self._next, obs.bbox, obs.confidence, obs.bbox[2] * width, obs.landmarks, timestamp_ms, timestamp_ms)
            self._tracks[self._next] = track
            self._motion[self._next] = (track.center[0], timestamp_ms, 0.)
            self._kalman[self._next] = (
                np.asarray([track.center[0], track.center[1], 0.0, 0.0]),
                np.eye(4, dtype=float) * 0.05,
                timestamp_ms,
            )
            self._next += 1
        for track_id in [i for i, t in self._tracks.items() if timestamp_ms - t.last_seen_ms > self.ttl_ms]:
            self._tracks.pop(track_id)
            self._motion.pop(track_id)
            self._kalman.pop(track_id, None)
        for track in self._tracks.values():
            track.stale = track.last_seen_ms != timestamp_ms
        return sorted(self._tracks.values(), key=lambda t: t.track_id)

    def _apply(self, track: Track, obs: FaceObservation, timestamp_ms: float, width: int) -> None:
        old_x, old_time, old_v = self._motion[track.track_id]
        center_x = obs.bbox[0] + obs.bbox[2] / 2
        velocity = abs(center_x - old_x) / max((timestamp_ms - old_time) / 1000, .001)
        track.motion = .65 * old_v + .35 * velocity
        self._motion[track.track_id] = (center_x, timestamp_ms, track.motion)
        track.bbox, track.face_confidence = obs.bbox, obs.confidence
        track.face_width_px, track.landmarks = obs.bbox[2] * width, obs.landmarks
        track.last_seen_ms, track.stale = timestamp_ms, False
        self._correct(track.track_id, track.center)

    def _predict(self, track_id: int, timestamp_ms: float) -> tuple[float, float]:
        state, covariance, previous_ms = self._kalman[track_id]
        dt = min(max((timestamp_ms - previous_ms) / 1000.0, 0.0), 1.0)
        transition = np.asarray(
            [[1.0, 0.0, dt, 0.0], [0.0, 1.0, 0.0, dt],
             [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]
        )
        process_noise = np.eye(4, dtype=float) * (0.002 + dt * 0.01)
        state = transition @ state
        covariance = transition @ covariance @ transition.T + process_noise
        self._kalman[track_id] = (state, covariance, timestamp_ms)
        return float(state[0]), float(state[1])

    def _correct(self, track_id: int, center: tuple[float, float]) -> None:
        state, covariance, timestamp_ms = self._kalman[track_id]
        observation = np.asarray(center, dtype=float)
        measurement = np.asarray(
            [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0]]
        )
        innovation = observation - measurement @ state
        innovation_covariance = (
            measurement @ covariance @ measurement.T + np.eye(2) * 0.01
        )
        gain = covariance @ measurement.T @ np.linalg.inv(innovation_covariance)
        state = state + gain @ innovation
        covariance = (np.eye(4) - gain @ measurement) @ covariance
        self._kalman[track_id] = (state, covariance, timestamp_ms)
