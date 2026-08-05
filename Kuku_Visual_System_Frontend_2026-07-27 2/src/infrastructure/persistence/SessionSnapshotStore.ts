import type {
  MachineOrderStatus,
  OrderSnapshot,
} from "../../domain/order";
import {
  createInitialContext,
  type KioskContext,
  type KioskTransitionDependencies,
} from "../../domain/kioskState";
import { isMachineOrderStatus } from "../machine/machineProtocol";

export type RecoverySnapshot = {
  schemaVersion: 1;
  savedAt: string;
  clientOrderId: string;
  machineOrderId: string | null;
  submittedOrder: OrderSnapshot;
  lastKnownStatus: MachineOrderStatus | null;
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RecoverySnapshotStoreOptions = {
  storage?: KeyValueStorage | null;
  key?: string;
  ttlMs?: number;
  now?: () => number;
  onDegraded?: (reason: string) => void;
};

const DEFAULT_KEY = "kuku.recovery.v1";
const TEMP_SUFFIX = ".pending";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export class MemoryKeyValueStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export function getBrowserKeyValueStorage(): KeyValueStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    const probe = "kuku.storage.probe";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isCustomization(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    [0, 30, 50].includes(item.sweetness as number) &&
    ["hot", "iced"].includes(item.temperature as string) &&
    ["none", "dairy", "oat"].includes(item.milkBase as string) &&
    ["none", "star", "heart", "smile", "custom"].includes(
      item.latteArt as string,
    )
  );
}

export function isRecoverySnapshot(value: unknown): value is RecoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const order = item.submittedOrder as Record<string, unknown> | undefined;
  return (
    item.schemaVersion === 1 &&
    typeof item.savedAt === "string" &&
    Number.isFinite(Date.parse(item.savedAt)) &&
    typeof item.clientOrderId === "string" &&
    item.clientOrderId.length > 0 &&
    (item.machineOrderId === null || typeof item.machineOrderId === "string") &&
    !!order &&
    ["americano", "latte", "mocha"].includes(order.drinkId as string) &&
    typeof order.drinkName === "string" &&
    typeof order.tagline === "string" &&
    Number.isInteger(order.unitPriceCents) &&
    order.quantity === 1 &&
    Number.isInteger(order.totalPriceCents) &&
    isCustomization(order.customization) &&
    (item.lastKnownStatus === null ||
      isMachineOrderStatus(item.lastKnownStatus))
  );
}

export class RecoverySnapshotStore {
  private storage: KeyValueStorage;
  private readonly key: string;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly onDegraded?: (reason: string) => void;

  constructor(options: RecoverySnapshotStoreOptions = {}) {
    this.onDegraded = options.onDegraded;
    const preferred =
      options.storage === undefined
        ? getBrowserKeyValueStorage()
        : options.storage;
    this.storage = preferred ?? new MemoryKeyValueStorage();
    if (!preferred) this.onDegraded?.("persistent_storage_unavailable");
    this.key = options.key ?? DEFAULT_KEY;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  save(snapshot: RecoverySnapshot): void {
    if (!isRecoverySnapshot(snapshot)) {
      throw new TypeError("Invalid recovery snapshot");
    }
    const encoded = JSON.stringify(snapshot);
    this.withFallback((storage) => {
      // A pending key makes interrupted writes distinguishable from a valid
      // last-known snapshot. The canonical key is only replaced after encode.
      storage.setItem(`${this.key}${TEMP_SUFFIX}`, encoded);
      storage.setItem(this.key, encoded);
      storage.removeItem(`${this.key}${TEMP_SUFFIX}`);
    });
  }

  load(): RecoverySnapshot | null {
    const encoded = this.withFallback((storage) => storage.getItem(this.key));
    if (!encoded) return null;
    try {
      const decoded: unknown = JSON.parse(encoded);
      if (!isRecoverySnapshot(decoded)) {
        this.clear();
        this.onDegraded?.("recovery_snapshot_invalid");
        return null;
      }
      if (this.now() - Date.parse(decoded.savedAt) > this.ttlMs) {
        this.clear();
        this.onDegraded?.("recovery_snapshot_expired");
        return null;
      }
      return decoded;
    } catch {
      this.clear();
      this.onDegraded?.("recovery_snapshot_corrupt");
      return null;
    }
  }

  clear(): void {
    this.withFallback((storage) => {
      storage.removeItem(this.key);
      storage.removeItem(`${this.key}${TEMP_SUFFIX}`);
    });
  }

  private withFallback<T>(operation: (storage: KeyValueStorage) => T): T {
    try {
      return operation(this.storage);
    } catch {
      this.onDegraded?.("persistent_storage_operation_failed");
      this.storage = new MemoryKeyValueStorage();
      return operation(this.storage);
    }
  }
}

export function createRecoverySnapshot(
  context: KioskContext,
  now: () => number = () => Date.now(),
): RecoverySnapshot | null {
  if (!context.clientOrderId || !context.submittedOrder) return null;
  return {
    schemaVersion: 1,
    savedAt: new Date(now()).toISOString(),
    clientOrderId: context.clientOrderId,
    machineOrderId: context.machineOrderId,
    submittedOrder: context.submittedOrder,
    lastKnownStatus: context.machineStatus,
  };
}

export function createRecoveringContext(
  snapshot: RecoverySnapshot,
  dependencies: Partial<KioskTransitionDependencies> = {},
): KioskContext {
  if (!isRecoverySnapshot(snapshot)) {
    throw new TypeError("Invalid recovery snapshot");
  }
  const initial = createInitialContext(dependencies);
  return {
    ...initial,
    screen: "recovering",
    navigationDirection: "replace",
    submittedOrder: snapshot.submittedOrder,
    selectedDrinkId: snapshot.submittedOrder.drinkId,
    customization: { ...snapshot.submittedOrder.customization },
    orderDraft: {
      drinkId: snapshot.submittedOrder.drinkId,
      customization: { ...snapshot.submittedOrder.customization },
    },
    clientOrderId: snapshot.clientOrderId,
    // The idempotency key is deterministic so an uncertain submit can only
    // ever query/reconcile the original order, never mint a second identity.
    idempotencyKey: `kuku-order:${snapshot.clientOrderId}`,
    submittedAt: snapshot.savedAt,
    machineOrderId: snapshot.machineOrderId,
    machineStatus: snapshot.lastKnownStatus,
    recoveryReason: "startup_snapshot",
  };
}
