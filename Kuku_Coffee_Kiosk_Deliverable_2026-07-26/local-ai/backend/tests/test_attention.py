from __future__ import annotations

import math

import numpy as np
import pytest

from app.decision import (
    AttentionEvaluator,
    TargetArbitrator,
    VisualTargetArbitrator,
)
from app.domain import (
    AttentionState,
    Gaze,
    Pose,
    Reason,
    Track,
    VisualTargetReason,
)
from app.perception import OpenVINOGazeEstimator


def second_track(track: Track) -> Track:
    return Track(
        2, (.6, .3, .2, .3), track.face_confidence, track.face_width_px,
        track.landmarks.copy(), 0, 0, raw_head_pose=Pose(0, 0, 0), gaze=Gaze(0, 0),
    )


def test_dwell_boundary_799_not_trigger_800_triggers(config, track):
    evaluator = AttentionEvaluator(config)
    assert not evaluator.evaluate(track, 1000).qualified
    low = evaluator.evaluate(track, 1799)
    exact = evaluator.evaluate(track, 1800)
    assert not low.qualified and low.dwell_ms == 799
    assert exact.qualified and exact.dwell_ms == 800


def test_head_only_uses_longer_dwell(config, track):
    evaluator = AttentionEvaluator(config)
    track.gaze = None
    evaluator.evaluate(track, 0)
    assert not evaluator.evaluate(track, 800).qualified
    assert evaluator.evaluate(track, 1400).qualified


def test_geometry_boundary_is_inclusive(config):
    evaluator = AttentionEvaluator(config)
    assert evaluator.ray_hits_roi(18, -18, 18, 18)
    assert not evaluator.ray_hits_roi(18.001, 0, 18, 18)
    assert math.isclose(evaluator.angular_error(3, 4), 5)


def test_unknown_never_starts_attention(config, track):
    track.raw_head_pose = None
    result = AttentionEvaluator(config).evaluate(track, 1000)
    assert not result.qualified and result.reason == Reason.HEAD_OUTSIDE_ROI


def test_short_loss_grace(config, track):
    evaluator = AttentionEvaluator(config)
    evaluator.evaluate(track, 0)
    evaluator.evaluate(track, 800)
    track.stale = True
    assert evaluator.evaluate(track, 1299).qualified
    assert not evaluator.evaluate(track, 1301).qualified


def test_off_target_exit_hold(config, track):
    evaluator = AttentionEvaluator(config)
    evaluator.evaluate(track, 0)
    evaluator.evaluate(track, 800)
    track.gaze = Gaze(40, 0)
    assert evaluator.evaluate(track, 1199).qualified
    assert not evaluator.evaluate(track, 1201).qualified


def test_passerby_rejected(config, track):
    track.motion = .251
    result = AttentionEvaluator(config).evaluate(track, 0)
    assert result.reason == Reason.PASSERBY_TOO_FAST and not result.qualified


def test_group_and_single_target(config, track):
    evaluator, second = AttentionEvaluator(config), second_track(track)
    for timestamp in (0, 800):
        first_result = evaluator.evaluate(track, timestamp)
        second_result = evaluator.evaluate(second, timestamp)
    arbitrator = TargetArbitrator(.15, 4, 500)
    assert arbitrator.select([track, second], [first_result, second_result], 800).state == AttentionState.GROUP_ATTENTION
    second_result.attention_score = .4
    decision = arbitrator.select([track, second], [first_result, second_result], 800)
    assert decision.selected_track_id == 1


def test_openvino_forward_gaze_vector_maps_to_zero_angles():
    gaze = OpenVINOGazeEstimator._vector_to_angles(np.asarray([0., 0., -1.], dtype=np.float32))
    assert gaze.x == pytest.approx(0)
    assert gaze.y == pytest.approx(0)


def test_target_challenger_must_hold_margin_before_switch(config, track):
    evaluator, second = AttentionEvaluator(config), second_track(track)
    for timestamp in (0, 800):
        first = evaluator.evaluate(track, timestamp)
        challenger = evaluator.evaluate(second, timestamp)
    first.attention_score, challenger.attention_score = .9, .5
    arb = TargetArbitrator(.15, 4, 500)
    assert arb.select([track, second], [first, challenger], 800).selected_track_id == 1
    first.attention_score, challenger.attention_score = .5, .9
    assert arb.select([track, second], [first, challenger], 1000).selected_track_id == 1
    assert arb.select([track, second], [first, challenger], 1499).selected_track_id == 1
    assert arb.select([track, second], [first, challenger], 1500).selected_track_id == 2


def test_target_small_margin_never_switches(config, track):
    evaluator, second = AttentionEvaluator(config), second_track(track)
    for timestamp in (0, 800):
        first = evaluator.evaluate(track, timestamp)
        challenger = evaluator.evaluate(second, timestamp)
    first.attention_score, challenger.attention_score = .9, .5
    arb = TargetArbitrator(.15, 4, 500)
    arb.select([track, second], [first, challenger], 800)
    first.attention_score, challenger.attention_score = .75, .8
    assert arb.select([track, second], [first, challenger], 2000).selected_track_id == 1


def test_visual_target_acquires_first_stable_entrant_at_fixed_250ms(track):
    arb = VisualTargetArbitrator()
    pending = arb.select([track], 249)
    selected = arb.select([track], 250)
    assert pending.selected_track_id is None
    assert pending.reason == VisualTargetReason.STABILIZING_FIRST_ENTRANT
    assert selected.selected_track_id == track.track_id
    assert selected.target == track.center
    assert selected.reason == VisualTargetReason.FIRST_STABLE_ENTRANT


def test_visual_target_keeps_first_entrant_when_bystander_arrives(track):
    arb = VisualTargetArbitrator()
    second = second_track(track)
    second.created_ms = 300
    assert arb.select([track], 250).selected_track_id == 1
    assert arb.select([track, second], 1000).selected_track_id == 1


def test_visual_target_does_not_switch_to_later_face(track):
    arb = VisualTargetArbitrator()
    second = second_track(track)
    arb.select([track, second], 250)
    assert arb.select([track, second], 800).selected_track_id == 1
    locked = arb.select([track, second], 1300)
    assert locked.selected_track_id == 1
    assert locked.reason == VisualTargetReason.CURRENT_TARGET_LOCK


def test_visual_target_loss_grace_and_stable_handoff(track):
    arb = VisualTargetArbitrator()
    second = second_track(track)
    second.created_ms = 0
    arb.select([track], 250)
    track.stale = True
    track.last_seen_ms = 250
    grace = arb.select([track, second], 300)
    assert grace.selected_track_id == 1
    assert grace.reason == VisualTargetReason.TARGET_LOSS_GRACE
    pending = arb.select([track, second], 799)
    assert pending.selected_track_id is None
    assert pending.reason == VisualTargetReason.HANDOFF_PENDING
    switched = arb.select([track, second], 800)
    assert switched.selected_track_id == 2


def test_visual_crowd_never_acquires(track):
    crowd = VisualTargetArbitrator()
    five = [
        Track(
            index,
            (.05 * index, .2, .1, .2),
            .9,
            100,
            track.landmarks.copy(),
            1000,
            0,
        )
        for index in range(1, 6)
    ]
    decision = crowd.select(five, 1000)
    assert decision.selected_track_id is None
    assert decision.reason == VisualTargetReason.CROWD_SAFE

def test_visual_simultaneous_entry_tie_break_prefers_salient_face(track):
    arb = VisualTargetArbitrator()
    peripheral = track
    peripheral.bbox = (.02, .1, .1, .2)
    peripheral.face_width_px = 72
    peripheral.motion = .1
    central = second_track(track)
    central.bbox = (.4, .3, .25, .3)
    central.face_width_px = 180
    central.motion = .01
    central.created_ms = peripheral.created_ms
    selected = arb.select([peripheral, central], 250)
    assert selected.selected_track_id == central.track_id
