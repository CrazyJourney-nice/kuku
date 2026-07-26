from __future__ import annotations

import math


class _LowPass:
    def __init__(self) -> None:
        self.value: float | None = None

    def apply(self, value: float, alpha: float) -> float:
        self.value = value if self.value is None else alpha * value + (1 - alpha) * self.value
        return self.value


class OneEuroFilter:
    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.025, d_cutoff: float = 1.0) -> None:
        self.min_cutoff, self.beta, self.d_cutoff = min_cutoff, beta, d_cutoff
        self._x, self._dx = _LowPass(), _LowPass()
        self._time: float | None = None
        self._raw: float | None = None

    @staticmethod
    def _alpha(cutoff: float, dt: float) -> float:
        tau = 1 / (2 * math.pi * cutoff)
        return 1 / (1 + tau / max(dt, 1e-6))

    def __call__(self, value: float, timestamp_ms: float) -> float:
        now = timestamp_ms / 1000
        if self._time is None:
            self._time, self._raw = now, value
            return self._x.apply(value, 1)
        dt = max(now - self._time, 1e-6)
        derivative = (value - float(self._raw)) / dt
        dx = self._dx.apply(derivative, self._alpha(self.d_cutoff, dt))
        result = self._x.apply(value, self._alpha(self.min_cutoff + self.beta * abs(dx), dt))
        self._time, self._raw = now, value
        return result
