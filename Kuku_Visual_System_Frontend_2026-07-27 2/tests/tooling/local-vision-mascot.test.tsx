import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KukuStage } from "@/src/components/mascot/KukuStage";
import { LocalVisionPrivacyBar } from "@/src/features/localVision/LocalVisionPrivacyBar";

describe("local vision mascot integration", () => {
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
  });

  it("keeps the original closed-eye celebration artwork", () => {
    render(<KukuStage cue="celebrate" lookTarget={{ x: 0.4, y: 0.2 }} />);

    expect(screen.queryByTestId("mascot-tracked-eyes")).not.toBeInTheDocument();
  });

  it("shows the local privacy promise and explicit voice control", () => {
    render(
      <LocalVisionPrivacyBar
        status="live"
        voiceBusy={false}
        voiceMuted
        onToggleVoice={() => undefined}
      />,
    );

    expect(
      screen.getByText("视觉模型本地运行，不会获取相关数据"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "开启本地语音" })).toBeEnabled();
  });
});
