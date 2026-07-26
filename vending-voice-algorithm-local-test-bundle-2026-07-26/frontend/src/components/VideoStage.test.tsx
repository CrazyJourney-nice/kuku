import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeFixturePacket } from "../fixture";
import { VideoStage } from "./VideoStage";

describe("VideoStage frame alignment", () => {
  it("binds image, overlay and state to the same packet frame", () => {
    const packet = makeFixturePacket(921);
    render(<VideoStage connectionStale={false} isFixture packet={packet} />);
    expect(screen.getByLabelText(/frame 921/i)).toBeInTheDocument();
    expect(screen.getByTestId("frame-alignment")).toHaveTextContent(
      "Frame 921; overlay frame 921; state frame 921; visual target 17; attention target 17",
    );
  });

  it("shows an explicit loading state before local telemetry arrives", () => {
    render(<VideoStage connectionStale={false} isFixture={false} packet={null} />);
    expect(screen.getByText("Waiting for local inference")).toBeInTheDocument();
  });
});
