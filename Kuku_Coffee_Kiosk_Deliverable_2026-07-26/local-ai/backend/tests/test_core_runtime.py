import time
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api import DemoAPI
from app.domain import (
    Frame,
    Mode,
    Reason,
    VisualTargetDecision,
    VisualTargetReason,
    VoiceEvent,
)
from app.outputs import LocalAfplayVoiceOutput
from app.runtime import DemoRuntime
from app.sources import MacCameraSource


class ClosedCapture:
    def isOpened(self):
        return False

    def release(self):
        return None


def test_camera_unavailable_fails_closed():
    source = MacCameraSource(0, 1280, 720, 30)
    with patch.object(source, "_open", return_value=ClosedCapture()):
        with pytest.raises(RuntimeError, match="unavailable"):
            source.start()


def test_voice_is_enabled_by_default():
    runtime = DemoRuntime()
    assert runtime.voice_muted is False


def test_core_api_exposes_live_and_sound_only(monkeypatch):
    runtime = DemoRuntime()
    stopped = []
    monkeypatch.setattr(
        runtime, "start", lambda mode=Mode.LIVE: {"started": True}
    )
    monkeypatch.setattr(runtime, "stop", lambda: stopped.append(True))
    monkeypatch.setattr(
        runtime,
        "play_configured_clip",
        lambda clip_id: VoiceEvent(
            "host-event", "PLAYED", clip_id, None
        ),
    )
    with TestClient(DemoAPI(runtime).create_app()) as client:
        assert client.post(
            "/api/session/start", json={"mode": "LIVE"}
        ).status_code == 200
        assert client.post(
            "/api/voice/mute", json={"muted": False}
        ).json() == {"muted": False}
        assert client.post(
            "/api/voice/play", json={"clip_id": "quick_buy_prompt"}
        ).json()["clip_id"] == "quick_buy_prompt"
        assert client.post(
            "/api/voice/play", json={"clip_id": "unconfigured"}
        ).status_code == 422
        assert client.post(
            "/api/voice/cancel-followup"
        ).json() == {"cancelled": True}
        assert client.post("/api/session/stop").json() == {"stopped": True}
        assert stopped == [True]
        assert client.get("/api/replays").status_code == 404
        assert client.post(
            "/api/machine/event", json={"type": "RESET"}
        ).status_code in {404, 405}
        assert client.post(
            "/api/calibration/start", json={}
        ).status_code in {404, 405}


def test_websocket_rejects_external_origin():
    with TestClient(DemoAPI(DemoRuntime()).create_app()) as client:
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(
                "/ws/telemetry",
                headers={"origin": "https://external.example"},
            ):
                pass
    assert exc.value.code == 1008


def test_websocket_allows_local_packet():
    runtime = DemoRuntime()
    runtime.publish(runtime._fault_packet(Reason.CAMERA_UNAVAILABLE))
    with TestClient(DemoAPI(runtime).create_app()) as client:
        with client.websocket_connect("/ws/telemetry") as websocket:
            assert websocket.receive_bytes()


def test_stale_frame_resets_visual_and_voice_state():
    runtime = DemoRuntime()
    now = time.monotonic_ns() / 1_000_000
    packet = runtime.process_frame(
        Frame(
            9,
            np.zeros((32, 32, 3), np.uint8),
            now - 1000,
            Mode.LIVE,
        )
    )
    assert packet["attention_state"] == "LOST"
    assert packet["rejection_reason"] == "STALE_RESULT"
    assert packet["voice_journey"]["state"] == "IDLE"
    assert runtime.evaluator._state == {}


def test_visual_face_center_drives_eyes_without_attention(
    monkeypatch, track
):
    runtime = DemoRuntime()
    monkeypatch.setattr(runtime.face, "detect", lambda *_: [])
    monkeypatch.setattr(runtime.tracker, "update", lambda *_: [track])
    monkeypatch.setattr(runtime.head, "estimate", lambda *_: None)
    monkeypatch.setattr(
        runtime.visual_arbitrator,
        "select",
        lambda *_: VisualTargetDecision(
            track.track_id,
            track.center,
            VisualTargetReason.FIRST_STABLE_ENTRANT,
        ),
    )
    now = time.monotonic_ns() / 1_000_000
    packet = runtime.process_frame(
        Frame(
            10,
            np.zeros((64, 64, 3), np.uint8),
            now,
            Mode.LIVE,
        )
    )
    assert packet["selected_target_id"] is None
    assert packet["visual_target_id"] == track.track_id
    assert packet["mascot_state"]["command_id"] == "visual-track-1"
    assert "machine_state" not in packet


def test_audio_output_records_play_timestamp(tmp_path):
    audio = tmp_path / "welcome.wav"
    audio.write_bytes(b"RIFF")
    output = LocalAfplayVoiceOutput(audio)
    fake = SimpleNamespace(poll=lambda: 0, terminate=lambda: None)
    event = VoiceEvent("event", "PENDING", "welcome", "episode")
    with (
        patch("app.outputs.shutil.which", return_value="/usr/bin/afplay"),
        patch("app.outputs.subprocess.Popen", return_value=fake),
    ):
        assert output.play_once(event).status == "PLAYED"
    assert output.last_played_at_ms is not None


def test_audio_output_routes_each_clip_to_its_configured_file(tmp_path):
    greeting = tmp_path / "proximity_greeting.wav"
    followup = tmp_path / "quick_buy_prompt.wav"
    order_thanks = tmp_path / "order_thanks.wav"
    greeting.write_bytes(b"RIFF")
    followup.write_bytes(b"RIFF")
    order_thanks.write_bytes(b"RIFF")
    output = LocalAfplayVoiceOutput({
        "proximity_greeting": greeting,
        "quick_buy_prompt": followup,
        "order_thanks": order_thanks,
    })
    fake = SimpleNamespace(poll=lambda: 0, terminate=lambda: None)
    greeting_event = VoiceEvent(
        "event", "PENDING", "proximity_greeting", "episode"
    )
    followup_event = VoiceEvent(
        "followup-event", "PENDING", "quick_buy_prompt", "episode"
    )
    thanks_event = VoiceEvent(
        "thanks-event", "PENDING", "order_thanks", "episode"
    )
    with (
        patch("app.outputs.shutil.which", return_value="/usr/bin/afplay"),
        patch(
            "app.outputs.subprocess.Popen", return_value=fake
        ) as popen,
    ):
        assert output.play_once(greeting_event).status == "PLAYED"
        assert output.play_once(followup_event).status == "PLAYED"
        assert output.play_once(thanks_event).status == "PLAYED"
    assert [call.args[0][1] for call in popen.call_args_list] == [
        str(greeting.resolve()),
        str(followup.resolve()),
        str(order_thanks.resolve()),
    ]
