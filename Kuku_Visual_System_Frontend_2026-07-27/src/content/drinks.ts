import type { Drink, DrinkId } from "../domain/order";

export const drinks = [
  {
    id: "americano",
    name: "美式",
    tagline: "清爽醒神",
    description: "浓郁咖啡香，口感干净利落。",
    priceCents: 1500,
    imageSrc: "/assets/drinks/americano.webp",
    available: true,
    capabilities: {
      temperature: ["hot", "iced"],
      sweetness: [0, 30, 50],
      milkBase: ["none"],
      latteArt: false,
    },
  },
  {
    id: "latte",
    name: "拿铁",
    tagline: "柔和顺滑",
    description: "醇香咖啡与奶香平衡融合。",
    priceCents: 1800,
    imageSrc: "/assets/drinks/latte.webp",
    available: true,
    capabilities: {
      temperature: ["hot", "iced"],
      sweetness: [0, 30, 50],
      milkBase: ["dairy", "oat"],
      latteArt: true,
      latteArtOptions: ["star", "heart", "smile"],
    },
  },
  {
    id: "mocha",
    name: "摩卡",
    tagline: "可可香甜",
    description: "咖啡融入温柔可可风味。",
    priceCents: 2000,
    imageSrc: "/assets/drinks/mocha.webp",
    available: true,
    capabilities: {
      temperature: ["hot", "iced"],
      sweetness: [0, 30, 50],
      milkBase: ["dairy", "oat"],
      latteArt: false,
    },
  },
] as const satisfies readonly Drink[];

export const drinksById: Readonly<Record<DrinkId, Drink>> = Object.freeze({
  americano: drinks[0],
  latte: drinks[1],
  mocha: drinks[2],
});

export function getDrinkById(id: DrinkId): Drink {
  return drinksById[id];
}

export function withDrinkAvailability(
  availability: Readonly<Partial<Record<DrinkId, boolean>>>,
): readonly Drink[] {
  return drinks.map((drink) => ({
    ...drink,
    available: availability[drink.id] ?? drink.available,
  }));
}
