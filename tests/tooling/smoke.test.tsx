import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function ToolingProbe() {
  return <button type="button">开始点单</button>;
}

describe("test tooling", () => {
  it("renders React components with accessible queries", () => {
    render(<ToolingProbe />);

    expect(
      screen.getByRole("button", { name: "开始点单" }),
    ).toBeInTheDocument();
  });
});
