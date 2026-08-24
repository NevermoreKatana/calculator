import type { IngredientContribution } from './types';
import { safePercentage } from './numeric';

/**
 * Dry matter (spec §7):
 *   dryMatterGrams = totalWeightGrams − waterGrams
 *
 * Note the distinction the Excel source did not make explicit:
 *
 *  - `dryMatterGrams`        everything that is not water (the spec definition)
 *  - `accountedSolidsGrams`  the six *declared* solid components summed
 *
 * They differ whenever an ingredient row does not sum to 100 %, which is common
 * in the imported Database (64 of 113 rows sum to < 99.5 %). The difference is
 * reported as `unaccounted` rather than being silently redistributed.
 */
export function calculateDryMatterGrams(
  totalWeightGrams: number,
  waterGrams: number,
): number {
  return totalWeightGrams - waterGrams;
}

export function calculateAccountedSolidsGrams(
  contributions: IngredientContribution[],
): number {
  return contributions.reduce(
    (sum, c) =>
      sum +
      c.sugarGrams +
      c.fatGrams +
      c.cocoaButterGrams +
      c.milkSolidsGrams +
      c.cocoaSolidsGrams +
      c.otherSolidsGrams,
    0,
  );
}

export function calculateDryMatterPercentage(
  dryMatterGrams: number,
  totalWeightGrams: number,
): number | null {
  return safePercentage(dryMatterGrams, totalWeightGrams);
}
