/**
 * Adapter: RecipeCalculation → scientific model inputs (spec §31, §55).
 *
 * Keeps the layer boundary of spec §31 intact. The recipe arithmetic in
 * src/lib/calculator knows nothing about water activity; the science layer
 * knows nothing about Excel columns or React. This file is the only place the
 * two meet, and it does one job: map the seven-component composition onto the
 * physical categories the aqueous-phase model needs.
 *
 * ── The mapping, and why ──────────────────────────────────────────────────
 *   water        → solvent
 *   sugar        → dissolved solutes, split by species via the profile
 *   fat          → non-solute solid (disperse phase; dissolves nothing)
 *   cocoaButter  → non-solute solid (same)
 *   milkSolids   → non-solute solid, WITH A CAVEAT (below)
 *   cocoaSolids  → non-solute solid (insoluble particles)
 *   otherSolids  → non-solute solid, WITH A CAVEAT (below)
 *
 * CAVEAT ON milkSolids: milk solids-non-fat are ~54 % lactose, ~37 % protein,
 * ~8 % minerals. The lactose fraction IS osmotically active. Whether it is
 * already counted depends on how the source database filled its columns, and
 * the imported workbook is not explicit about it. Rather than double-count or
 * silently drop it, the adapter exposes `milkSolidsLactoseFraction` with a
 * default of 0 (do not double-count) and documents the choice. Setting it to
 * 0.54 is a one-line change once the source data is clarified.
 *
 * CAVEAT ON otherSolids: this column mixes soluble (acids, salts, alcohol
 * solids) and insoluble (fibre, pectin, nut particles) material. Without a
 * breakdown it is treated as insoluble, which UNDER-estimates the a_w
 * depression — the conservative direction for a stability claim.
 */

import type { IngredientContribution, RecipeCalculation } from '../calculator/types';
import type { Ingredient } from '../calculator/types';
import {
  resolveSugarProfile,
  type SugarProfileOverride,
  type SugarProfileResolutionMethod,
} from './ingredient-sugar-profiles';
import { SUGAR_PROFILES, type SugarProfile, type SugarProfileId } from './sugars';
import type { AqueousPhaseContribution } from './aqueous-phase';

export interface RecipeScienceOptions {
  /** Per-ingredient sugar species overrides. */
  sugarProfileOverrides?: readonly SugarProfileOverride[];
  /**
   * Fraction of milk solids to treat as osmotically active lactose.
   * Default 0 — see the caveat in the file header.
   */
  milkSolidsLactoseFraction?: number;
  temperatureCelsius?: number;
  /**
   * Ethanol content per ingredient, as a fraction of the ingredient's mass.
   * The imported database has no alcohol column, so alcohol strength is not
   * derivable and must be supplied to be counted.
   */
  ethanolFractionByIngredientId?: Readonly<Record<string, number>>;
}

export interface AdaptedRecipe {
  contributions: AqueousPhaseContribution[];
  /**
   * One entry per SUGAR-BEARING line. Carries the sugar mass so the a_w model
   * can weight speciation confidence by how much sugar the assignment actually
   * governs — a 1 g uncertain line must not outweigh 220 g of certain one.
   */
  speciation: { method: SugarProfileResolutionMethod; confidence: number; sugarGrams: number }[];
  /** Per-line detail, for the traceability panel. */
  lines: {
    ingredientId: string;
    ingredientName: string;
    sugarGrams: number;
    profileId: SugarProfileId | null;
    method: SugarProfileResolutionMethod;
    confidence: number;
    rationale: string;
  }[];
  /** Ingredient names whose sugar species could not be resolved. */
  unresolvedIngredients: string[];
  totalEthanolGrams: number;
}

/** Minimal shape needed to resolve a profile — keeps the adapter testable. */
type IngredientLike = Pick<Ingredient, 'id' | 'name' | 'category'>;

export function adaptRecipeForScience(
  calculation: RecipeCalculation,
  ingredientsById: ReadonlyMap<string, IngredientLike>,
  options: RecipeScienceOptions = {},
): AdaptedRecipe {
  const milkLactoseFraction = options.milkSolidsLactoseFraction ?? 0;
  const ethanolByIngredient = options.ethanolFractionByIngredientId ?? {};

  const contributions: AqueousPhaseContribution[] = [];
  const speciation: AdaptedRecipe['speciation'] = [];
  const lines: AdaptedRecipe['lines'] = [];
  const unresolvedIngredients: string[] = [];
  let totalEthanolGrams = 0;

  for (const c of calculation.contributions) {
    const ingredient = ingredientsById.get(c.ingredientId) ?? {
      id: c.ingredientId,
      name: c.ingredientName,
      category: c.category,
    };

    const resolved = resolveSugarProfile(ingredient, options.sugarProfileOverrides);

    // Only lines that actually carry sugar affect the speciation confidence.
    if (c.sugarGrams > 0) {
      speciation.push({
        method: resolved.method,
        confidence: resolved.confidence,
        sugarGrams: c.sugarGrams,
      });
      if (resolved.method === 'unresolved') unresolvedIngredients.push(c.ingredientName);
    }

    lines.push({
      ingredientId: c.ingredientId,
      ingredientName: c.ingredientName,
      sugarGrams: c.sugarGrams,
      profileId: resolved.profileId,
      method: resolved.method,
      confidence: resolved.confidence,
      rationale: resolved.rationale,
    });

    const ethanolFraction = ethanolByIngredient[c.ingredientId] ?? 0;
    const ethanolGrams = Math.max(0, c.weightGrams * ethanolFraction);
    totalEthanolGrams += ethanolGrams;

    contributions.push({
      waterGrams: c.waterGrams,
      sugarGrams: c.sugarGrams,
      sugarProfile: resolved.profile,
      nonSoluteSolidsGrams: nonSoluteSolids(c, milkLactoseFraction),
      ethanolGrams,
    });

    // Lactose released from milk solids, when the caller opts in.
    if (milkLactoseFraction > 0 && c.milkSolidsGrams > 0) {
      contributions.push({
        waterGrams: 0,
        sugarGrams: c.milkSolidsGrams * milkLactoseFraction,
        sugarProfile: SUGAR_PROFILES.dairyLactose as SugarProfile,
        nonSoluteSolidsGrams: 0,
      });
    }
  }

  return { contributions, speciation, lines, unresolvedIngredients, totalEthanolGrams };
}

/**
 * Everything in the line that is neither water nor sugar.
 *
 * `unaccountedGrams` is included because it is real mass that the ingredient
 * data failed to describe: excluding it would shrink the product below its
 * actual weight. It is negative for the three over-100 % rows in the imported
 * database, and clamping keeps the aqueous-phase arithmetic sane.
 */
function nonSoluteSolids(c: IngredientContribution, milkLactoseFraction: number): number {
  const milkSolidsRemaining = c.milkSolidsGrams * (1 - milkLactoseFraction);
  return Math.max(
    0,
    c.fatGrams +
      c.cocoaButterGrams +
      milkSolidsRemaining +
      c.cocoaSolidsGrams +
      c.otherSolidsGrams +
      Math.max(0, c.unaccountedGrams),
  );
}
