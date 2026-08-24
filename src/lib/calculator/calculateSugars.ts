import type { IngredientContribution, RecipeItemInput } from './types';
import { finiteOrZero, safeDivide, safePercentage } from './numeric';

/**
 * Sugars in the recipe (spec §7):
 *   sugarGrams = Σ( ingredientWeight × ingredient.sugarPercentage / 100 )
 *
 * The source Database carries a single aggregate "сахара" column; it does not
 * distinguish sucrose / glucose / fructose / sorbitol / invert. That absence is
 * the reason a molar water-activity model cannot be built from this data —
 * see docs/calculation-model.md §"Why a_w is not computed".
 */
export function calculateSugarGrams(items: RecipeItemInput[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      (Math.max(0, finiteOrZero(item.ingredient.sugarPercentage)) / 100) *
        Math.max(0, finiteOrZero(item.weightGrams)),
    0,
  );
}

export function sumSugarGrams(contributions: IngredientContribution[]): number {
  return contributions.reduce((sum, c) => sum + c.sugarGrams, 0);
}

export function calculateSugarPercentage(
  sugarGrams: number,
  totalWeightGrams: number,
): number | null {
  return safePercentage(sugarGrams, totalWeightGrams);
}

/**
 * Sugar / water ratio (spec §17): sugarGrams / waterGrams.
 * Returns `null` — never Infinity — for an anhydrous recipe.
 */
export function calculateSugarWaterRatio(
  sugarGrams: number,
  waterGrams: number,
): number | null {
  return safeDivide(sugarGrams, waterGrams);
}
