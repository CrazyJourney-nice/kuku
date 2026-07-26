import {
  getBrowserKeyValueStorage,
  MemoryKeyValueStorage,
  type KeyValueStorage,
} from "../persistence/SessionSnapshotStore";

export type KioskLogEventName =
  | "app_started"
  | "machine_ready_changed"
  | "screen_entered"
  | "drink_selected"
  | "customization_changed"
  | "order_submit_started"
  | "order_submit_result"
  | "brew_stage_changed"
  | "cup_removed"
  | "session_completed"
  | "session_idle_reset"
  | "recovery_started"
  | "recovery_result"
  | "frontend_error"
  | "asset_fallback_used"
  | "mascot_renderer_fallback";

export type KioskLogLevel = "info" | "warning" | "error";

export type KioskLogEntry = {
  timestamp: string;
  name: KioskLogEventName;
  level: KioskLogLevel;
  appVersion: string;
  deviceId: string;
  sessionId?: string;
  screen?: string;
  orderRef?: string;
  errorCode?: string;
  durationMs?: number;
  offline?: boolean;
  details?: Readonly<Record<string, string | number | boolean | null>>;
};

export type KioskLoggerOptions = {
  appVersion: string;
  deviceId: string;
  storage?: KeyValueStorage;
  key?: string;
  maxEntries?: number;
  maxBytes?: number;
  now?: () => number;
};

const sensitiveKeyPattern =
  /(token|secret|password|camera|frame|face|landmark|email|phone|payment)/i;

function safeDetails(
  details: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!details) return undefined;
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeyPattern.test(key)) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      output[key] =
        typeof value === "string" && value.length > 256
          ? `${value.slice(0, 253)}...`
          : value;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function shortOrderReference(orderId?: string): string | undefined {
  if (!orderId) return undefined;
  return orderId.slice(-6);
}

export class KioskLogger {
  private storage: KeyValueStorage;
  private readonly key: string;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly now: () => number;
  private readonly appVersion: string;
  private readonly deviceId: string;
  private entries: KioskLogEntry[];

  constructor(options: KioskLoggerOptions) {
    this.storage =
      options.storage ?? getBrowserKeyValueStorage() ?? new MemoryKeyValueStorage();
    this.key = options.key ?? "kuku.telemetry.v1";
    this.maxEntries = options.maxEntries ?? 500;
    this.maxBytes = options.maxBytes ?? 256_000;
    this.now = options.now ?? (() => Date.now());
    this.appVersion = options.appVersion;
    this.deviceId = options.deviceId;
    this.entries = this.readStored();
  }

  log(
    name: KioskLogEventName,
    fields: {
      level?: KioskLogLevel;
      sessionId?: string;
      screen?: string;
      clientOrderId?: string;
      errorCode?: string;
      durationMs?: number;
      offline?: boolean;
      details?: Record<string, unknown>;
    } = {},
  ): KioskLogEntry {
    const entry: KioskLogEntry = {
      timestamp: new Date(this.now()).toISOString(),
      name,
      level: fields.level ?? "info",
      appVersion: this.appVersion,
      deviceId: this.deviceId,
      ...(fields.sessionId ? { sessionId: fields.sessionId } : {}),
      ...(fields.screen ? { screen: fields.screen } : {}),
      ...(fields.clientOrderId
        ? { orderRef: shortOrderReference(fields.clientOrderId) }
        : {}),
      ...(fields.errorCode ? { errorCode: fields.errorCode } : {}),
      ...(fields.durationMs !== undefined
        ? { durationMs: fields.durationMs }
        : {}),
      ...(fields.offline !== undefined ? { offline: fields.offline } : {}),
      ...(safeDetails(fields.details)
        ? { details: safeDetails(fields.details) }
        : {}),
    };
    this.entries.push(entry);
    this.rotate();
    this.persist();
    return entry;
  }

  getEntries(): readonly KioskLogEntry[] {
    return this.entries.map((entry) => ({
      ...entry,
      ...(entry.details ? { details: { ...entry.details } } : {}),
    }));
  }

  clear(): void {
    this.entries = [];
    try {
      this.storage.removeItem(this.key);
    } catch {
      this.storage = new MemoryKeyValueStorage();
    }
  }

  private rotate(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    while (
      this.entries.length > 1 &&
      new TextEncoder().encode(JSON.stringify(this.entries)).byteLength >
        this.maxBytes
    ) {
      this.entries.shift();
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.entries));
    } catch {
      this.storage = new MemoryKeyValueStorage();
      this.storage.setItem(this.key, JSON.stringify(this.entries));
    }
  }

  private readStored(): KioskLogEntry[] {
    try {
      const value = this.storage.getItem(this.key);
      if (!value) return [];
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as KioskLogEntry[]) : [];
    } catch {
      return [];
    }
  }
}
