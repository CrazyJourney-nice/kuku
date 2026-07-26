from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path
from threading import Lock

from .domain import EyeStatus, VoiceEvent


class ScreenEyeAdapter:
    def __init__(self, settle_ms: float = 300) -> None:
        self.settle_ms, self.status = settle_ms, EyeStatus()

    def look_at(self, target: tuple[float, float], command_id: str, now_ms: float) -> EyeStatus:
        normalized = (
            min(max((target[0] - .5) * 2, -1), 1),
            min(max((target[1] - .5) * 2, -1), 1),
        )
        if command_id != self.status.command_id:
            self.status = EyeStatus(command_id, normalized, True, False, now_ms, None)
        else:
            self.status.target = normalized
        return self.update(now_ms)

    def update(self, now_ms: float) -> EyeStatus:
        if self.status.moving and self.status.started_at_ms is not None and now_ms - self.status.started_at_ms >= self.settle_ms:
            self.status.moving, self.status.settled, self.status.settled_at_ms = False, True, now_ms
        return self.status

    def neutral(self) -> None:
        self.status = EyeStatus()

    safe_stop = neutral


class LocalAfplayVoiceOutput:
    def __init__(self, path: Path) -> None:
        self.path, self._lock, self._process = path, Lock(), None
        self.last_played_at_ms: float | None = None
        self.last_played_event_id: str | None = None

    def health(self) -> bool:
        return self.path.is_file() and shutil.which("afplay") is not None

    def play_once(self, event: VoiceEvent) -> VoiceEvent:
        if not self.health() or event.event_id is None:
            event.status = "UNAVAILABLE"
            return event
        with self._lock:
            if self._process is not None and self._process.poll() is None:
                event.status = "SUPPRESSED"
                return event
            try:
                self._process = subprocess.Popen(
                    ["afplay", str(self.path.resolve())], stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
                )
                event.status = "PLAYED"
                self.last_played_at_ms = time.monotonic_ns() / 1_000_000
                self.last_played_event_id = event.event_id
            except OSError:
                event.status = "UNAVAILABLE"
        return event

    def stop(self) -> None:
        with self._lock:
            if self._process is not None and self._process.poll() is None:
                self._process.terminate()
            self._process = None
