import type { BrewStage, MachineOrderStatus } from "./order";

const stageFloor: Readonly<Record<BrewStage, number>> = {
  queued: 0,
  grinding: 8,
  extracting: 35,
  dispensing: 75,
  completed: 100,
  failed: 0,
  cancelled: 0,
};

const stageCeiling: Readonly<Record<BrewStage, number>> = {
  queued: 8,
  grinding: 35,
  extracting: 75,
  dispensing: 95,
  completed: 100,
  failed: 100,
  cancelled: 100,
};

const stageOrder: Readonly<Record<BrewStage, number>> = {
  queued: 0,
  grinding: 1,
  extracting: 2,
  dispensing: 3,
  completed: 4,
  failed: 5,
  cancelled: 5,
};

export type StatusMergeResult =
  | { accepted: true; status: MachineOrderStatus; anomaly?: string }
  | { accepted: false; reason: "order_mismatch" | "stale_timestamp" };

export function stageProgress(stage: BrewStage, progress?: number): number {
  if (stage === "completed") return 100;
  if (progress === undefined || !Number.isFinite(progress)) {
    return stageFloor[stage];
  }
  return Math.min(stageCeiling[stage], Math.max(stageFloor[stage], progress));
}

export function mergeMachineStatus(
  previous: MachineOrderStatus | null,
  incoming: MachineOrderStatus,
  expected: { clientOrderId: string; machineOrderId?: string | null },
): StatusMergeResult {
  if (
    incoming.clientOrderId !== expected.clientOrderId ||
    (expected.machineOrderId != null &&
      incoming.machineOrderId !== expected.machineOrderId)
  ) {
    return { accepted: false, reason: "order_mismatch" };
  }

  if (
    previous &&
    Date.parse(incoming.updatedAt) < Date.parse(previous.updatedAt)
  ) {
    return { accepted: false, reason: "stale_timestamp" };
  }

  const previousProgress = previous
    ? stageProgress(previous.stage, previous.progress)
    : 0;
  const incomingProgress = stageProgress(incoming.stage, incoming.progress);
  const terminal = incoming.stage === "failed" || incoming.stage === "cancelled";
  const normalizedProgress = terminal
    ? previousProgress
    : Math.max(previousProgress, incomingProgress);

  const stageRegressed =
    previous !== null &&
    !terminal &&
    stageOrder[incoming.stage] < stageOrder[previous.stage];
  const progressRegressed = incomingProgress < previousProgress;

  return {
    accepted: true,
    status: {
      ...incoming,
      progress: normalizedProgress,
      stage: stageRegressed && previous ? previous.stage : incoming.stage,
    },
    ...(stageRegressed || progressRegressed
      ? { anomaly: "machine_progress_regressed" }
      : {}),
  };
}
