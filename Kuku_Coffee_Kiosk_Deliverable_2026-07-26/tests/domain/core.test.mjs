import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let stateModule;
let drinksModule;
let validationModule;
let progressModule;
let machineModule;
let persistenceModule;
let telemetryModule;
let idleModule;

before(async () => {
  server = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  [
    stateModule,
    drinksModule,
    validationModule,
    progressModule,
    machineModule,
    persistenceModule,
    telemetryModule,
    idleModule,
  ] = await Promise.all([
    server.ssrLoadModule("/src/domain/kioskState.ts"),
    server.ssrLoadModule("/src/content/drinks.ts"),
    server.ssrLoadModule("/src/domain/validation.ts"),
    server.ssrLoadModule("/src/domain/progress.ts"),
    server.ssrLoadModule("/src/infrastructure/machine/index.ts"),
    server.ssrLoadModule(
      "/src/infrastructure/persistence/SessionSnapshotStore.ts",
    ),
    server.ssrLoadModule("/src/infrastructure/telemetry/kioskLogger.ts"),
    server.ssrLoadModule("/src/domain/idle.ts"),
  ]);
});

after(async () => {
  await server?.close();
});

test("state machine follows the guarded order flow and freezes submission", () => {
  let time = Date.parse("2026-07-26T00:00:00.000Z");
  let id = 0;
  const deps = {
    now: () => time++,
    createId: () => `id-${++id}`,
    catalog: drinksModule.drinksById,
    isMachineReady: () => true,
  };
  let state = stateModule.createInitialContext(deps);
  const dispatch = (event) => {
    state = stateModule.transitionKiosk(state, event, deps);
    if (state.transitionLocked) {
      state = stateModule.transitionKiosk(
        state,
        { type: "TRANSITION_FINISHED" },
        deps,
      );
    }
  };

  assert.equal(state.screen, "impact");
  dispatch({ type: "MACHINE_READY_CHANGED", ready: true });
  dispatch({ type: "START_INTRO" });
  assert.equal(state.screen, "welcome");
  dispatch({ type: "START_ORDER" });
  assert.equal(state.screen, "drink");
  dispatch({ type: "CONTINUE_TO_CUSTOMIZE" });
  assert.equal(state.screen, "drink", "cannot continue without a drink");
  dispatch({ type: "SELECT_DRINK", drinkId: "latte" });
  dispatch({ type: "CONTINUE_TO_CUSTOMIZE" });
  dispatch({ type: "CONTINUE_TO_CONFIRM" });
  dispatch({ type: "SUBMIT_ORDER" });
  assert.equal(state.screen, "submitting");
  assert.equal(state.submittedOrder.drinkId, "latte");
  assert.ok(Object.isFrozen(state.submittedOrder));
  assert.ok(Object.isFrozen(state.submittedOrder.customization));
  const identity = [state.clientOrderId, state.idempotencyKey];
  dispatch({ type: "SUBMIT_ORDER" });
  assert.deepEqual(
    [state.clientOrderId, state.idempotencyKey],
    identity,
    "repeat submit cannot mint another identity",
  );
  dispatch({ type: "IDLE_TIMEOUT" });
  assert.equal(state.screen, "submitting", "submitting ignores idle reset");
});

test("machine readiness and live inventory guard entry and submission", () => {
  let id = 0;
  const deps = {
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
    createId: () => `guard-${++id}`,
    catalog: drinksModule.drinksById,
    isMachineReady: () => true,
  };
  let state = stateModule.createInitialContext(deps);
  const dispatch = (event) => {
    state = stateModule.transitionKiosk(state, event, deps);
    if (state.transitionLocked) {
      state = stateModule.transitionKiosk(
        state,
        { type: "TRANSITION_FINISHED" },
        deps,
      );
    }
  };

  dispatch({ type: "START_INTRO" });
  assert.equal(state.screen, "impact", "entry is blocked before machine ready");
  dispatch({ type: "MACHINE_READY_CHANGED", ready: true });
  dispatch({ type: "START_INTRO" });
  dispatch({ type: "START_ORDER" });
  dispatch({ type: "INVENTORY_CHANGED", drinks: { latte: false } });
  dispatch({ type: "SELECT_DRINK", drinkId: "latte" });
  assert.equal(state.selectedDrinkId, null);
  dispatch({ type: "INVENTORY_CHANGED", drinks: { latte: true } });
  dispatch({ type: "SELECT_DRINK", drinkId: "latte" });
  dispatch({ type: "CONTINUE_TO_CUSTOMIZE" });
  dispatch({ type: "CONTINUE_TO_CONFIRM" });
  dispatch({ type: "INVENTORY_CHANGED", drinks: { latte: false } });
  dispatch({ type: "SUBMIT_ORDER" });
  assert.equal(state.screen, "confirm");
  assert.equal(state.clientOrderId, null);
});

test("impact start button can skip welcome and enter drink selection", () => {
  const deps = {
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
    createId: () => "direct-entry",
    catalog: drinksModule.drinksById,
    isMachineReady: () => true,
  };
  let state = stateModule.createInitialContext(deps);
  state = stateModule.transitionKiosk(
    state,
    { type: "MACHINE_READY_CHANGED", ready: true },
    deps,
  );
  state = stateModule.transitionKiosk(
    state,
    { type: "START_ORDER_DIRECT" },
    deps,
  );

  assert.equal(state.screen, "drink");
});

test("pickup completion can preempt the entrance transition lock", () => {
  const deps = {
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
    createId: () => "pickup-reset",
    catalog: drinksModule.drinksById,
    isMachineReady: () => true,
  };
  const pickup = {
    ...stateModule.createInitialContext(deps),
    screen: "pickup",
    transitionLocked: true,
    machineReady: true,
  };
  const next = stateModule.transitionKiosk(
    pickup,
    { type: "FINISH_SESSION" },
    deps,
  );
  assert.equal(next.screen, "impact");
  assert.equal(next.transitionLocked, false);
});

test("local idle test policy exposes a short warning and return cycle", () => {
  const startedAt = 10_000;
  const beforeWarning = idleModule.getIdleDecision(
    "welcome",
    startedAt,
    startedAt + 1_999,
    idleModule.localIdleTestPolicies,
  );
  const warning = idleModule.getIdleDecision(
    "welcome",
    startedAt,
    startedAt + 2_000,
    idleModule.localIdleTestPolicies,
  );
  const timeout = idleModule.getIdleDecision(
    "welcome",
    startedAt,
    startedAt + 5_000,
    idleModule.localIdleTestPolicies,
  );

  assert.equal(beforeWarning.state, "active");
  assert.deepEqual(warning, { state: "warning", remainingMs: 3_000 });
  assert.deepEqual(timeout, { state: "timeout", remainingMs: 0 });
  assert.equal(
    idleModule.getIdleDecision(
      "impact",
      startedAt,
      startedAt + 60_000,
      idleModule.localIdleTestPolicies,
    ).state,
    "inactive",
  );
});

test("frontend failures recover in-flight orders and reset safe drafts", () => {
  let id = 0;
  const deps = {
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
    createId: () => `error-${++id}`,
    catalog: drinksModule.drinksById,
    isMachineReady: () => true,
  };
  let state = stateModule.createInitialContext(deps);
  const dispatch = (event) => {
    state = stateModule.transitionKiosk(state, event, deps);
    if (state.transitionLocked) {
      state = stateModule.transitionKiosk(
        state,
        { type: "TRANSITION_FINISHED" },
        deps,
      );
    }
  };
  dispatch({ type: "MACHINE_READY_CHANGED", ready: true });
  dispatch({ type: "START_INTRO" });
  dispatch({ type: "START_ORDER" });
  dispatch({ type: "SELECT_DRINK", drinkId: "latte" });
  dispatch({ type: "CONTINUE_TO_CUSTOMIZE" });
  dispatch({ type: "CONTINUE_TO_CONFIRM" });
  dispatch({ type: "SUBMIT_ORDER" });
  dispatch({ type: "ORDER_ACCEPTED", machineOrderId: "machine-error" });
  const clientOrderId = state.clientOrderId;
  dispatch({ type: "FRONTEND_ERROR", code: "render_failed" });
  assert.equal(state.screen, "recovering");
  assert.equal(state.clientOrderId, clientOrderId);
  assert.equal(state.recoveryReason, "render_failed");

  let draft = stateModule.createInitialContext(deps);
  draft = stateModule.transitionKiosk(
    draft,
    { type: "FRONTEND_ERROR", code: "draft_failed" },
    deps,
  );
  assert.equal(draft.screen, "impact");
  assert.equal(draft.clientOrderId, null);
});

test("customization validation respects drink capabilities", () => {
  const americano = drinksModule.getDrinkById("americano");
  const result = validationModule.validateCustomization(americano, {
    sweetness: 0,
    temperature: "hot",
    milkBase: "dairy",
    latteArt: "star",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["milk_base_unsupported", "latte_art_unsupported"],
  );
});

test("machine progress is bounded, monotonic, and rejects foreign orders", () => {
  const previous = {
    machineOrderId: "machine-1",
    clientOrderId: "client-1",
    stage: "extracting",
    progress: 60,
    updatedAt: "2026-07-26T00:00:01.000Z",
    recoverable: true,
  };
  const regressed = progressModule.mergeMachineStatus(
    previous,
    {
      ...previous,
      stage: "grinding",
      progress: 20,
      updatedAt: "2026-07-26T00:00:02.000Z",
    },
    { clientOrderId: "client-1", machineOrderId: "machine-1" },
  );
  assert.equal(regressed.accepted, true);
  assert.equal(regressed.status.stage, "extracting");
  assert.equal(regressed.status.progress, 60);
  assert.equal(regressed.anomaly, "machine_progress_regressed");

  const foreign = progressModule.mergeMachineStatus(
    previous,
    { ...previous, clientOrderId: "other" },
    { clientOrderId: "client-1", machineOrderId: "machine-1" },
  );
  assert.deepEqual(foreign, { accepted: false, reason: "order_mismatch" });
});

test("mock unknown is accepted by the machine and idempotent", async () => {
  const adapter = new machineModule.MockMachineAdapter({
    scenario: "unknown",
    autoAdvance: false,
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
  });
  const order = {
    drinkId: "latte",
    drinkName: "拿铁",
    tagline: "柔和顺滑",
    unitPriceCents: 1800,
    quantity: 1,
    totalPriceCents: 1800,
    customization: {
      sweetness: 0,
      temperature: "hot",
      milkBase: "dairy",
      latteArt: "star",
    },
  };
  const request = {
    clientOrderId: "client-a",
    idempotencyKey: "same-key",
    submittedAt: "2026-07-26T00:00:00.000Z",
    order,
  };
  assert.equal((await adapter.submitOrder(request)).status, "unknown");
  assert.equal((await adapter.getOrderStatus("client-a")).stage, "queued");
  const retry = await adapter.submitOrder(request);
  assert.equal(retry.status, "accepted");
  assert.equal(retry.machineOrderId, "mock-machine-1");
  adapter.dispose();
});

test("mock machine state survives adapter replacement for reload recovery", async () => {
  const storage = new persistenceModule.MemoryKeyValueStorage();
  const options = {
    scenario: "normal",
    autoAdvance: false,
    storage,
    storageKey: "mock-reload-test",
    now: () => Date.parse("2026-07-26T00:00:00.000Z"),
  };
  const request = {
    clientOrderId: "client-reload",
    idempotencyKey: "reload-key",
    submittedAt: "2026-07-26T00:00:00.000Z",
    order: {
      drinkId: "latte",
      drinkName: "拿铁",
      tagline: "柔和顺滑",
      unitPriceCents: 1800,
      quantity: 1,
      totalPriceCents: 1800,
      customization: {
        sweetness: 0,
        temperature: "hot",
        milkBase: "dairy",
        latteArt: "star",
      },
    },
  };
  const beforeReload = new machineModule.MockMachineAdapter(options);
  const accepted = await beforeReload.submitOrder(request);
  assert.equal(accepted.status, "accepted");
  beforeReload.advance(request.clientOrderId);
  beforeReload.dispose();

  const afterReload = new machineModule.MockMachineAdapter(options);
  const recovered = await afterReload.getOrderStatus(request.clientOrderId);
  assert.equal(recovered.machineOrderId, accepted.machineOrderId);
  assert.equal(recovered.stage, "grinding");
  const retry = await afterReload.submitOrder(request);
  assert.equal(retry.machineOrderId, accepted.machineOrderId);
  afterReload.advance(request.clientOrderId);
  assert.equal(
    (await afterReload.getOrderStatus(request.clientOrderId)).stage,
    "extracting",
  );
  afterReload.dispose();
});

test("all deterministic mock scenarios expose their contract", async () => {
  for (const scenario of [
    "normal",
    "rejected",
    "failure",
    "disconnect",
    "out-of-order",
    "sold-out",
  ]) {
    const adapter = new machineModule.MockMachineAdapter({
      scenario,
      autoAdvance: false,
      now: () => Date.parse("2026-07-26T00:00:00.000Z"),
    });
    const snapshot = await adapter.initialize();
    assert.equal(snapshot.ready, scenario !== "sold-out");
    const result = await adapter.submitOrder({
      clientOrderId: `client-${scenario}`,
      idempotencyKey: `key-${scenario}`,
      submittedAt: "2026-07-26T00:00:00.000Z",
      order: {
        drinkId: "latte",
        drinkName: "拿铁",
        tagline: "柔和顺滑",
        unitPriceCents: 1800,
        quantity: 1,
        totalPriceCents: 1800,
        customization: {
          sweetness: 0,
          temperature: "hot",
          milkBase: "dairy",
          latteArt: "star",
        },
      },
    });
    assert.equal(
      result.status,
      scenario === "rejected" || scenario === "sold-out"
        ? "rejected"
        : "accepted",
    );
    if (result.status === "accepted") {
      assert.ok(adapter.advance(`client-${scenario}`));
    }
    adapter.dispose();
  }
});

test("recovery snapshot enforces schema and TTL", () => {
  const storage = new persistenceModule.MemoryKeyValueStorage();
  const now = Date.parse("2026-07-26T00:00:00.000Z");
  const store = new persistenceModule.RecoverySnapshotStore({
    storage,
    now: () => now,
    ttlMs: 1_000,
  });
  const snapshot = {
    schemaVersion: 1,
    savedAt: new Date(now).toISOString(),
    clientOrderId: "client-1",
    machineOrderId: "machine-1",
    submittedOrder: {
      drinkId: "americano",
      drinkName: "美式",
      tagline: "清爽醒神",
      unitPriceCents: 1500,
      quantity: 1,
      totalPriceCents: 1500,
      customization: {
        sweetness: 0,
        temperature: "hot",
        milkBase: "none",
        latteArt: "none",
      },
    },
    lastKnownStatus: null,
  };
  store.save(snapshot);
  assert.deepEqual(store.load(), snapshot);
  const expired = new persistenceModule.RecoverySnapshotStore({
    storage,
    now: () => now + 1_001,
    ttlMs: 1_000,
  });
  assert.equal(expired.load(), null);
});

test("rolling logger redacts sensitive fields and truncates order ids", () => {
  const logger = new telemetryModule.KioskLogger({
    appVersion: "test",
    deviceId: "device",
    maxEntries: 2,
    now: () => 0,
  });
  logger.log("app_started");
  logger.log("order_submit_started", {
    clientOrderId: "client-order-123456",
    details: { cameraFrame: "private", safe: "ok" },
  });
  logger.log("session_completed");
  const entries = logger.getEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].orderRef, "123456");
  assert.deepEqual(entries[0].details, { safe: "ok" });
});

test("idle decisions wait ninety seconds, count down, and protect brewing", () => {
  assert.deepEqual(idleModule.getIdleDecision("welcome", 0, 30_000), {
    state: "active",
    remainingMs: 70_000,
  });
  assert.deepEqual(idleModule.getIdleDecision("impact", 0, 90_000), {
    state: "warning",
    remainingMs: 10_000,
  });
  assert.deepEqual(idleModule.getIdleDecision("drink", 0, 90_000), {
    state: "warning",
    remainingMs: 10_000,
  });
  assert.deepEqual(idleModule.getIdleDecision("drink", 0, 100_000), {
    state: "timeout",
    remainingMs: 0,
  });
  assert.deepEqual(idleModule.getIdleDecision("brewing", 0, 999_999), {
    state: "inactive",
    remainingMs: null,
  });
  assert.equal(idleModule.MASCOT_SLEEP_AFTER_RETURN_MS, 5_000);
});
