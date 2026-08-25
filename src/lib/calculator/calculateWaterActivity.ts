/**
 * Documented entry point for the water-activity layer (spec §6 file list).
 *
 * The real logic lives in src/lib/water-activity, which keeps the pluggable
 * model chain (measured → reference → scientific) separate from recipe
 * arithmetic. This module only adapts a RecipeCalculation into the model input.
 *
 * It never derives a_w from the recipe. If no model can supply a value the
 * result is explicitly "unavailable".
 */
import type { Ingredient, RecipeCalculation } from './types';
import {
  resolveWaterActivity,
  type ResolvedWaterActivity,
  type WaterActivityModel,
} from '../water-activity';
import { adaptRecipeForScience, type RecipeScienceOptions } from '../science';

export interface CalculateWaterActivityOptions {
  /** Instrument reading entered by the user, 0..1. */
  measuredValue?: number | null;
  temperatureCelsius?: number | null;
  chain?: readonly WaterActivityModel[];
  /**
   * Ingredients keyed by id, needed to resolve each line's sugar species.
   * When omitted, the composition model has nothing to speciate with and
   * correctly reports that it cannot produce a value.
   */
  ingredientsById?: ReadonlyMap<string, Pick<Ingredient, 'id' | 'name' | 'category'>>;
  science?: RecipeScienceOptions;
}

export function calculateWaterActivity(
  calculation: RecipeCalculation,
  options: CalculateWaterActivityOptions = {},
): ResolvedWaterActivity {
  // The ingredient map is optional. Without it the recipe still balances and
  // every mass figure stays exact — only the composition a_w model stands
  // down, which is the intended failure mode rather than a fallback guess.
  const ingredientsById =
    options.ingredientsById ??
    new Map(
      calculation.contributions.map((c) => [
        c.ingredientId,
        { id: c.ingredientId, name: c.ingredientName, category: c.category },
      ]),
    );

  const adapted = adaptRecipeForScience(calculation, ingredientsById, {
    temperatureCelsius: options.temperatureCelsius ?? undefined,
    ...options.science,
  });

  return resolveWaterActivity(
    {
      waterPercentage: calculation.percentages.waterPercentage,
      dryMatterPercentage: calculation.percentages.dryMatterPercentage,
      sugarPercentage: calculation.percentages.sugarPercentage,
      temperatureCelsius: options.temperatureCelsius ?? null,
      ingredients: calculation.contributions,
      measuredValue: options.measuredValue ?? null,
      science: {
        contributions: adapted.contributions,
        speciation: adapted.speciation,
      },
    },
    options.chain,
  );
}

/**
 * Full scientific analysis of a recipe: adapted aqueous phase plus the
 * resolved a_w. Exposed so the UI can show per-line speciation and the
 * traceability panel without re-running the adapter.
 */
export function analyseRecipeScience(
  calculation: RecipeCalculation,
  options: CalculateWaterActivityOptions = {},
) {
  const ingredientsById =
    options.ingredientsById ??
    new Map(
      calculation.contributions.map((c) => [
        c.ingredientId,
        { id: c.ingredientId, name: c.ingredientName, category: c.category },
      ]),
    );

  const adapted = adaptRecipeForScience(calculation, ingredientsById, {
    temperatureCelsius: options.temperatureCelsius ?? undefined,
    ...options.science,
  });

  const waterActivity = resolveWaterActivity(
    {
      waterPercentage: calculation.percentages.waterPercentage,
      dryMatterPercentage: calculation.percentages.dryMatterPercentage,
      sugarPercentage: calculation.percentages.sugarPercentage,
      temperatureCelsius: options.temperatureCelsius ?? null,
      ingredients: calculation.contributions,
      measuredValue: options.measuredValue ?? null,
      science: {
        contributions: adapted.contributions,
        speciation: adapted.speciation,
      },
    },
    options.chain,
  );

  return { adapted, waterActivity };
}
