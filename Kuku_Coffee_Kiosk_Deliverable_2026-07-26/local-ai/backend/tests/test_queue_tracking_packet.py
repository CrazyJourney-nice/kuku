import msgpack
import numpy as np

from app.domain import FaceObservation, Reason
from app.runtime import DemoRuntime
from app.sources import LatestValueQueue
from app.tracking import AnonymousTracker


def obs(x):
    return FaceObservation((x, .2, .2, .3), .9, np.zeros((478, 3)))


def test_latest_queue_capacity_one():
    queue = LatestValueQueue()
    queue.put(1); queue.put(2); queue.put(3)
    assert queue.depth == 1 and queue.dropped == 2 and queue.get() == 3


def test_tracker_keeps_id_and_expires():
    tracker = AnonymousTracker(600)
    assert tracker.update([obs(.1)], 0, 1280)[0].track_id == tracker.update([obs(.11)], 100, 1280)[0].track_id
    assert tracker.update([], 701, 1280) == []


def test_tracker_uses_per_track_kalman_prediction():
    tracker = AnonymousTracker(600)
    first = tracker.update([obs(.10)], 0, 1280)[0]
    second = tracker.update([obs(.15)], 100, 1280)[0]
    third = tracker.update([obs(.20)], 200, 1280)[0]
    assert first.track_id == second.track_id == third.track_id
    state, covariance, timestamp_ms = tracker._kalman[first.track_id]
    assert state.shape == (4,)
    assert covariance.shape == (4, 4)
    assert timestamp_ms == 200


def test_fault_packet_msgpack_alignment():
    runtime = DemoRuntime()
    packet = runtime._fault_packet(Reason.MODEL_UNAVAILABLE)
    runtime.publish(packet)
    _, raw = runtime.wait_packet(0, 0)
    unpacked = msgpack.unpackb(raw, raw=False)
    assert unpacked["frame_id"] == packet["frame_id"]
    assert unpacked["attention_state"] == "FAULT"
    assert unpacked["visual_target_id"] is None
    assert unpacked["selected_target_id"] is None
    assert unpacked["visual_target_reason"] == "FAULT"
    assert unpacked["proximity"]["state"] == "UNKNOWN"
    assert unpacked["proximity"]["reason"] == "FAULT"
    assert unpacked["voice_journey"]["state"] == "IDLE"
    assert unpacked["stale_fields"] == ["image_jpeg", "tracks"]
