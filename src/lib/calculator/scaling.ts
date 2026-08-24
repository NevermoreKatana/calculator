import type { RecipeInput, ScalingInfo } from './types';
import { finiteOrZero, safeDivide } from './numeric';

/**
 * Recipe scaling (spec §37, §38).
 *
 * Excel equivalent: the `page print` sheet, where
 *   A2  = G31 / calculator!D30          (scale factor)
 *   G12 = A2 × calculator!D5            (scaled line weight)
 *
 * Target weight resolution order:
 *   1. pieceCount × pieceWeightGrams, when both are positive
 *   2. targetTotalWeightGrams, when positive
 *   3. no scaling (factor 1)
 *
 * Percentages are invariant under scaling — only absolute weights change.
 */
export function resolveScaling(input: RecipeInput): ScalingInfo {
  const baseTotalWeightGrams = input.items.reduce(
    (sum, item) => sum + Math.max(0, finiteOrZero(item.weightGrams)),
    0,
  );

  const pieceCount =
    input.pieceCount != null && finiteOrZero(input.pieceCount) > 0
      ? finiteOrZero(input.pieceCount)
      : null;
  const pieceWeightGrams =
    input.pieceWeightGrams != null && finiteOrZero(input.pieceWeightGrams) > 0
      ? finiteOrZero(input.pieceWeightGrams)
      : null;

  let targetTotalWeightGrams: number | null = null;
  if (pieceCount !== null && pieceWeightGrams !== null) {
    targetTotalWeightGrams = pieceCount * pieceWeightGrams;
  } else if (
    input.targetTotalWeightGrams != null &&
    finiteOrZero(input.targetTotalWeightGrams) > 0
  ) {
    targetTotalWeightGrams = finiteOrZero(input.targetTotalWeightGrams);
  }

  // Scaling needs a non-zero base to divide by; without one the factor stays 1
  // and the caller receives a `target_weight_ignored` warning.
  const rawFactor =
    targetTotalWeightGrams === null
      ? null
      : safeDivide(targetTotalWeightGrams, baseTotalWeightGrams);
  const scaleFactor = rawFactor ?? 1;

  return {
    baseTotalWeightGrams,
    targetTotalWeightGrams,
    scaleFactor,
    pieceCount,
    pieceWeightGrams,
    effectiveTotalWeightGrams: baseTotalWeightGrams * scaleFactor,
  };
}
