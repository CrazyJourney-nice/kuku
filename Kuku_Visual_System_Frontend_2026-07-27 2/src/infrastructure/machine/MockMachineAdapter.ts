import type {
  BrewStage,
  MachineOrderStatus,
  SubmitOrderRequest,
} from "../../domain/order";
import type { MachineAdapter } from "./MachineAdapter";
import {
  type MachineEvent,
  type MachineSnapshot,
  type SubmitOrderResult,
  validateSubmitOrderRequest,
} from "./machineProtocol";

export type MockScenario =
  | "normal"
  | "rejected"
  | "unknown"
  | "failure"
  | "disconnect"
  | "out-of-order"
  | "sold-out";

export type MockMachineAdapterOptions = {
  scenario?: MockScenario;
  autoAdvance?: boolean;
  stepDelayMs?: number;
  now?: () => number;
  storage?: MockMachineStorage | null;
  storageKey?: string;
};

export interface MockMachineStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type PersistedMockOrder = {
  status: MachineOrderStatus;
  timelinePosition: number;
  idempotencyKey: string;
  scenario: MockScenario;
};

type PersistedMockState = {
  schemaVersion: 1;
  orderCounter: number;
  orders: PersistedMockOrder[];
};

type TimelineEntry =
  | { kind: "status"; stage: BrewStage; progress: number; errorCode?: string }
  | { kind: "connected"; connected: boolean };

const timelines: Readonly<Record<MockScenario, readonly TimelineEntry[]>> = {
  normal: [
    { kind: "status", stage: "grinding", progress: 20 },
    { kind: "status", stage: "extracting", progress: 55 },
    { kind: "status", stage: "dispensing", progress: 86 },
    { kind: "status", stage: "completed", progress: 100 },
  ],
  rejected: [],
  unknown: [
    { kind: "status", stage: "grinding", progress: 20 },
    { kind: "status", stage: "extracting", progress: 56 },
    { kind: "status", stage: "dispensing", progress: 88 },
    { kind: "status", stage: "completed", progress: 100 },
  ],
  failure: [
    { kind: "status", stage: "grinding", progress: 18 },
    {
      kind: "status",
      stage: "failed",
      progress: 18,
      errorCode: "MOCK_GRINDER_FAULT",
    },
  ],
  disconnect: [
    { kind: "status", stage: "grinding", progress: 18 },
    { kind: "connected", connected: false },
    { kind: "connected", connected: true },
    { kind: "status", stage: "extracting", progress: 52 },
    { kind: "status", stage: "dispensing", progress: 84 },
    { kind: "status", stage: "completed", progress: 100 },
  ],
  "out-of-order": [
    { kind: "status", stage: "extracting", progress: 60 },
    { kind: "status", stage: "grinding", progress: 22 },
    { kind: "status", stage: "dispensing", progress: 85 },
    { kind: "status", stage: "completed", progress: 100 },
  ],
  "sold-out": [],
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation aborted", "AbortError");
}

function browserStorage(): MockMachineStorage | null {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isScenario(value: unknown): value is MockScenario {
  return [
    "normal",
    "rejected",
    "unknown",
    "failure",
    "disconnect",
    "out-of-order",
    "sold-out",
  ].includes(value as MockScenario);
}

export class MockMachineAdapter implements MachineAdapter {
  readonly scenario: MockScenario;
  private readonly autoAdvance: boolean;
  private readonly stepDelayMs: number;
  private readonly now: () => number;
  private readonly listeners = new Set<(event: MachineEvent) => void>();
  private readonly orders = new Map<string, MachineOrderStatus>();
  private readonly timelinePositions = new Map<string, number>();
  private readonly orderScenarios = new Map<string, MockScenario>();
  private readonly idempotency = new Map<string, string>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private connected = true;
  private disposed = false;
  private orderCounter = 0;
  private readonly storage: MockMachineStorage | null;
  private readonly storageKey: string;
  private readonly scheduledOrders = new Set<string>();

  constructor(options: MockMachineAdapterOptions = {}) {
    this.scenario = options.scenario ?? "normal";
    this.autoAdvance = options.autoAdvance ?? true;
    this.stepDelayMs = options.stepDelayMs ?? 350;
    this.now = options.now ?? (() => Date.now());
    this.storage = options.storage === undefined ? browserStorage() : options.storage;
    this.storageKey = options.storageKey ?? "kuku.mock-machine.v1";
    this.restorePersistentState();
  }

  async initialize(signal?: AbortSignal): Promise<MachineSnapshot> {
    throwIfAborted(signal);
    this.assertActive();
    if (this.autoAdvance) {
      for (const [clientOrderId, status] of this.orders) {
        if (
          status.stage !== "completed" &&
          status.stage !== "failed" &&
          status.stage !== "cancelled"
        ) {
          this.scheduleTimeline(clientOrderId);
        }
      }
    }
    return this.getSnapshot(signal);
  }

  async getSnapshot(signal?: AbortSignal): Promise<MachineSnapshot> {
    throwIfAborted(signal);
    this.assertActive();
    const available = this.scenario !== "sold-out";
    const updatedAt = this.isoNow();
    return {
      connected: this.connected,
      ready: this.connected && available,
      ...(available ? {} : { reason: "当前饮品暂不可制作" }),
      updatedAt,
      inventory: {
        updatedAt,
        drinks: {
          americano: available,
          latte: available,
          mocha: available,
        },
        supplies: {
          cups: available,
          beans: available,
          water: available,
          milk: available,
        },
      },
    };
  }

  async submitOrder(
    request: SubmitOrderRequest,
    signal?: AbortSignal,
  ): Promise<SubmitOrderResult> {
    throwIfAborted(signal);
    this.assertActive();
    const invalid = validateSubmitOrderRequest(request);
    if (invalid) {
      return {
        status: "rejected",
        code: invalid,
        userMessage: "订单信息有误，请重新确认",
      };
    }

    const existingMachineId = this.idempotency.get(request.idempotencyKey);
    if (existingMachineId) {
      return { status: "accepted", machineOrderId: existingMachineId };
    }
    if (this.scenario === "rejected") {
      return {
        status: "rejected",
        code: "MOCK_REJECTED",
        userMessage: "机器暂时无法制作这杯饮品，请重新选择",
      };
    }
    if (this.scenario === "sold-out") {
      return {
        status: "rejected",
        code: "MOCK_SOLD_OUT",
        userMessage: "当前饮品暂不可制作",
      };
    }

    const machineOrderId = `mock-machine-${++this.orderCounter}`;
    this.idempotency.set(request.idempotencyKey, machineOrderId);
    this.orders.set(request.clientOrderId, {
      machineOrderId,
      clientOrderId: request.clientOrderId,
      stage: "queued",
      progress: 0,
      updatedAt: this.isoNow(),
      recoverable: true,
    });
    this.timelinePositions.set(request.clientOrderId, 0);
    this.orderScenarios.set(request.clientOrderId, this.scenario);
    this.persistState(request.clientOrderId, request.idempotencyKey);
    if (this.autoAdvance) this.scheduleTimeline(request.clientOrderId);

    return this.scenario === "unknown"
      ? { status: "unknown", retryAfterMs: this.stepDelayMs }
      : { status: "accepted", machineOrderId };
  }

  async getOrderStatus(
    clientOrderId: string,
    signal?: AbortSignal,
  ): Promise<MachineOrderStatus | null> {
    throwIfAborted(signal);
    this.assertActive();
    return this.orders.get(clientOrderId) ?? null;
  }

  subscribe(listener: (event: MachineEvent) => void): () => void {
    this.assertActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Advances one deterministic scenario event. This is the preferred test API
   * when fake timers are not installed.
   */
  advance(clientOrderId?: string): MachineEvent | null {
    this.assertActive();
    const orderId = clientOrderId ?? this.orders.keys().next().value;
    if (!orderId) return null;
    const status = this.orders.get(orderId);
    if (!status) return null;
    const position = this.timelinePositions.get(orderId) ?? 0;
    const scenario = this.orderScenarios.get(orderId) ?? this.scenario;
    const entry = timelines[scenario][position];
    if (!entry) return null;
    this.timelinePositions.set(orderId, position + 1);
    return this.applyTimelineEntry(orderId, entry);
  }

  simulateCupRemoved(clientOrderId: string): void {
    const status = this.orders.get(clientOrderId);
    if (!status || status.stage !== "completed") return;
    this.emit({
      type: "cup_removed",
      machineOrderId: status.machineOrderId,
      at: this.isoNow(),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.scheduledOrders.clear();
    this.listeners.clear();
  }

  private scheduleTimeline(clientOrderId: string): void {
    if (this.scheduledOrders.has(clientOrderId)) return;
    const scenario = this.orderScenarios.get(clientOrderId) ?? this.scenario;
    const position = this.timelinePositions.get(clientOrderId) ?? 0;
    const remainingTimeline = timelines[scenario].slice(position);
    if (remainingTimeline.length === 0) return;
    this.scheduledOrders.add(clientOrderId);
    remainingTimeline.forEach((_entry, index) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (!this.disposed) this.advance(clientOrderId);
        if (index === remainingTimeline.length - 1) {
          this.scheduledOrders.delete(clientOrderId);
        }
      }, this.stepDelayMs * (index + 1));
      this.timers.add(timer);
    });
  }

  private applyTimelineEntry(
    clientOrderId: string,
    entry: TimelineEntry,
  ): MachineEvent {
    if (entry.kind === "connected") {
      this.connected = entry.connected;
      const event: MachineEvent = {
        type: "connection_changed",
        connected: entry.connected,
      };
      this.emit(event);
      this.persistState();
      return event;
    }
    const previous = this.orders.get(clientOrderId);
    if (!previous) throw new Error("Unknown mock order");
    const next: MachineOrderStatus = {
      ...previous,
      stage: entry.stage,
      progress: entry.progress,
      updatedAt: this.isoNow(),
      recoverable: entry.stage !== "failed" && entry.stage !== "cancelled",
      ...(entry.errorCode ? { errorCode: entry.errorCode } : {}),
    };
    this.orders.set(clientOrderId, next);
    this.persistState();
    const event: MachineEvent = { type: "order_status", payload: next };
    this.emit(event);
    return event;
  }

  private emit(event: MachineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private isoNow(): string {
    return new Date(this.now()).toISOString();
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("MockMachineAdapter has been disposed");
  }

  private restorePersistentState(): void {
    if (!this.storage) return;
    try {
      const encoded = this.storage.getItem(this.storageKey);
      if (!encoded) return;
      const parsed = JSON.parse(encoded) as Partial<PersistedMockState>;
      if (
        parsed.schemaVersion !== 1 ||
        typeof parsed.orderCounter !== "number" ||
        !Number.isInteger(parsed.orderCounter) ||
        !Array.isArray(parsed.orders)
      ) {
        this.storage.removeItem(this.storageKey);
        return;
      }
      this.orderCounter = parsed.orderCounter;
      for (const entry of parsed.orders) {
        if (
          !entry ||
          !isScenario(entry.scenario) ||
          typeof entry.idempotencyKey !== "string" ||
          !Number.isInteger(entry.timelinePosition) ||
          !entry.status ||
          typeof entry.status.clientOrderId !== "string" ||
          typeof entry.status.machineOrderId !== "string"
        ) {
          continue;
        }
        const clientOrderId = entry.status.clientOrderId;
        this.orders.set(clientOrderId, entry.status);
        this.timelinePositions.set(clientOrderId, entry.timelinePosition);
        this.orderScenarios.set(clientOrderId, entry.scenario);
        this.idempotency.set(
          entry.idempotencyKey,
          entry.status.machineOrderId,
        );
      }
    } catch {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Persistence is best-effort in mock mode.
      }
    }
  }

  private persistState(
    currentClientOrderId?: string,
    currentIdempotencyKey?: string,
  ): void {
    if (!this.storage) return;
    try {
      const existingKeyByMachineId = new Map<string, string>();
      for (const [key, machineId] of this.idempotency) {
        existingKeyByMachineId.set(machineId, key);
      }
      const entries: PersistedMockOrder[] = Array.from(this.orders.entries())
        .slice(-20)
        .map(([clientOrderId, status]) => ({
          status,
          timelinePosition: this.timelinePositions.get(clientOrderId) ?? 0,
          scenario: this.orderScenarios.get(clientOrderId) ?? this.scenario,
          idempotencyKey:
            clientOrderId === currentClientOrderId && currentIdempotencyKey
              ? currentIdempotencyKey
              : existingKeyByMachineId.get(status.machineOrderId) ??
                `recovered:${clientOrderId}`,
        }));
      const state: PersistedMockState = {
        schemaVersion: 1,
        orderCounter: this.orderCounter,
        orders: entries,
      };
      this.storage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // Mock persistence must never make the ordering flow fail.
    }
  }
}
