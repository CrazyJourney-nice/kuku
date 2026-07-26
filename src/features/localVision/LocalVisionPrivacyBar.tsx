"use client";

export function LocalVisionPrivacyBar({
  status,
  voiceBusy,
  voiceMuted,
  onToggleVoice,
}: {
  status: "connecting" | "live" | "unavailable";
  voiceBusy: boolean;
  voiceMuted: boolean;
  onToggleVoice: () => void;
}) {
  const isLive = status === "live";
  const statusLabel =
    status === "live"
      ? "本地视觉模型运行中"
      : status === "connecting"
        ? "正在连接本地视觉模型"
        : "本地视觉模型未连接";

  return (
    <aside className="local-privacy-bar" aria-label="本地视觉与语音控制">
      <p title={statusLabel}>
        <span className={`local-privacy-bar__dot is-${status}`} aria-hidden="true" />
        视觉模型本地运行，不会获取相关数据
      </p>
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
    </aside>
  );
}
