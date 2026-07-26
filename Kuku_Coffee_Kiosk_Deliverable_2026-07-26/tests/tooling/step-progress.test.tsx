import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepProgress } from "@/src/components/kiosk/StepProgress";

describe("StepProgress", () => {
  it.each([
    [1, "饮品", "0"],
    [2, "定制", "0.3"],
    [3, "确认", "0.5"],
    [4, "制作", "0.7"],
    [5, "取杯", "1"],
  ] as const)(
    "aligns the step %s progress fill with its marker",
    (current, label, progress) => {
      render(<StepProgress current={current} />);

      expect(
        screen.getByRole("navigation", {
          name: `当前第 ${current} 步，共 5 步：${label}`,
        }),
      ).toHaveStyle(`--step-progress: ${progress}`);
    },
  );
});
