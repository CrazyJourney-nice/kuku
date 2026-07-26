from __future__ import annotations

import asyncio
import hashlib
from contextlib import asynccontextmanager
from typing import Any, Literal
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

from .config import PROJECT_ROOT
from .domain import Mode
from .runtime import DemoRuntime


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ModeRequest(StrictModel):
    mode: Mode = Mode.LIVE


class VoiceMuteRequest(StrictModel):
    muted: bool


class VoicePlayRequest(StrictModel):
    clip_id: Literal["quick_buy_prompt", "order_thanks"]


class EyeSettledRequest(StrictModel):
    command_id: str


class DemoAPI:
    def __init__(self, runtime: DemoRuntime | None = None) -> None:
        self.runtime = runtime or DemoRuntime()

    def create_app(self) -> FastAPI:
        @asynccontextmanager
        async def lifespan(_app: FastAPI):
            yield
            self.runtime.stop()

        app = FastAPI(
            title="Local Vision and Voice Demo",
            version="0.2.0",
            docs_url="/api/docs",
            redoc_url=None,
            lifespan=lifespan,
        )
        app.state.runtime = self.runtime
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://127.0.0.1:5173",
                "http://localhost:5173",
            ],
            allow_origin_regex=(
                r"^http://(?:127\.0\.0\.1|localhost)(?::\d+)?$"
            ),
            allow_methods=["GET", "POST"],
            allow_headers=["content-type"],
        )

        @app.get("/health")
        @app.get("/api/health")
        def health() -> dict[str, Any]:
            return {
                "status": self.runtime.health.pipeline,
                "local_only": True,
                "mode": Mode.LIVE,
                "health": self.runtime.health,
                "voice_muted": self.runtime.voice_muted,
                "config_hash": self.runtime.config_store.hash(),
                "model_hash": self._model_hash(),
                "audio_status": (
                    "HEALTHY"
                    if self.runtime.voice.health()
                    else "UNAVAILABLE"
                ),
            }

        @app.get("/api/config")
        def get_config() -> dict[str, Any]:
            return self.runtime.config_store.get()

        @app.post("/api/preflight")
        def preflight() -> dict[str, Any]:
            return self.runtime.preflight()

        @app.post("/api/mode")
        @app.post("/api/session/start")
        def start_session(request: ModeRequest) -> dict[str, Any]:
            try:
                return self.runtime.start(request.mode)
            except (ValueError, RuntimeError) as exc:
                raise HTTPException(409, str(exc)) from exc

        @app.post("/api/session/stop")
        def stop_session() -> dict[str, bool]:
            self.runtime.stop()
            return {"stopped": True}

        @app.post("/api/voice/mute")
        def voice_mute(request: VoiceMuteRequest) -> dict[str, bool]:
            self.runtime.voice_muted = request.muted
            return {"muted": self.runtime.voice_muted}

        @app.post("/api/voice/play")
        def voice_play(request: VoicePlayRequest) -> dict[str, Any]:
            return self.runtime.play_configured_clip(
                request.clip_id
            ).as_dict()

        @app.post("/api/voice/cancel-followup")
        def cancel_voice_followup() -> dict[str, bool]:
            self.runtime.cancel_voice_followup()
            return {"cancelled": True}

        @app.post("/api/mascot/settled")
        def mascot_settled(
            request: EyeSettledRequest,
        ) -> dict[str, Any]:
            if not self.runtime.eye_settled(request.command_id):
                raise HTTPException(
                    409, "eye command is no longer current"
                )
            return {
                "accepted": True,
                "command_id": request.command_id,
            }

        @app.websocket("/ws/telemetry")
        async def telemetry(websocket: WebSocket) -> None:
            origin = websocket.headers.get("origin")
            if (
                origin
                and urlparse(origin).hostname
                not in {"127.0.0.1", "localhost", "::1"}
            ):
                await websocket.close(code=1008)
                return
            await websocket.accept()
            version = 0
            try:
                while True:
                    version, packet = await asyncio.to_thread(
                        self.runtime.wait_packet, version, 1
                    )
                    if packet is not None:
                        await websocket.send_bytes(packet)
            except (WebSocketDisconnect, RuntimeError):
                return

        dist = PROJECT_ROOT / "frontend" / "dist"
        if dist.is_dir():
            app.mount(
                "/",
                StaticFiles(directory=dist, html=True),
                name="local-frontend",
            )
        return app

    def _model_hash(self) -> str | None:
        digest = hashlib.sha256()
        for path in (
            self.runtime.face.model_path,
            self.runtime.gaze.xml_path,
            self.runtime.gaze.bin_path,
        ):
            if not path.is_file():
                return None
            digest.update(path.read_bytes())
        return digest.hexdigest()[:12]


api = DemoAPI()
app = api.create_app()
