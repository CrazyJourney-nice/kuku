from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from app.domain import Gaze, Pose, Track

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def config() -> dict:
    return json.loads((ROOT / "config" / "demo.defaults.json").read_text())


@pytest.fixture
def track() -> Track:
    return Track(
        1, (.4, .3, .2, .3), .95, 144,
        np.zeros((478, 3)), 0, 0,
        raw_head_pose=Pose(0, 0, 0), gaze=Gaze(0, 0),
    )
