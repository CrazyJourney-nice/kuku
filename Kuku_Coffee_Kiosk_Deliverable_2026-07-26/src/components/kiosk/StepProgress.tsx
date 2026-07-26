import type { CSSProperties } from "react";

const steps = ["饮品", "定制", "确认", "制作", "取杯"] as const;
const progressByStep = {
  1: 0,
  2: 0.3,
  3: 0.5,
  4: 0.7,
  5: 1,
} as const;

type StepProgressProps = {
  current: 1 | 2 | 3 | 4 | 5;
};

export function StepProgress({ current }: StepProgressProps) {
  return (
    <nav
      className="step-progress"
      aria-label={`当前第 ${current} 步，共 5 步：${steps[current - 1]}`}
      style={{ "--step-progress": progressByStep[current] } as CSSProperties}
    >
      <div className="step-progress__track" aria-hidden="true">
        <span />
      </div>
      <ol>
        {steps.map((label, index) => {
          const step = (index + 1) as StepProgressProps["current"];
          const completed = step < current;
          return (
            <li
              key={label}
              className={
                completed
                  ? "step-progress__item is-complete"
                  : step === current
                    ? "step-progress__item is-current"
                    : "step-progress__item"
              }
              aria-current={step === current ? "step" : undefined}
            >
              <span className="step-progress__number" aria-hidden="true">
                {completed ? "✓" : step}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
