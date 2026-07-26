import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMPACT_ENTRY_CANCEL_COOLDOWN_MS,
  IMPACT_ENTRY_COUNTDOWN_SECONDS,
  IMPACT_EYE_OPEN_MS,
  useImpactVoiceEntry,
} from "@/src/features/localVision/useImpactVoiceEntry";

function ImpactEntryHarness({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const entry = useImpactVoiceEntry({
    active: true,
    greetingEventId: "proximity-greeting-1",
    onComplete,
  });

  return (
    <div>
      <output data-testid="phase">{entry.phase}</output>
      <output data-testid="remaining">{entry.remainingSeconds}</output>
      <output data-testid="eyes-visible">
        {entry.eyesVisible ? "open" : "closed"}
      </output>
      <button type="button" onClick={entry.cancel}>
        取消
      </button>
    </div>
  );
}

describe("impact voice entry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens for three seconds, counts down for ten, then enters", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<ImpactEntryHarness onComplete={onComplete} />);

    expect(screen.getByTestId("phase")).toHaveTextContent("opening");
    expect(screen.getByTestId("eyes-visible")).toHaveTextContent("open");

    act(() => vi.advanceTimersByTime(IMPACT_EYE_OPEN_MS));
    expect(screen.getByTestId("phase")).toHaveTextContent("countdown");
    expect(screen.getByTestId("remaining")).toHaveTextContent(
      String(IMPACT_ENTRY_COUNTDOWN_SECONDS),
    );

    act(() =>
      vi.advanceTimersByTime(IMPACT_ENTRY_COUNTDOWN_SECONDS * 1_000),
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("keeps the eyes open and prompts again after a two-minute cancel", () => {
    vi.useFakeTimers();
    render(<ImpactEntryHarness onComplete={() => undefined} />);

    act(() => vi.advanceTimersByTime(IMPACT_EYE_OPEN_MS));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.getByTestId("phase")).toHaveTextContent("cooldown");
    expect(screen.getByTestId("eyes-visible")).toHaveTextContent("open");

    act(() => vi.advanceTimersByTime(IMPACT_ENTRY_CANCEL_COOLDOWN_MS));
    expect(screen.getByTestId("phase")).toHaveTextContent("countdown");
    expect(screen.getByTestId("remaining")).toHaveTextContent(
      String(IMPACT_ENTRY_COUNTDOWN_SECONDS),
    );
    expect(screen.getByTestId("eyes-visible")).toHaveTextContent("open");
  });
});
