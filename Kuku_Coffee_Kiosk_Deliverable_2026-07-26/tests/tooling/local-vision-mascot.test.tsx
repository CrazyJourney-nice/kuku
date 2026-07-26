import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AMBIENT_INTERACTION_MAX_MS,
  AMBIENT_INTERACTION_MIN_MS,
  DRINK_SCREEN_MASCOT_CUE,
  getAmbientInteractionDelay,
  KukuStage,
} from "@/src/components/mascot/KukuStage";
import {
  EYE_FOLLOW_RESPONSE,
  EYE_HORIZONTAL_RANGE,
  EYE_VERTICAL_RANGE,
} from "@/src/components/mascot/TrackedMascotEyes";
import {
  LocalVisionPrivacyBar,
  shouldShowLocalVisionPrivacyNotice,
} from "@/src/features/localVision/LocalVisionPrivacyBar";
import {
  DEFAULT_VOICE_MUTED,
  hostVoiceClipForScreen,
  readLocalFrame,
} from "@/src/features/localVision/useLocalVisionVoice";

describe("local vision mascot integration", () => {
  it("uses the more responsive eye-follow profile", () => {
    expect(EYE_FOLLOW_RESPONSE).toBe(1.134);
    expect(EYE_HORIZONTAL_RANGE).toBeGreaterThanOrEqual(24);
    expect(EYE_VERTICAL_RANGE).toBeGreaterThanOrEqual(20);
  });

  it("starts local voice enabled by default", () => {
    expect(DEFAULT_VOICE_MUTED).toBe(false);
  });

  it("maps page two and an accepted order to their host voice clips", () => {
    expect(hostVoiceClipForScreen("impact", null)).toBeNull();
    expect(hostVoiceClipForScreen("welcome", null)).toBe(
      "quick_buy_prompt",
    );
    expect(hostVoiceClipForScreen("submitting", "order-1")).toBeNull();
    expect(hostVoiceClipForScreen("brewing", "order-1")).toBe(
      "order_thanks",
    );
  });

  it("anchors the tracked eyes to an open-eye mascot cue", () => {
    render(
      <KukuStage
        cue="welcome"
        lookTarget={{ x: 0.4, y: -0.25 }}
        lookCommandId="look-1"
      />,
    );

    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-look-active",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-vision-tracking", "true");
  });

  it("keeps the original closed-eye impact expression before voice triggers", () => {
    render(
      <KukuStage
        cue="grateful"
        lookTarget={{ x: 0.4, y: -0.25 }}
        trackedEyesEnabled={false}
      />,
    );

    expect(screen.queryByTestId("mascot-tracked-eyes")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-eye-state", "closed");
  });

  it("shows the closed-eye dozing state after an idle return", () => {
    render(
      <KukuStage
        cue="grateful"
        sleeping
        trackedEyesEnabled={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-sleeping", "true");
    expect(screen.getByText("Zzz")).toBeInTheDocument();
    expect(screen.queryByTestId("mascot-tracked-eyes")).not.toBeInTheDocument();
  });

  it("marks the three-second eye-opening presentation", () => {
    render(
      <KukuStage
        cue="grateful"
        trackedEyesEnabled
        trackedEyesFollowEnabled={false}
        trackedEyesOpening
      />,
    );

    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-opening",
      "true",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-movement-enabled",
      "false",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-artwork-cover",
      "false",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-cue",
      "grateful",
    );
    expect(
      screen
        .getByTestId("mascot-tracked-eyes")
        .querySelectorAll("[data-eye-concealer]"),
    ).toHaveLength(2);
    expect(
      document.querySelector(
        ".kuku-tracked-eye-slot--left [data-eye-concealer]",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-vision-tracking", "false");
  });

  it("enables normal eye movement after the opening presentation", () => {
    render(
      <KukuStage
        cue="grateful"
        lookTarget={{ x: 0.4, y: -0.25 }}
        trackedEyesEnabled
        trackedEyesFollowEnabled
      />,
    );

    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-opening",
      "false",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-movement-enabled",
      "true",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-look-active",
      "true",
    );
  });

  it("moves the visible pupils across center when the user changes sides", () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(
      <KukuStage
        cue="approve"
        lookTarget={{ x: -0.8, y: 0 }}
        trackedEyesEnabled
        trackedEyesFollowEnabled
      />,
    );

    act(() => {
      vi.advanceTimersByTime(160);
    });
    const eyes = screen.getByTestId("mascot-tracked-eyes");
    const leftPosition = Number.parseFloat(
      eyes.style.getPropertyValue("--pupil-x"),
    );

    rerender(
      <KukuStage
        cue="approve"
        lookTarget={{ x: 0.8, y: 0 }}
        trackedEyesEnabled
        trackedEyesFollowEnabled
      />,
    );
    act(() => {
      vi.advanceTimersByTime(240);
    });
    const rightPosition = Number.parseFloat(
      eyes.style.getPropertyValue("--pupil-x"),
    );

    expect(leftPosition).toBeLessThan(0);
    expect(rightPosition).toBeGreaterThan(0);
    expect(rightPosition - leftPosition).toBeGreaterThan(20);

    unmount();
    vi.useRealTimers();
  });

  it("adds tracked eyes to the celebration artwork when vision is active", () => {
    render(<KukuStage cue="celebrate" lookTarget={{ x: 0.4, y: 0.2 }} />);

    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-look-active",
      "true",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveAttribute(
      "data-artwork-cover",
      "true",
    );
    expect(screen.getByTestId("mascot-tracked-eyes")).toHaveClass(
      "has-artwork-cover",
    );
  });

  it("keeps the post-selection mascot eyes throughout page three", () => {
    expect(DRINK_SCREEN_MASCOT_CUE).toBe("approve");
  });

  it("preserves the original direct mascot tap interaction", () => {
    const onTap = vi.fn();
    render(<KukuStage cue="approve" onTap={onTap} />);

    const mascot = screen.getByRole("button", {
      name: "和 Kuku 打个招呼",
    });
    fireEvent.click(mascot);

    expect(onTap).toHaveBeenCalledOnce();
    expect(mascot.parentElement).toHaveAttribute("data-cue", "tap-delight");
    expect(mascot.parentElement).toHaveAttribute(
      "data-interaction",
      "tap-delight",
    );
  });

  it("responds to a page selection interaction command", () => {
    const onTap = vi.fn();
    const { rerender } = render(<KukuStage cue="approve" onTap={onTap} />);
    rerender(
      <KukuStage
        cue="approve"
        interaction={{ id: 1, kind: "selection" }}
        onTap={onTap}
      />,
    );

    expect(onTap).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-cue", "tap-delight");
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-interaction", "tap-delight");
  });

  it("uses the same 720ms restore path for selection interactions", () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <KukuStage
        cue="approve"
        interaction={{ id: 1, kind: "approval" }}
      />,
    );
    const stage = screen.getByRole("button", {
      name: "和 Kuku 打个招呼",
    }).parentElement;
    const baseLayer = document.querySelector(
      '[data-artwork-layer="base"]',
    );
    const delightLayer = document.querySelector(
      '[data-artwork-layer="delight"]',
    );
    const baseArtwork = baseLayer?.querySelector(".slice-asset");
    const delightArtwork = delightLayer?.querySelector(".slice-asset");

    expect(stage).toHaveAttribute("data-cue", "tap-delight");
    expect(baseLayer).toHaveAttribute("data-active", "false");
    expect(delightLayer).toHaveAttribute("data-active", "true");
    expect(baseArtwork).not.toHaveClass("slice-asset--fallback");
    expect(delightArtwork).not.toHaveClass("slice-asset--fallback");
    act(() => {
      vi.advanceTimersByTime(719);
    });
    expect(stage).toHaveAttribute("data-cue", "tap-delight");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(stage).toHaveAttribute("data-cue", "approve");
    expect(baseLayer).toHaveAttribute("data-active", "true");
    expect(delightLayer).toHaveAttribute("data-active", "false");
    expect(baseLayer?.querySelector(".slice-asset")).toBe(baseArtwork);
    expect(delightLayer?.querySelector(".slice-asset")).toBe(delightArtwork);
    expect(baseArtwork).toHaveStyle({
      "--slice-ratio": "255 / 236",
    });
    expect(delightArtwork).toHaveStyle({
      "--slice-ratio": "420 / 424",
    });
    expect(baseArtwork?.querySelector("img")).toHaveAttribute(
      "decoding",
      "sync",
    );
    expect(delightArtwork?.querySelector("img")).toHaveAttribute(
      "decoding",
      "sync",
    );

    unmount();
    vi.useRealTimers();
  });

  it("keeps autonomous interactions within the friendly interval", () => {
    expect(getAmbientInteractionDelay(() => -1)).toBe(
      AMBIENT_INTERACTION_MIN_MS,
    );
    expect(getAmbientInteractionDelay(() => 2)).toBe(
      AMBIENT_INTERACTION_MAX_MS,
    );
    expect(getAmbientInteractionDelay(() => 0.5)).toBe(11_000);
  });

  it("plays an autonomous interaction on every mascot stage", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { unmount } = render(<KukuStage cue="welcome" />);

    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-interaction", "idle");

    act(() => {
      vi.advanceTimersByTime(AMBIENT_INTERACTION_MIN_MS);
    });

    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-cue", "tap-delight");
    expect(
      screen.getByRole("button", { name: "和 Kuku 打个招呼" }).parentElement,
    ).toHaveAttribute("data-interaction", "tap-delight");

    unmount();
    vi.useRealTimers();
  });

  it("shows the local privacy promise and explicit voice control", () => {
    render(
      <LocalVisionPrivacyBar
        cameraBusy={false}
        cameraEnabled
        personDetected
        showPrivacyNotice
        status="live"
        voiceBusy={false}
        voiceMuted
        onToggleCamera={() => undefined}
        onToggleVoice={() => undefined}
      />,
    );

    expect(
      screen.getByText("视觉模型本地运行，不会获取相关数据"),
    ).toBeVisible();
    expect(screen.getByText("已识别到访客，Kuku 正在看你")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "关闭摄像头（临时功能）" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "开启本地语音" })).toBeEnabled();
  });

  it("limits the local privacy sentence to the first two pages", () => {
    expect(shouldShowLocalVisionPrivacyNotice("impact")).toBe(true);
    expect(shouldShowLocalVisionPrivacyNotice("welcome")).toBe(true);
    expect(shouldShowLocalVisionPrivacyNotice("drink")).toBe(false);
    expect(shouldShowLocalVisionPrivacyNotice("customize")).toBe(false);
    expect(shouldShowLocalVisionPrivacyNotice("confirm")).toBe(false);
    expect(shouldShowLocalVisionPrivacyNotice("brewing")).toBe(false);
    expect(shouldShowLocalVisionPrivacyNotice("pickup")).toBe(false);
  });

  it("keeps voice control available when the privacy sentence is hidden", () => {
    render(
      <LocalVisionPrivacyBar
        cameraBusy={false}
        cameraEnabled
        personDetected={false}
        showPrivacyNotice={false}
        status="live"
        voiceBusy={false}
        voiceMuted
        onToggleCamera={() => undefined}
        onToggleVoice={() => undefined}
      />,
    );

    expect(
      screen.queryByText("视觉模型本地运行，不会获取相关数据"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("正在本地识别")).toBeVisible();
    expect(screen.getByRole("button", { name: "开启本地语音" })).toBeEnabled();
  });

  it("maps local telemetry to a visible person-detected state", () => {
    expect(
      readLocalFrame({
        visual_target_id: 7,
        mascot_state: {
          command_id: "visual-track-7",
          target: { x: 0.75, y: 0.25 },
        },
      }),
    ).toEqual({
      commandId: "visual-track-7",
      lookTarget: { x: -0.75, y: 0.25 },
      personDetected: true,
      proximityGreetingEventId: null,
    });
  });

  it("accepts only a played proximity greeting as the entry trigger", () => {
    expect(
      readLocalFrame({
        visual_target_id: 7,
        mascot_state: {
          command_id: "visual-track-7",
          target: { x: 0, y: 0 },
        },
        voice_event: {
          event_id: "voice-1",
          status: "PLAYED",
          clip_id: "proximity_greeting",
        },
      })?.proximityGreetingEventId,
    ).toBe("voice-1");
  });

  it("recovers a played greeting after the frontend reconnects", () => {
    expect(
      readLocalFrame({
        visual_target_id: 7,
        mascot_state: {
          command_id: "visual-track-7",
          target: { x: 0, y: 0 },
        },
        voice_event: {
          event_id: null,
          status: "NONE",
          clip_id: null,
        },
        voice_journey: {
          interaction_id: "near-7",
          completed_stages: ["PROXIMITY_GREETING"],
        },
      })?.proximityGreetingEventId,
    ).toBe("proximity-greeting:near-7");
  });

  it("offers a temporary control that actually requests camera shutdown", () => {
    const onToggleCamera = vi.fn();
    render(
      <LocalVisionPrivacyBar
        cameraBusy={false}
        cameraEnabled
        personDetected
        showPrivacyNotice={false}
        status="live"
        voiceBusy={false}
        voiceMuted
        onToggleCamera={onToggleCamera}
        onToggleVoice={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "关闭摄像头（临时功能）" }),
    );
    expect(onToggleCamera).toHaveBeenCalledOnce();
  });

  it("shows the stopped state and a camera restart action", () => {
    render(
      <LocalVisionPrivacyBar
        cameraBusy={false}
        cameraEnabled={false}
        personDetected={false}
        showPrivacyNotice={false}
        status="camera-off"
        voiceBusy={false}
        voiceMuted
        onToggleCamera={() => undefined}
        onToggleVoice={() => undefined}
      />,
    );

    expect(screen.getByText("摄像头已关闭")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新开启摄像头" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "开启本地语音" })).toBeDisabled();
  });
});
