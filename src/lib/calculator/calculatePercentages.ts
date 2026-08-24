import type { RecipePercentages, RecipeTotals } from './types';
import { safePercentage } from './numeric';

/**
 * Expresses every total as a percent of the recipe mass (spec §7):
 *   percentage = grams / totalWeightGrams × 100
 *
 * A zero-weight recipe yields 0 for every field rather than NaN (spec §44).
 */
export function calculatePercentages(totals: RecipeTotals): RecipePercentages {
  const total = totals.totalWeightGrams;
  const pct = (grams: number): number => safePercentage(grams, total) ?? 0;

  return {
    sugarPercentage: pct(totals.sugarGrams),
    fatPercentage: pct(totals.fatGrams),
    cocoaButterPercentage: pct(totals.cocoaButterGrams),
    milkSolidsPercentage: pct(totals.milkSolidsGrams),
    cocoaSolidsPercentage: pct(totals.cocoaSolidsGrams),
    otherSolidsPercentage: pct(totals.otherSolidsGrams),
    waterPercentage: pct(totals.waterGrams),
    unaccountedPercentage: pct(totals.unaccountedGrams),
    totalFatPercentage: pct(totals.totalFatGrams),
    dryMatterPercentage: pct(totals.dryMatterGrams),
    accountedSolidsPercentage: pct(totals.accountedSolidsGrams),
    sweetnessPercentage: pct(totals.sweetnessGrams),
  };
}
