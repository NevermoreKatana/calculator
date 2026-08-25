/**
 * Water-activity equations (spec §10).
 *
 * Pure functions, no domain objects, no I/O — so they can be unit-tested
 * directly against published values (spec §40).
 *
 * ── Sign convention, stated once ──────────────────────────────────────────
 * Every function here uses
 *     a_w = X_w · exp(−K · X_s²)      with K POSITIVE
 * The literature also prints the algebraically identical
 *     a_w = X_w · exp(+K · X_s²)      with K NEGATIVE
 * Mixing the two silently produces water activities ABOVE 1, which is why the
 * convention is asserted rather than assumed.
 */

/** One dissolved species, reduced to what the equations need. */
export interface SoluteMoles {
  moles: number;
  /** Norrish interaction constant, positive, in the exp(−K·X²) convention. */
  norrishK: number;
}

/**
 * Raoult's law for an ideal solution.
 *
 *     a_w = X_w = n_w / (n_w + Σ n_s)
 *
 * Included because it is the baseline every other model corrects, and because
 * showing it next to Norrish makes the size of the non-ideality visible. It is
 * NOT used as the app's answer: for concentrated confectionery syrups Raoult
 * systematically OVER-estimates a_w (it ignores solute–water interaction), and
 * an over-estimate of a_w is the safe direction for a warning but the wrong
 * direction for a stability claim.
 */
export function raoultWaterActivity(waterMoles: number, solutes: readonly SoluteMoles[]): number {
  const soluteMoles = solutes.reduce((sum, s) => sum + s.moles, 0);
  const total = waterMoles + soluteMoles;
  if (!(total > 0)) return Number.NaN;
  return waterMoles / total;
}

/**
 * Norrish equation, single solute.
 *
 *     a_w = X_w · exp(−K · X_s²)
 *
 * Norrish (1966) derived it for confectionery syrups from Hildebrand & Scott's
 * activity-coefficient expression ln γ_w = K·X_s². That provenance is the
 * reason it is the right family of model for this application: the original
 * paper is literally about confectionery.
 */
export function norrishWaterActivity(
  waterMoles: number,
  soluteMoles: number,
  norrishK: number,
): number {
  const total = waterMoles + soluteMoles;
  if (!(total > 0)) return Number.NaN;
  const xw = waterMoles / total;
  const xs = soluteMoles / total;
  return xw * Math.exp(-norrishK * xs * xs);
}

/**
 * Norrish equation extended to several solutes.
 *
 *     a_w = X_w · exp(−Σ K_i · X_i²)
 *
 * This multi-solute form is the one published by FAO for mixed fruit/sugar
 * systems (Bulletin 149 ch. 4), which uses it with sucrose and citric acid
 * together. Mole fractions are taken over the WHOLE aqueous phase — water plus
 * every dissolved species — so the X_i are consistent with X_w.
 *
 * NOTE ON RIGOUR: summing K_i·X_i² assumes the solutes do not interact with
 * each other, only with water. For a sugar mixture that assumption is
 * reasonable and widely used; it is not exact. See 09-model-limitations.md.
 */
export function norrishMultiSoluteWaterActivity(
  waterMoles: number,
  solutes: readonly SoluteMoles[],
): number {
  const soluteMoles = solutes.reduce((sum, s) => sum + s.moles, 0);
  const total = waterMoles + soluteMoles;
  if (!(total > 0)) return Number.NaN;

  const xw = waterMoles / total;
  let exponent = 0;
  for (const s of solutes) {
    const xi = s.moles / total;
    exponent += s.norrishK * xi * xi;
  }
  return xw * Math.exp(-exponent);
}

/**
 * Ross equation: the product of the binary water activities each solute would
 * produce alone in all the available water.
 *
 *     a_w = Π a_w,i
 *
 * Ross (1975) is the standard cross-check on a multi-solute prediction. It
 * neglects solute–solute interaction and is documented to be accurate to about
 * ±0.01 for dilute and moderate mixtures while over-predicting depression for
 * concentrated ones. Used here as a SECOND OPINION, not as the primary answer —
 * agreement between Ross and multi-solute Norrish raises confidence, and
 * disagreement lowers it.
 */
export function rossWaterActivity(waterMoles: number, solutes: readonly SoluteMoles[]): number {
  if (!(waterMoles > 0)) return Number.NaN;
  if (solutes.length === 0) return 1;

  let product = 1;
  for (const s of solutes) {
    if (s.moles <= 0) continue;
    product *= norrishWaterActivity(waterMoles, s.moles, s.norrishK);
  }
  return product;
}

/**
 * Water activity of a pure sucrose solution from its mass concentration.
 *
 * Convenience wrapper used by the validation tests, which compare against
 * published tables expressed in grams rather than moles.
 *
 * @param sucroseGrams grams of sucrose
 * @param waterGrams   grams of water
 */
export function sucroseSolutionWaterActivity(sucroseGrams: number, waterGrams: number): number {
  const MW_SUCROSE = 342.2965;
  const MW_WATER = 18.0153;
  const K_SUCROSE = 6.47;
  return norrishWaterActivity(waterGrams / MW_WATER, sucroseGrams / MW_SUCROSE, K_SUCROSE);
}

/**
 * Equilibrium relative humidity, % (spec §9).
 *
 *     ERH = a_w × 100
 *
 * The identity holds at thermodynamic equilibrium between the product and the
 * air immediately surrounding it, at uniform temperature. It is NOT a claim
 * that the storage room's humidity equals the product's a_w — that only becomes
 * true after the product has equilibrated with the room, which is precisely the
 * moisture-migration process that changes the product.
 */
export function waterActivityToERH(aw: number): number {
  return aw * 100;
}

export function erhToWaterActivity(erhPercent: number): number {
  return erhPercent / 100;
}

/**
 * Undissociated fraction of a weak acid preservative (Henderson–Hasselbalch).
 *
 *     f = 1 / (1 + 10^(pH − pKa))
 *
 * Only the undissociated molecule crosses the microbial membrane, so this
 * fraction — not the added dose — governs preservative efficacy. At pH 4.0
 * sorbic acid is 85 % undissociated; at pH 6.0 only 5.4 %.
 */
export function undissociatedFraction(pH: number, pKa: number): number {
  if (!Number.isFinite(pH) || !Number.isFinite(pKa)) return Number.NaN;
  return 1 / (1 + Math.pow(10, pH - pKa));
}
