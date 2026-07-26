from __future__ import annotations

import time
from abc import ABC, abstractmethod
from threading import Condition, Event, Lock, Thread
from typing import Generic, TypeVar

import cv2

from .domain import Frame, Mode

T = TypeVar("T")


class LatestValueQueue(Generic[T]):
    def __init__(self) -> None:
        self._condition = Condition(Lock())
        self._item: T | None = None
        self.dropped = 0

    def put(self, item: T) -> None:
        with self._condition:
            if self._item is not None:
                self.dropped += 1
            self._item = item
            self._condition.notify_all()

    def get(self, timeout: float | None = None) -> T | None:
        with self._condition:
            if self._item is None:
                self._condition.wait(timeout)
            item, self._item = self._item, None
            return item

    def clear(self) -> None:
        with self._condition:
            self._item = None

    @property
    def depth(self) -> int:
        with self._condition:
            return int(self._item is not None)


class FrameSource(ABC):
    mode: Mode

    def __init__(self) -> None:
        self.queue: LatestValueQueue[Frame] = LatestValueQueue()
        self.error: str | None = None
        self.capture_fps = 0.0

    @abstractmethod
    def start(self) -> dict[str, object]: ...

    def read_latest(self, timeout: float = 0.25) -> Frame | None:
        return self.queue.get(timeout)

    @abstractmethod
    def stop(self) -> None: ...


class _OpenCVSource(FrameSource):
    def __init__(self) -> None:
        super().__init__()
        self._stop, self.ended = Event(), Event()
        self._thread: Thread | None = None
        self._capture: cv2.VideoCapture | None = None
        self._frame_id = 0

    @abstractmethod
    def _open(self) -> cv2.VideoCapture: ...

    def _timestamp_ms(self, capture: cv2.VideoCapture) -> float:
        return time.monotonic_ns() / 1_000_000

    def _pace(self, capture: cv2.VideoCapture) -> None:
        del capture

    def _retry_at_end(self, capture: cv2.VideoCapture) -> bool:
        del capture
        return False

    def start(self) -> dict[str, object]:
        self.stop()
        self.error = None
        self._stop.clear()
        self.ended.clear()
        capture = self._open()
        if not capture.isOpened():
            capture.release()
            self.error = "source unavailable"
            raise RuntimeError(self.error)
        self._capture = capture
        self._thread = Thread(target=self._loop, daemon=True)
        self._thread.start()
        return {
            "mode": self.mode,
            "width": int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": float(capture.get(cv2.CAP_PROP_FPS)),
        }

    def _loop(self) -> None:
        assert self._capture is not None
        capture, started, count = self._capture, time.monotonic(), 0
        while not self._stop.is_set():
            ok, image = capture.read()
            if not ok:
                if self._retry_at_end(capture):
                    continue
                break
            count += 1
            self._frame_id += 1
            self.capture_fps = count / max(time.monotonic() - started, 1e-6)
            self.queue.put(Frame(self._frame_id, image, self._timestamp_ms(capture), self.mode))
            self._pace(capture)
        capture.release()
        self._capture = None
        self.ended.set()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive() and self._thread is not __import__("threading").current_thread():
            self._thread.join(timeout=1)
        if self._capture is not None:
            self._capture.release()
            self._capture = None
        self.queue.clear()


class MacCameraSource(_OpenCVSource):
    mode = Mode.LIVE

    def __init__(self, index: int, width: int, height: int, fps: int) -> None:
        super().__init__()
        self.index, self.width, self.height, self.fps = index, width, height, fps

    def _open(self) -> cv2.VideoCapture:
        capture = cv2.VideoCapture(self.index, getattr(cv2, "CAP_AVFOUNDATION", cv2.CAP_ANY))
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        capture.set(cv2.CAP_PROP_FPS, self.fps)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return capture

