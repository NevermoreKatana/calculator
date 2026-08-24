import type { IngredientContribution, RecipeItemInput } from './types';
import { finiteOrZero, safePercentage } from './numeric';

/**
 * Water in the recipe (spec §7):
 *   waterGrams = Σ( ingredientWeight × ingredient.waterPercentage / 100 )
 *
 * IMPORTANT (spec §8, §26): this is the RECIPE WATER CONTENT. It is *not*
 * water activity (a_w) and must never be presented as such. See
 * src/lib/water-activity for the a_w layer.
 */
export function calculateWaterGrams(items: RecipeItemInput[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      (Math.max(0, finiteOrZero(item.ingredient.waterPercentage)) / 100) *
        Math.max(0, finiteOrZero(item.weightGrams)),
    0,
  );
}

export function sumWaterGrams(contributions: IngredientContribution[]): number {
  return contributions.reduce((sum, c) => sum + c.waterGrams, 0);
}

/** waterGrams / totalWeightGrams × 100; `null` when the total is 0. */
export function calculateWaterPercentage(
  waterGrams: number,
  totalWeightGrams: number,
): number | null {
  return safePercentage(waterGrams, totalWeightGrams);
}
