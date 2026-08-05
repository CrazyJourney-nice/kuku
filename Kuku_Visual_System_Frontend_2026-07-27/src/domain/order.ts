export type DrinkId = "americano" | "latte" | "mocha";

export type Temperature = "hot" | "iced";
export type Sweetness = 0 | 30 | 50;
export type MilkBase = "none" | "dairy" | "oat";
export type LatteArt = "none" | "star" | "heart" | "smile" | "custom";

export type DrinkCapabilities = {
  readonly temperature: readonly Temperature[];
  readonly sweetness: readonly Sweetness[];
  readonly milkBase: readonly MilkBase[];
  readonly latteArt: boolean;
  readonly latteArtOptions?: readonly Exclude<LatteArt, "none">[];
};

export type Drink = {
  readonly id: DrinkId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly priceCents: number;
  readonly imageSrc: string;
  readonly available: boolean;
  readonly capabilities: DrinkCapabilities;
};

export type Customization = {
  sweetness: Sweetness;
  temperature: Temperature;
  milkBase: MilkBase;
  latteArt: LatteArt;
};

export type OrderDraft = {
  drinkId: DrinkId;
  customization: Customization;
};

export type OrderSnapshot = Readonly<{
  drinkId: DrinkId;
  drinkName: string;
  tagline: string;
  unitPriceCents: number;
  quantity: 1;
  totalPriceCents: number;
  customization: Readonly<Customization>;
}>;

export type SubmissionIdentity = Readonly<{
  clientOrderId: string;
  idempotencyKey: string;
  submittedAt: string;
}>;

export type SubmitOrderRequest = SubmissionIdentity & {
  order: OrderSnapshot;
};

export type BrewStage =
  | "queued"
  | "grinding"
  | "extracting"
  | "dispensing"
  | "completed"
  | "failed"
  | "cancelled";

export type MachineOrderStatus = {
  machineOrderId: string;
  clientOrderId: string;
  stage: BrewStage;
  progress?: number;
  updatedAt: string;
  recoverable: boolean;
  errorCode?: string;
};

export const defaultsByDrink: Readonly<Record<DrinkId, Customization>> = {
  americano: {
    sweetness: 0,
    temperature: "hot",
    milkBase: "none",
    latteArt: "none",
  },
  latte: {
    sweetness: 0,
    temperature: "hot",
    milkBase: "dairy",
    latteArt: "star",
  },
  mocha: {
    sweetness: 50,
    temperature: "iced",
    milkBase: "oat",
    latteArt: "none",
  },
};

export function cloneCustomization(value: Customization): Customization {
  return { ...value };
}

export function createOrderSnapshot(
  drink: Drink,
  customization: Customization,
): OrderSnapshot {
  const frozenCustomization = Object.freeze(cloneCustomization(customization));
  return Object.freeze({
    drinkId: drink.id,
    drinkName: drink.name,
    tagline: drink.tagline,
    unitPriceCents: drink.priceCents,
    quantity: 1 as const,
    totalPriceCents: drink.priceCents,
    customization: frozenCustomization,
  });
}

export function createSubmitOrderRequest(
  identity: SubmissionIdentity,
  order: OrderSnapshot,
): SubmitOrderRequest {
  return Object.freeze({ ...identity, order });
}
