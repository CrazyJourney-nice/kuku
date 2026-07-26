import pytest

from app.decision import ProximityEvaluator
from app.domain import ProximityReason, ProximityState, Track


def evaluator(config: dict) -> ProximityEvaluator:
    config["proximity"]["smoothing_alpha"] = 1
    return ProximityEvaluator(config)


def set_ratio(track: Track, ratio: float, frame_width: int = 1280) -> None:
    x, y, _, height = track.bbox
    track.bbox = (x, y, ratio, height)
    track.face_width_px = ratio * frame_width


def test_enter_dwell_emits_one_scene_episode(config, track):
    proximity = evaluator(config)
    set_ratio(track, 0.20)

    approaching = proximity.evaluate([track], 0)
    pending = proximity.evaluate([track], 699)
    entered = proximity.evaluate([track], 700)
    held = proximity.evaluate([track], 1200)

    assert approaching.state == ProximityState.APPROACHING
    assert pending.state == ProximityState.APPROACHING
    assert not pending.entered
    assert entered.state == ProximityState.NEAR
    assert entered.entered and entered.episode_id
    assert held.state == ProximityState.NEAR
    assert not held.entered
    assert held.episode_id == entered.episode_id


def test_hysteresis_exit_and_reentry(config, track):
    proximity = evaluator(config)
    set_ratio(track, 0.20)
    proximity.evaluate([track], 0)
    first = proximity.evaluate([track], 700)

    set_ratio(track, 0.14)
    assert proximity.evaluate([track], 900).state == ProximityState.NEAR

    set_ratio(track, 0.10)
    assert proximity.evaluate([track], 1000).state == ProximityState.LEAVING
    assert proximity.evaluate([track], 1899).state == ProximityState.LEAVING
    far = proximity.evaluate([track], 1900)
    assert far.state == ProximityState.FAR
    assert far.episode_id is None

    set_ratio(track, 0.20)
    proximity.evaluate([track], 2000)
    second = proximity.evaluate([track], 2700)
    assert second.entered
    assert second.episode_id != first.episode_id


def test_scene_episode_survives_track_switch(config, track):
    proximity = evaluator(config)
    set_ratio(track, 0.20)
    proximity.evaluate([track], 0)
    entered = proximity.evaluate([track], 700)

    replacement = Track(
        2,
        (0.4, 0.3, 0.21, 0.3),
        0.95,
        269,
        track.landmarks.copy(),
        800,
        800,
    )
    decision = proximity.evaluate([replacement], 800)

    assert decision.state == ProximityState.NEAR
    assert not decision.entered
    assert decision.episode_id == entered.episode_id
    assert decision.track_id == 2


def test_short_loss_keeps_same_episode(config, track):
    proximity = evaluator(config)
    set_ratio(track, 0.20)
    proximity.evaluate([track], 0)
    entered = proximity.evaluate([track], 700)

    assert proximity.evaluate([], 800).state == ProximityState.LEAVING
    returned = proximity.evaluate([track], 1200)
    assert returned.state == ProximityState.NEAR
    assert not returned.entered
    assert returned.episode_id == entered.episode_id


def test_face_width_signal_is_smoothed(config, track):
    config["proximity"]["smoothing_alpha"] = 0.5
    proximity = ProximityEvaluator(config)
    set_ratio(track, 0.10)
    proximity.evaluate([track], 0)
    set_ratio(track, 0.30)
    decision = proximity.evaluate([track], 100)
    assert decision.face_width_ratio == pytest.approx(0.20)


def test_rejects_outside_roi_stale_low_quality_and_edge_crop(config, track):
    proximity = evaluator(config)
    set_ratio(track, 0.20)

    track.bbox = (0.01, 0.3, 0.20, 0.3)
    assert (
        proximity.evaluate([track], 0).reason
        == ProximityReason.FACE_EDGE_CROPPED
    )

    track.bbox = (0.86, 0.3, 0.10, 0.3)
    assert (
        proximity.evaluate([track], 10).reason
        == ProximityReason.OUTSIDE_INTERACTION_ZONE
    )

    track.bbox = (0.4, 0.3, 0.20, 0.3)
    track.face_confidence = 0.2
    assert (
        proximity.evaluate([track], 20).reason
        == ProximityReason.LOW_FACE_CONFIDENCE
    )

    track.face_confidence = 0.95
    track.stale = True
    assert (
        proximity.evaluate([track], 30).reason
        == ProximityReason.STALE_RESULT
    )
