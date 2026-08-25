/**
 * Do the empirical reference points line up with water activity? (spec §20)
 *
 * Spec §20 asks whether the three supplied shelf-life observations can be
 * EXPLAINED by a_w, dry matter, sugar composition, osmotic pressure and so on,
 * rather than being an unexplained rule of thumb. This module answers that
 * question by running each reference point through the same aqueous-phase model
 * the calculator uses.
 *
 * ── The assumption, stated plainly ────────────────────────────────────────
 * The reference points record only water % and sugar %. They do NOT record
 * which sugars. To compute anything at all, this analysis treats the sugar as
 * 100 % sucrose, which is:
 *   • the conservative reading — sucrose depresses a_w LESS per gram than
 *     invert sugar, so the computed a_w is an UPPER bound;
 *   • almost certainly not the real composition, since the recipes these points
 *     came from very likely contained invert sugar and glucose syrup.
 *
 * So the absolute a_w values here are indicative, not exact. What survives the
 * assumption is the ORDERING and the monotonicity, because the same assumption
 * is applied to all three points.
 *
 * ── What this is not ──────────────────────────────────────────────────────
 * Finding that a_w explains the ordering does NOT produce a formula
 * `a_w → days`. That would need data across many recipes, temperatures and
 * packagings. See docs/scientific-research/06-shelf-life-models.md §6.2.
 */

import { buildAqueousPhase } from './aqueous-phase';
import { norrishMultiSoluteWaterActivity } from './water-activity/equations';
import { SUGAR_PROFILES } from './sugars';

export interface ReferencePointAnalysis {
  waterPercentage: number;
  sugarPercentage: number;
  /** Dissolved solids as % of the water phase — the "°Brix" of the syrup. */
  waterPhaseSolidsPercent: number;
  /** a_w under the all-sucrose assumption. */
  waterActivity: number;
  /** True when the water phase is at or above the ganache-review 65 °Brix mark. */
  aboveBrixThreshold: boolean;
}

/**
 * Analyses one (water %, sugar %) pair as 100 g of product.
 *
 * The remainder of the mass is treated as non-solute solids (fat, cocoa,
 * protein), which is what a ganache's balance actually is.
 */
export function analyseReferencePoint(
  waterPercentage: number,
  sugarPercentage: number,
  temperatureCelsius = 20,
): ReferencePointAnalysis {
  const phase = buildAqueousPhase(
    [
      {
        waterGrams: waterPercentage,
        sugarGrams: sugarPercentage,
        sugarProfile: SUGAR_PROFILES.pureSucrose,
        nonSoluteSolidsGrams: Math.max(0, 100 - waterPercentage - sugarPercentage),
      },
    ],
    { temperatureCelsius },
  );

  const waterActivity = norrishMultiSoluteWaterActivity(
    phase.waterMoles,
    phase.solutes.map((s) => ({ moles: s.moles, norrishK: s.norrishK })),
  );

  return {
    waterPercentage,
    sugarPercentage,
    waterPhaseSolidsPercent: phase.dissolvedSolidsPercent,
    waterActivity,
    aboveBrixThreshold: phase.dissolvedSolidsPercent >= 65,
  };
}
