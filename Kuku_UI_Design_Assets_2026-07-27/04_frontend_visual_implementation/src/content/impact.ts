export type ImpactContent = {
  eyebrow: string;
  rescuedAnimals: number;
  partnerOrganizations: number;
  investmentCents: number;
  imageSources: readonly string[];
};

export const impactContent: ImpactContent = Object.freeze({
  eyebrow: "年度动保行动",
  rescuedAnimals: 326,
  partnerOrganizations: 12,
  investmentCents: 48_000_000,
  imageSources: [
    "/assets/impact/animal-rescue-1.webp",
    "/assets/impact/animal-rescue-2.webp",
  ],
});
