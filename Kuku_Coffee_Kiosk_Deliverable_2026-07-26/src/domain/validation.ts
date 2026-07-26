import {
  cloneCustomization,
  defaultsByDrink,
  type Customization,
  type Drink,
  type LatteArt,
  type MilkBase,
  type Sweetness,
  type Temperature,
} from "./order";

export type ValidationIssueCode =
  | "drink_unavailable"
  | "temperature_unsupported"
  | "sweetness_unsupported"
  | "milk_base_unsupported"
  | "latte_art_unsupported"
  | "latte_art_option_unsupported";

export type ValidationIssue = {
  code: ValidationIssueCode;
  field: keyof Customization | "drink";
  userMessage: string;
};

export type ValidationResult =
  | { valid: true; value: Customization }
  | { valid: false; issues: readonly ValidationIssue[] };

function includesValue<T>(values: readonly T[], value: T): boolean {
  return values.includes(value);
}

export function validateCustomization(
  drink: Drink,
  customization: Customization,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!drink.available) {
    issues.push({
      code: "drink_unavailable",
      field: "drink",
      userMessage: "当前饮品暂不可制作",
    });
  }
  if (!includesValue(drink.capabilities.temperature, customization.temperature)) {
    issues.push({
      code: "temperature_unsupported",
      field: "temperature",
      userMessage: "当前饮品不支持该冷热选项",
    });
  }
  if (!includesValue(drink.capabilities.sweetness, customization.sweetness)) {
    issues.push({
      code: "sweetness_unsupported",
      field: "sweetness",
      userMessage: "当前饮品不支持该甜度",
    });
  }
  if (!includesValue(drink.capabilities.milkBase, customization.milkBase)) {
    issues.push({
      code: "milk_base_unsupported",
      field: "milkBase",
      userMessage: "当前饮品不支持该奶基",
    });
  }

  const artOptions = drink.capabilities.latteArtOptions ?? [];
  if (!drink.capabilities.latteArt && customization.latteArt !== "none") {
    issues.push({
      code: "latte_art_unsupported",
      field: "latteArt",
      userMessage: "当前饮品不支持奶盖图案",
    });
  } else if (
    customization.latteArt !== "none" &&
    !includesValue(artOptions, customization.latteArt)
  ) {
    issues.push({
      code: "latte_art_option_unsupported",
      field: "latteArt",
      userMessage:
        customization.latteArt === "custom"
          ? "自定义图案即将开放"
          : "当前饮品不支持该图案",
    });
  }

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, value: cloneCustomization(customization) };
}

function firstOr<T>(values: readonly T[], fallback: T): T {
  return values[0] ?? fallback;
}

/**
 * Moves a customization draft to a newly selected drink while retaining every
 * still-supported value. Invalid fields fall back to that drink's product
 * default, then to the first advertised capability.
 */
export function migrateCustomization(
  drink: Drink,
  previous?: Customization | null,
): Customization {
  const defaults = defaultsByDrink[drink.id];
  const candidate = previous ?? defaults;

  const temperature: Temperature = includesValue(
    drink.capabilities.temperature,
    candidate.temperature,
  )
    ? candidate.temperature
    : includesValue(drink.capabilities.temperature, defaults.temperature)
      ? defaults.temperature
      : firstOr(drink.capabilities.temperature, "hot");

  const sweetness: Sweetness = includesValue(
    drink.capabilities.sweetness,
    candidate.sweetness,
  )
    ? candidate.sweetness
    : includesValue(drink.capabilities.sweetness, defaults.sweetness)
      ? defaults.sweetness
      : firstOr(drink.capabilities.sweetness, 0);

  const milkBase: MilkBase = includesValue(
    drink.capabilities.milkBase,
    candidate.milkBase,
  )
    ? candidate.milkBase
    : includesValue(drink.capabilities.milkBase, defaults.milkBase)
      ? defaults.milkBase
      : firstOr(drink.capabilities.milkBase, "none");

  const artOptions = drink.capabilities.latteArtOptions ?? [];
  let latteArt: LatteArt = "none";
  if (drink.capabilities.latteArt) {
    if (candidate.latteArt !== "none" && includesValue(artOptions, candidate.latteArt)) {
      latteArt = candidate.latteArt;
    } else if (
      defaults.latteArt !== "none" &&
      includesValue(artOptions, defaults.latteArt)
    ) {
      latteArt = defaults.latteArt;
    }
  }

  return { sweetness, temperature, milkBase, latteArt };
}
