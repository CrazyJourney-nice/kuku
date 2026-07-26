import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const api = vi.hoisted(() => ({
  getHealth: vi.fn(),
  setMode: vi.fn(),
  stopSession: vi.fn(),
  setVoiceMuted: vi.fn(),
  reportEyeSettled: vi.fn(),
}));

vi.mock("./api", () => ({ demoApi: api }));
vi.mock("./hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    packet: null,
    connection: "CONNECTED",
    error: null,
    isFixture: false,
  }),
}));

describe("simple demo controls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    api.getHealth.mockResolvedValue({ status: "STOPPED", mode: "LIVE", voice_muted: true });
    api.setVoiceMuted.mockResolvedValue({ muted: true });
    api.setMode.mockResolvedValue({ started: true });
    api.stopSession.mockResolvedValue({ stopped: true });
  });

  it("shows only the single Open demo control when stopped", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Open demo" })).toBeEnabled();
    expect(screen.getByText("Camera is off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preflight/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /configuration/i })).not.toBeInTheDocument();
  });

  it("opens and closes the Live camera without simulator actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Open demo" }));
    expect(api.setMode).toHaveBeenCalledWith("LIVE");
    expect(screen.getByRole("button", { name: "Close demo" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Close demo" }));
    await waitFor(() => expect(api.stopSession).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Open demo" })).toBeEnabled();
  });

  it("lets the operator explicitly enable local sound", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(api.setVoiceMuted).toHaveBeenCalledWith(false));
    expect(screen.getByRole("button", { name: "Mute sound" })).toBeEnabled();
  });

  it("reflects an already-running Live session without restarting it", async () => {
    api.getHealth.mockResolvedValue({ status: "RUNNING", mode: "LIVE" });
    render(<App />);

    expect(await screen.findByRole("button", { name: "Close demo" })).toBeEnabled();
    expect(api.setMode).not.toHaveBeenCalled();
  });
});
