"use client";

import type { KioskScreen } from "@/src/domain/kioskState";
import type { RuntimeStatus } from "./useLocalVisionVoice";

export function shouldShowLocalVisionPrivacyNotice(screen: KioskScreen) {
  return screen === "impact" || screen === "welcome";
}

export function LocalVisionPrivacyBar({
  cameraBusy,
  cameraEnabled,
  personDetected,
  showPrivacyNotice,
  status,
  voiceBusy,
  voiceMuted,
  onToggleCamera,
  onToggleVoice,
}: {
  cameraBusy: boolean;
  cameraEnabled: boolean;
  personDetected: boolean;
  showPrivacyNotice: boolean;
  status: RuntimeStatus;
  voiceBusy: boolean;
  voiceMuted: boolean;
  onToggleCamera: () => void;
  onToggleVoice: () => void;
}) {
  const isLive = status === "live" && cameraEnabled;
  const statusLabel =
    status === "camera-off"
      ? "摄像头已关闭"
      : status === "live" && personDetected
        ? "已识别到访客，Kuku 正在看你"
        : status === "live"
          ? "正在本地识别"
      : status === "connecting"
          ? "正在启动本地视觉"
          : "本地视觉未连接";

  return (
    <aside
      className={`local-privacy-bar ${
        showPrivacyNotice ? "local-privacy-bar--with-notice" : ""
      }`}
      aria-label="本地视觉与语音控制"
      data-camera-enabled={cameraEnabled ? "true" : "false"}
      data-person-detected={personDetected ? "true" : "false"}
    >
      {showPrivacyNotice ? (
        <p className="local-privacy-bar__notice">
          视觉模型本地运行，不会获取相关数据
        </p>
      ) : null}
      <p className="local-vision-state" role="status" title={statusLabel}>
        <span className={`local-privacy-bar__dot is-${status}`} aria-hidden="true" />
        {statusLabel}
      </p>
      <div className="local-runtime-controls">
        <button
          type="button"
          className="local-camera-toggle"
          aria-label={
            cameraEnabled ? "关闭摄像头（临时功能）" : "重新开启摄像头"
          }
          aria-pressed={!cameraEnabled}
          disabled={cameraBusy}
          onClick={onToggleCamera}
        >
          <span aria-hidden="true">{cameraEnabled ? "◉" : "⊘"}</span>
          {cameraEnabled ? "关闭摄像头" : "开启摄像头"}
          {cameraEnabled ? <small>临时</small> : null}
        </button>
        <button
          type="button"
          className="local-voice-toggle"
          aria-label={voiceMuted ? "开启本地语音" : "关闭本地语音"}
          aria-pressed={!voiceMuted}
          disabled={!isLive || voiceBusy}
          onClick={onToggleVoice}
        >
          <span aria-hidden="true">{voiceMuted ? "◖" : "◖))"}</span>
          {voiceMuted ? "开启语音" : "语音已开"}
        </button>
      </div>
    </aside>
  );
}
