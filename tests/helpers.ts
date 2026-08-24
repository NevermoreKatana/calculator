import type { Ingredient, IngredientCategory } from '@/lib/calculator/types';

let counter = 0;

/** Builds an ingredient with everything defaulted to 0, so each test states
 *  only the components it actually cares about. */
export function makeIngredient(
  name: string,
  parts: Partial<Omit<Ingredient, 'id' | 'name'>> = {},
): Ingredient {
  counter += 1;
  return {
    id: `ing-${counter}`,
    name,
    category: (parts.category ?? 'other') as IngredientCategory,
    brand: parts.brand ?? null,
    sugarPercentage: parts.sugarPercentage ?? 0,
    fatPercentage: parts.fatPercentage ?? 0,
    cocoaButterPercentage: parts.cocoaButterPercentage ?? 0,
    milkSolidsPercentage: parts.milkSolidsPercentage ?? 0,
    cocoaSolidsPercentage: parts.cocoaSolidsPercentage ?? 0,
    otherSolidsPercentage: parts.otherSolidsPercentage ?? 0,
    waterPercentage: parts.waterPercentage ?? 0,
    sweetness: parts.sweetness ?? 0,
    pricePerKg: parts.pricePerKg ?? null,
    source: parts.source ?? 'test',
    sourceUrl: parts.sourceUrl ?? null,
    isCustom: parts.isCustom ?? false,
  };
}

export function item(ingredient: Ingredient, weightGrams: number) {
  counter += 1;
  return { id: `item-${counter}`, ingredient, weightGrams };
}
