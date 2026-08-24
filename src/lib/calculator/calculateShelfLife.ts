/**
 * Documented entry point for the shelf-life layer (spec §6 file list, §13).
 *
 * Order of operations, as specified:
 *   1–4. take water %, sugar %, dry matter % and total weight from the recipe
 *   5.   take a_w when available (display only — see below)
 *   6–9. match or interpolate against the empirical reference points
 *   10.  otherwise report "недостаточно данных"
 *
 * a_w is deliberately NOT an input to the arithmetic. The reference points
 * record water, sugar and days only; nothing in the supplied material links
 * a_w to a number of days (spec §22).
 */
import type { RecipeCalculation } from './types';
import { calculateShelfLifeEstimate, type ShelfLifeEstimate } from '../shelf-life';

export interface CalculateShelfLifeOptions {
  waterActivity?: number | null;
}

export function calculateShelfLife(
  calculation: RecipeCalculation,
  options: CalculateShelfLifeOptions = {},
): ShelfLifeEstimate {
  return calculateShelfLifeEstimate({
    waterPercentage: calculation.percentages.waterPercentage,
    sugarPercentage: calculation.percentages.sugarPercentage,
    dryMatterPercentage: calculation.percentages.dryMatterPercentage,
    totalWeightGrams: calculation.totals.totalWeightGrams,
    waterActivity: options.waterActivity ?? null,
  });
}
