import type { Ingredient, IngredientContribution, RecipeItemInput } from './types';
import { finiteOrZero } from './numeric';

/**
 * Absolute component grams contributed by one recipe line.
 *
 * Excel equivalent: calculator!F..N, which computed
 *   VLOOKUP(name, Database, component) * (weight / totalWeight)
 * i.e. each component as a FRACTION OF THE WHOLE RECIPE.
 *
 * This implementation instead produces GRAMS
 *   component% / 100 × weightGrams
 * which is mathematically equivalent once divided by the total (see
 * calculatePercentages) but stays meaningful for a single line on its own and
 * avoids the circular dependency on the recipe total that made the Excel
 * version break whenever a row was inserted or deleted.
 */
export function calculateIngredientContribution(
  item: RecipeItemInput,
  totalWeightGrams: number,
): IngredientContribution {
  const ingredient = item.ingredient;
  const weightGrams = Math.max(0, finiteOrZero(item.weightGrams));

  const gramsOf = (percentage: number): number =>
    (Math.max(0, finiteOrZero(percentage)) / 100) * weightGrams;

  const sugarGrams = gramsOf(ingredient.sugarPercentage);
  const fatGrams = gramsOf(ingredient.fatPercentage);
  const cocoaButterGrams = gramsOf(ingredient.cocoaButterPercentage);
  const milkSolidsGrams = gramsOf(ingredient.milkSolidsPercentage);
  const cocoaSolidsGrams = gramsOf(ingredient.cocoaSolidsPercentage);
  const otherSolidsGrams = gramsOf(ingredient.otherSolidsPercentage);
  const waterGrams = gramsOf(ingredient.waterPercentage);

  const describedGrams =
    sugarGrams +
    fatGrams +
    cocoaButterGrams +
    milkSolidsGrams +
    cocoaSolidsGrams +
    otherSolidsGrams +
    waterGrams;

  const price = ingredient.pricePerKg;
  const costValue =
    typeof price === 'number' && Number.isFinite(price) && price > 0
      ? (price * weightGrams) / 1000
      : null;

  return {
    itemId: item.id,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    category: ingredient.category,
    weightGrams,
    percentage: totalWeightGrams > 0 ? (weightGrams / totalWeightGrams) * 100 : 0,
    sugarGrams,
    fatGrams,
    cocoaButterGrams,
    milkSolidsGrams,
    cocoaSolidsGrams,
    otherSolidsGrams,
    waterGrams,
    unaccountedGrams: weightGrams - describedGrams,
    sweetnessGrams: gramsOf(ingredient.sweetness),
    costValue,
  };
}

/** Σ of the seven declared components, as a percent of the ingredient mass. */
export function componentSum(ingredient: Ingredient): number {
  return (
    finiteOrZero(ingredient.sugarPercentage) +
    finiteOrZero(ingredient.fatPercentage) +
    finiteOrZero(ingredient.cocoaButterPercentage) +
    finiteOrZero(ingredient.milkSolidsPercentage) +
    finiteOrZero(ingredient.cocoaSolidsPercentage) +
    finiteOrZero(ingredient.otherSolidsPercentage) +
    finiteOrZero(ingredient.waterPercentage)
  );
}
