import type { IngredientContribution, RecipeTotals } from './types';
import { safeDivide } from './numeric';
import { calculateAccountedSolidsGrams, calculateDryMatterGrams } from './calculateDryMatter';

/**
 * Aggregates every line into recipe-level totals.
 * Excel equivalent: calculator!row 30 (SUM over the ingredient block) plus the
 * "о рецепте" derivations in calculator!D36:D41.
 */
export function calculateTotals(
  contributions: IngredientContribution[],
  totalWeightGrams: number,
): RecipeTotals {
  const sum = (pick: (c: IngredientContribution) => number): number =>
    contributions.reduce((acc, c) => acc + pick(c), 0);

  const sugarGrams = sum((c) => c.sugarGrams);
  const fatGrams = sum((c) => c.fatGrams);
  const cocoaButterGrams = sum((c) => c.cocoaButterGrams);
  const milkSolidsGrams = sum((c) => c.milkSolidsGrams);
  const cocoaSolidsGrams = sum((c) => c.cocoaSolidsGrams);
  const otherSolidsGrams = sum((c) => c.otherSolidsGrams);
  const waterGrams = sum((c) => c.waterGrams);
  const unaccountedGrams = sum((c) => c.unaccountedGrams);

  // Excel calculator!D36 "общие жиры" = G30 + H30 — cocoa butter is a fat and
  // is therefore counted in total fat, while remaining a separate component.
  const totalFatGrams = fatGrams + cocoaButterGrams;

  const pricedLines = contributions.filter((c) => c.costValue !== null);
  const totalCost =
    pricedLines.length > 0
      ? pricedLines.reduce((acc, c) => acc + (c.costValue ?? 0), 0)
      : null;

  // Excel calculator!M31 "за кг" = (M30 / D30) × 1000.
  const costPerKgRatio = totalCost === null ? null : safeDivide(totalCost, totalWeightGrams);
  const costPerKg = costPerKgRatio === null ? null : costPerKgRatio * 1000;

  return {
    totalWeightGrams,
    itemCount: contributions.length,
    sugarGrams,
    fatGrams,
    cocoaButterGrams,
    milkSolidsGrams,
    cocoaSolidsGrams,
    otherSolidsGrams,
    waterGrams,
    unaccountedGrams,
    totalFatGrams,
    dryMatterGrams: calculateDryMatterGrams(totalWeightGrams, waterGrams),
    accountedSolidsGrams: calculateAccountedSolidsGrams(contributions),
    sweetnessGrams: sum((c) => c.sweetnessGrams),
    totalCost,
    costPerKg,
  };
}
