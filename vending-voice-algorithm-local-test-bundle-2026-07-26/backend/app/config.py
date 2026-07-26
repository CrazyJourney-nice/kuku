from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path
from threading import RLock
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "demo.defaults.json"
def _validate(config: dict[str, Any]) -> None:
    required = {
        "camera",
        "attention",
        "proximity",
        "voice_journey",
        "scoring",
        "voice",
        "runtime",
    }
    if set(config) != required:
        raise ValueError(f"config sections must be exactly {sorted(required)}")
    if not 0 <= float(config["attention"]["face_confidence_min"]) <= 1:
        raise ValueError("attention.face_confidence_min must be in [0,1]")
    for key, value in config["attention"].items():
        if key not in {"face_confidence_min", "winner_margin"} and float(value) <= 0:
            raise ValueError(f"attention.{key} must be positive")
    proximity = config["proximity"]
    required_proximity = {
        "interaction_roi",
        "enter_face_width_ratio",
        "exit_face_width_ratio",
        "enter_dwell_ms",
        "exit_dwell_ms",
        "smoothing_alpha",
        "edge_margin_ratio",
        "face_confidence_min",
    }
    if set(proximity) != required_proximity:
        raise ValueError(
            f"proximity fields must be exactly {sorted(required_proximity)}"
        )
    roi = proximity["interaction_roi"]
    if (
        not isinstance(roi, list)
        or len(roi) != 4
        or not all(
            isinstance(value, (int, float)) and math.isfinite(float(value))
            for value in roi
        )
    ):
        raise ValueError("proximity.interaction_roi must contain four numbers")
    x, y, width, height = map(float, roi)
    if (
        x < 0
        or y < 0
        or width <= 0
        or height <= 0
        or x + width > 1
        or y + height > 1
    ):
        raise ValueError("proximity.interaction_roi must fit inside the frame")
    enter = float(proximity["enter_face_width_ratio"])
    exit_ = float(proximity["exit_face_width_ratio"])
    if not 0 < exit_ < enter < 1:
        raise ValueError(
            "proximity face-width ratios must satisfy 0 < exit < enter < 1"
        )
    if float(proximity["enter_dwell_ms"]) <= 0:
        raise ValueError("proximity.enter_dwell_ms must be positive")
    if float(proximity["exit_dwell_ms"]) <= 0:
        raise ValueError("proximity.exit_dwell_ms must be positive")
    if not 0 < float(proximity["smoothing_alpha"]) <= 1:
        raise ValueError("proximity.smoothing_alpha must be in (0,1]")
    if not 0 <= float(proximity["edge_margin_ratio"]) < .5:
        raise ValueError("proximity.edge_margin_ratio must be in [0,.5)")
    if not 0 <= float(proximity["face_confidence_min"]) <= 1:
        raise ValueError("proximity.face_confidence_min must be in [0,1]")
    voice_journey = config["voice_journey"]
    if set(voice_journey) != {"followup_dwell_ms"}:
        raise ValueError(
            "voice_journey fields must be exactly ['followup_dwell_ms']"
        )
    if float(voice_journey["followup_dwell_ms"]) <= 0:
        raise ValueError("voice_journey.followup_dwell_ms must be positive")
    voice = config["voice"]
    for key in (
        "proximity_clip_id",
        "followup_clip_id",
        "path",
    ):
        if not isinstance(voice.get(key), str) or not voice[key].strip():
            raise ValueError(f"voice.{key} must be a non-empty string")
    if config["runtime"]["bind_host"] not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("runtime.bind_host must remain loopback-only")


class ConfigStore:
    def __init__(self, path: Path = DEFAULT_CONFIG_PATH) -> None:
        self._lock = RLock()
        self._path = path
        self._defaults = json.loads(path.read_text(encoding="utf-8"))
        _validate(self._defaults)
        self._config = copy.deepcopy(self._defaults)

    def get(self) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._config)

    def hash(self) -> str:
        raw = json.dumps(self.get(), sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(raw).hexdigest()[:12]
