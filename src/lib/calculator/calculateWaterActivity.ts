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
import type { RecipeCalculation } from './types';
import {
  resolveWaterActivity,
  type ResolvedWaterActivity,
  type WaterActivityModel,
} from '../water-activity';

export interface CalculateWaterActivityOptions {
  /** Instrument reading entered by the user, 0..1. */
  measuredValue?: number | null;
  temperatureCelsius?: number | null;
  chain?: readonly WaterActivityModel[];
}

export function calculateWaterActivity(
  calculation: RecipeCalculation,
  options: CalculateWaterActivityOptions = {},
): ResolvedWaterActivity {
  return resolveWaterActivity(
    {
      waterPercentage: calculation.percentages.waterPercentage,
      dryMatterPercentage: calculation.percentages.dryMatterPercentage,
      sugarPercentage: calculation.percentages.sugarPercentage,
      temperatureCelsius: options.temperatureCelsius ?? null,
      ingredients: calculation.contributions,
      measuredValue: options.measuredValue ?? null,
    },
    options.chain,
  );
}
