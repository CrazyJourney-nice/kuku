import type {
  DrinkId,
  MachineOrderStatus,
  SubmitOrderRequest,
} from "../../domain/order";

export type InventorySnapshot = {
  updatedAt: string;
  drinks: Readonly<Record<DrinkId, boolean>>;
  supplies: {
    cups: boolean;
    beans: boolean;
    water: boolean;
    milk: boolean;
  };
};

export type MachineSnapshot = {
  connected: boolean;
  ready: boolean;
  reason?: string;
  inventory: InventorySnapshot;
  updatedAt: string;
};

export type MachineEvent =
  | { type: "ready_changed"; ready: boolean; reason?: string }
  | { type: "inventory_changed"; snapshot: InventorySnapshot }
  | { type: "order_status"; payload: MachineOrderStatus }
  | { type: "cup_removed"; machineOrderId: string; at: string }
  | { type: "fault"; severity: "warning" | "fatal"; code: string }
  | { type: "connection_changed"; connected: boolean };

export type SubmitOrderResult =
  | { status: "accepted"; machineOrderId: string }
  | { status: "rejected"; code: string; userMessage: string }
  | { status: "unknown"; retryAfterMs: number };

export function isMachineOrderStatus(value: unknown): value is MachineOrderStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const stages = new Set([
    "queued",
    "grinding",
    "extracting",
    "dispensing",
    "completed",
    "failed",
    "cancelled",
  ]);
  return (
    typeof candidate.machineOrderId === "string" &&
    typeof candidate.clientOrderId === "string" &&
    typeof candidate.stage === "string" &&
    stages.has(candidate.stage) &&
    typeof candidate.updatedAt === "string" &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    typeof candidate.recoverable === "boolean" &&
    (candidate.progress === undefined ||
      (typeof candidate.progress === "number" &&
        Number.isFinite(candidate.progress) &&
        candidate.progress >= 0 &&
        candidate.progress <= 100))
  );
}

export function validateSubmitOrderRequest(
  request: SubmitOrderRequest,
): string | null {
  if (!request.clientOrderId.trim()) return "missing_client_order_id";
  if (!request.idempotencyKey.trim()) return "missing_idempotency_key";
  if (!Number.isFinite(Date.parse(request.submittedAt))) {
    return "invalid_submitted_at";
  }
  if (!Number.isInteger(request.order.totalPriceCents)) {
    return "invalid_price";
  }
  return null;
}
