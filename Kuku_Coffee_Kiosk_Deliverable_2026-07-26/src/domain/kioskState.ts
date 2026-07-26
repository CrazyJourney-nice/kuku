import { drinksById } from "../content/drinks";
import {
  createOrderSnapshot,
  type Customization,
  type Drink,
  type DrinkId,
  type MachineOrderStatus,
  type OrderDraft,
  type OrderSnapshot,
} from "./order";
import { mergeMachineStatus } from "./progress";
import { migrateCustomization, validateCustomization } from "./validation";

export type KioskScreen =
  | "welcome"
  | "impact"
  | "drink"
  | "customize"
  | "confirm"
  | "submitting"
  | "brewing"
  | "pickup"
  | "recovering"
  | "out_of_service";

export type NavigationDirection = "forward" | "backward" | "replace";

export type KioskContext = {
  sessionId: string;
  screen: KioskScreen;
  navigationDirection: NavigationDirection;
  selectedDrinkId: DrinkId | null;
  customization: Customization | null;
  orderDraft: OrderDraft | null;
  submittedOrder: OrderSnapshot | null;
  clientOrderId: string | null;
  idempotencyKey: string | null;
  submittedAt: string | null;
  machineOrderId: string | null;
  machineStatus: MachineOrderStatus | null;
  machineReady: boolean;
  drinkAvailability: Readonly<Record<DrinkId, boolean>>;
  lastInteractionAt: number;
  lastTransitionAt: number;
  transitionLocked: boolean;
  recoveryReason: string | null;
  userMessage: string | null;
};

export type KioskEvent =
  | { type: "USER_ACTIVITY"; at?: number }
  | { type: "START_INTRO" }
  | { type: "START_ORDER" }
  | { type: "SELECT_DRINK"; drinkId: DrinkId }
  | { type: "CONTINUE_TO_CUSTOMIZE" }
  | { type: "UPDATE_CUSTOMIZATION"; patch: Partial<Customization> }
  | { type: "CONTINUE_TO_CONFIRM" }
  | { type: "EDIT_DRINK" }
  | { type: "EDIT_CUSTOMIZATION" }
  | { type: "SUBMIT_ORDER" }
  | { type: "ORDER_ACCEPTED"; machineOrderId: string }
  | { type: "ORDER_REJECTED"; reason: string }
  | { type: "ORDER_STATUS_UNKNOWN"; reason?: string }
  | { type: "MACHINE_STATUS"; status: MachineOrderStatus }
  | { type: "MACHINE_READY_CHANGED"; ready: boolean; reason?: string }
  | {
      type: "INVENTORY_CHANGED";
      drinks: Readonly<Partial<Record<DrinkId, boolean>>>;
    }
  | { type: "MACHINE_DISCONNECTED" }
  | { type: "CUP_REMOVED"; machineOrderId?: string }
  | { type: "FINISH_SESSION" }
  | { type: "IDLE_TIMEOUT" }
  | { type: "RESET_CONFIRMED" }
  | { type: "TRANSITION_FINISHED" }
  | { type: "FRONTEND_ERROR"; code?: string }
  | { type: "FATAL_MACHINE_ERROR"; code: string }
  | { type: "RECOVERY_SUCCEEDED"; status: MachineOrderStatus };

export type KioskTransitionDependencies = {
  now: () => number;
  createId: () => string;
  catalog: Readonly<Record<DrinkId, Drink>>;
  isMachineReady: () => boolean;
};

const defaultDependencies: KioskTransitionDependencies = {
  now: () => Date.now(),
  createId: () =>
    globalThis.crypto?.randomUUID?.() ??
    `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  catalog: drinksById,
  isMachineReady: () => true,
};

export function createInitialKioskContext(
  dependencies: Partial<KioskTransitionDependencies> = {},
): KioskContext {
  const deps = { ...defaultDependencies, ...dependencies };
  const now = deps.now();
  return {
    sessionId: deps.createId(),
    screen: "impact",
    navigationDirection: "replace",
    selectedDrinkId: null,
    customization: null,
    orderDraft: null,
    submittedOrder: null,
    clientOrderId: null,
    idempotencyKey: null,
    submittedAt: null,
    machineOrderId: null,
    machineStatus: null,
    machineReady: false,
    drinkAvailability: {
      americano: true,
      latte: true,
      mocha: true,
    },
    lastInteractionAt: now,
    lastTransitionAt: now,
    transitionLocked: false,
    recoveryReason: null,
    userMessage: null,
  };
}

/** UI-facing alias retained for the reducer bridge. */
export const createInitialContext = createInitialKioskContext;

function move(
  context: KioskContext,
  screen: KioskScreen,
  direction: NavigationDirection,
  now: number,
  patch: Partial<KioskContext> = {},
): KioskContext {
  return {
    ...context,
    ...patch,
    screen,
    navigationDirection: direction,
    lastInteractionAt: now,
    lastTransitionAt: now,
    transitionLocked: true,
    userMessage: patch.userMessage ?? null,
  };
}

function reset(
  context: KioskContext,
  deps: KioskTransitionDependencies,
): KioskContext {
  const next = createInitialKioskContext(deps);
  return {
    ...next,
    machineReady: context.machineReady,
    drinkAvailability: context.drinkAvailability,
    navigationDirection: "backward",
    lastTransitionAt: deps.now(),
  };
}

function activeDrink(
  context: KioskContext,
  catalog: Readonly<Record<DrinkId, Drink>>,
): Drink | null {
  return context.selectedDrinkId ? catalog[context.selectedDrinkId] : null;
}

function isDrinkAvailable(context: KioskContext, drink: Drink): boolean {
  return drink.available && context.drinkAvailability[drink.id] !== false;
}

function isPriorityEvent(event: KioskEvent): boolean {
  return (
    event.type === "FATAL_MACHINE_ERROR" ||
    event.type === "ORDER_ACCEPTED" ||
    event.type === "ORDER_REJECTED" ||
    event.type === "ORDER_STATUS_UNKNOWN" ||
    event.type === "MACHINE_STATUS" ||
    event.type === "MACHINE_READY_CHANGED" ||
    event.type === "INVENTORY_CHANGED" ||
    event.type === "FRONTEND_ERROR" ||
    event.type === "MACHINE_DISCONNECTED" ||
    event.type === "CUP_REMOVED" ||
    event.type === "FINISH_SESSION" ||
    event.type === "RECOVERY_SUCCEEDED" ||
    event.type === "TRANSITION_FINISHED" ||
    // The incoming screen is visible while its entrance motion finishes.
    // Low-risk selections should still respond immediately; only navigation
    // and submit actions stay locked.
    event.type === "SELECT_DRINK" ||
    event.type === "UPDATE_CUSTOMIZATION"
  );
}

/**
 * Pure transition function. Time, ID generation, catalog and readiness are
 * injectable so tests and kiosk hosts can be deterministic.
 */
export function transitionKiosk(
  context: KioskContext,
  event: KioskEvent,
  dependencies: Partial<KioskTransitionDependencies> = {},
): KioskContext {
  const deps = { ...defaultDependencies, ...dependencies };
  const now = deps.now();

  if (event.type === "USER_ACTIVITY") {
    return {
      ...context,
      lastInteractionAt: event.at ?? now,
    };
  }
  if (context.transitionLocked && !isPriorityEvent(event)) return context;
  if (event.type === "TRANSITION_FINISHED") {
    return { ...context, transitionLocked: false };
  }
  if (event.type === "MACHINE_READY_CHANGED") {
    return {
      ...context,
      machineReady: event.ready,
      userMessage: event.ready
        ? null
        : event.reason ?? "设备暂时无法接单",
    };
  }
  if (event.type === "INVENTORY_CHANGED") {
    return {
      ...context,
      drinkAvailability: {
        ...context.drinkAvailability,
        ...event.drinks,
      },
    };
  }
  if (event.type === "FRONTEND_ERROR") {
    if (
      context.clientOrderId &&
      context.submittedOrder &&
      ["submitting", "brewing", "recovering", "pickup"].includes(context.screen)
    ) {
      return move(context, "recovering", "replace", now, {
        recoveryReason: event.code ?? "frontend_error",
      });
    }
    return reset(context, deps);
  }
  if (event.type === "FATAL_MACHINE_ERROR") {
    return move(context, "out_of_service", "replace", now, {
      recoveryReason: event.code,
    });
  }

  switch (context.screen) {
    case "impact":
      if (
        event.type === "START_INTRO" &&
        context.machineReady &&
        deps.isMachineReady()
      ) {
        return move(context, "welcome", "forward", now);
      }
      break;

    case "welcome":
      if (
        event.type === "START_ORDER" &&
        context.machineReady &&
        deps.isMachineReady()
      ) {
        return move(context, "drink", "forward", now);
      }
      if (event.type === "IDLE_TIMEOUT" || event.type === "RESET_CONFIRMED") {
        return reset(context, deps);
      }
      break;

    case "drink":
      if (event.type === "SELECT_DRINK") {
        const drink = deps.catalog[event.drinkId];
        if (!drink || !isDrinkAvailable(context, drink)) {
          return { ...context, userMessage: "当前饮品暂不可制作" };
        }
        const customization = migrateCustomization(
          drink,
          context.customization,
        );
        return {
          ...context,
          selectedDrinkId: event.drinkId,
          customization,
          orderDraft: { drinkId: event.drinkId, customization },
          lastInteractionAt: now,
          userMessage: null,
        };
      }
      if (event.type === "CONTINUE_TO_CUSTOMIZE") {
        const drink = activeDrink(context, deps.catalog);
        if (
          !context.machineReady ||
          !drink ||
          !isDrinkAvailable(context, drink) ||
          !context.customization
        ) {
          return { ...context, userMessage: "当前饮品暂不可制作" };
        }
        return move(context, "customize", "forward", now);
      }
      if (event.type === "IDLE_TIMEOUT" || event.type === "RESET_CONFIRMED") {
        return reset(context, deps);
      }
      break;

    case "customize": {
      const drink = activeDrink(context, deps.catalog);
      if (event.type === "UPDATE_CUSTOMIZATION" && drink && context.customization) {
        const customization = { ...context.customization, ...event.patch };
        const result = validateCustomization(drink, customization);
        if (!result.valid) {
          return { ...context, userMessage: result.issues[0]?.userMessage ?? null };
        }
        return {
          ...context,
          customization: result.value,
          orderDraft: { drinkId: drink.id, customization: result.value },
          lastInteractionAt: now,
          userMessage: null,
        };
      }
      if (event.type === "CONTINUE_TO_CONFIRM" && drink && context.customization) {
        if (!context.machineReady || !isDrinkAvailable(context, drink)) {
          return { ...context, userMessage: "当前饮品暂不可制作" };
        }
        const result = validateCustomization(drink, context.customization);
        if (!result.valid) return context;
        return move(context, "confirm", "forward", now, {
          orderDraft: { drinkId: drink.id, customization: result.value },
        });
      }
      if (event.type === "EDIT_DRINK") {
        return move(context, "drink", "backward", now);
      }
      if (event.type === "IDLE_TIMEOUT" || event.type === "RESET_CONFIRMED") {
        return reset(context, deps);
      }
      break;
    }

    case "confirm": {
      if (event.type === "EDIT_CUSTOMIZATION") {
        return move(context, "customize", "backward", now);
      }
      if (
        event.type === "SUBMIT_ORDER" &&
        context.machineReady &&
        deps.isMachineReady()
      ) {
        const drink = activeDrink(context, deps.catalog);
        if (
          !drink ||
          !isDrinkAvailable(context, drink) ||
          !context.customization
        ) {
          return { ...context, userMessage: "当前饮品暂不可制作" };
        }
        const result = validateCustomization(drink, context.customization);
        if (!result.valid) return context;
        const clientOrderId = deps.createId();
        return move(context, "submitting", "forward", now, {
          submittedOrder: createOrderSnapshot(drink, result.value),
          clientOrderId,
          idempotencyKey: `kuku-order:${clientOrderId}`,
          submittedAt: new Date(now).toISOString(),
        });
      }
      if (event.type === "SUBMIT_ORDER") {
        return { ...context, userMessage: "设备暂时无法接单，请稍后再试" };
      }
      if (event.type === "IDLE_TIMEOUT" || event.type === "RESET_CONFIRMED") {
        return reset(context, deps);
      }
      break;
    }

    case "submitting":
      if (
        event.type === "ORDER_ACCEPTED" &&
        context.clientOrderId &&
        context.submittedOrder
      ) {
        return move(context, "brewing", "forward", now, {
          machineOrderId: event.machineOrderId,
        });
      }
      if (event.type === "ORDER_REJECTED") {
        return move(context, "confirm", "backward", now, {
          submittedOrder: null,
          clientOrderId: null,
          idempotencyKey: null,
          submittedAt: null,
          userMessage: event.reason,
        });
      }
      if (
        event.type === "ORDER_STATUS_UNKNOWN" ||
        event.type === "MACHINE_DISCONNECTED"
      ) {
        return move(context, "recovering", "replace", now, {
          recoveryReason:
            event.type === "ORDER_STATUS_UNKNOWN"
              ? event.reason ?? "submit_status_unknown"
              : "machine_disconnected",
        });
      }
      break;

    case "brewing":
      if (
        event.type === "MACHINE_STATUS" &&
        context.clientOrderId &&
        context.machineOrderId
      ) {
        const merged = mergeMachineStatus(context.machineStatus, event.status, {
          clientOrderId: context.clientOrderId,
          machineOrderId: context.machineOrderId,
        });
        if (!merged.accepted) return context;
        if (merged.status.stage === "completed") {
          return move(context, "pickup", "forward", now, {
            machineStatus: merged.status,
          });
        }
        if (
          merged.status.stage === "failed" ||
          merged.status.stage === "cancelled"
        ) {
          return move(context, "out_of_service", "replace", now, {
            machineStatus: merged.status,
            recoveryReason: merged.status.errorCode ?? merged.status.stage,
          });
        }
        return {
          ...context,
          machineStatus: merged.status,
          lastInteractionAt: now,
        };
      }
      if (event.type === "MACHINE_DISCONNECTED") {
        return move(context, "recovering", "replace", now, {
          recoveryReason: "machine_disconnected",
        });
      }
      // Deliberately ignore IDLE_TIMEOUT and user reset while making a drink.
      break;

    case "recovering":
      if (
        event.type === "RECOVERY_SUCCEEDED" &&
        context.clientOrderId &&
        event.status.clientOrderId === context.clientOrderId
      ) {
        if (event.status.stage === "completed") {
          return move(context, "pickup", "replace", now, {
            machineOrderId: event.status.machineOrderId,
            machineStatus: event.status,
            recoveryReason: null,
          });
        }
        if (
          event.status.stage === "failed" ||
          event.status.stage === "cancelled"
        ) {
          return move(context, "out_of_service", "replace", now, {
            machineOrderId: event.status.machineOrderId,
            machineStatus: event.status,
            recoveryReason: event.status.errorCode ?? event.status.stage,
          });
        }
        return move(context, "brewing", "replace", now, {
          machineOrderId: event.status.machineOrderId,
          machineStatus: event.status,
          recoveryReason: null,
        });
      }
      break;

    case "pickup":
      if (
        event.type === "FINISH_SESSION" ||
        event.type === "RESET_CONFIRMED" ||
        (event.type === "CUP_REMOVED" &&
          (!event.machineOrderId ||
            event.machineOrderId === context.machineOrderId))
      ) {
        return reset(context, deps);
      }
      break;

    case "out_of_service":
      break;
  }

  return context;
}

/** React.useReducer-compatible entry point using production dependencies. */
export function kioskReducer(
  context: KioskContext,
  event: KioskEvent,
): KioskContext {
  return transitionKiosk(context, event);
}

export function createSubmitRequestFromContext(context: KioskContext) {
  if (
    !context.submittedOrder ||
    !context.clientOrderId ||
    !context.idempotencyKey ||
    !context.submittedAt
  ) {
    return null;
  }
  return {
    clientOrderId: context.clientOrderId,
    idempotencyKey: context.idempotencyKey,
    submittedAt: context.submittedAt,
    order: context.submittedOrder,
  };
}
