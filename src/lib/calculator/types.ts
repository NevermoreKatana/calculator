/**
 * Domain types for the Ganache Calculator.
 *
 * The component model is a direct, verified reconstruction of the `Database`
 * sheet of `формирование ганаша программа.xlsx` (columns B..J), which the
 * `calculator` sheet consumes through VLOOKUP with the column indices held in
 * calculator!D1:J1. See docs/calculation-model.md for the full mapping.
 *
 * All percentage fields are expressed as 0..100 percent OF THE INGREDIENT MASS
 * (the Excel source stored them as 0..1 fractions; the importer multiplies by 100).
 */

export const INGREDIENT_CATEGORIES = [
  'chocolate',
  'cocoa',
  'dairy',
  'fruit',
  'sugar',
  'nut',
  'alcohol',
  'fat',
  'other',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/**
 * The seven composition components that partition an ingredient's mass.
 * Excel Database column letters given for traceability.
 */
export const COMPOSITION_COMPONENTS = [
  'sugar', // Database!B  сахара
  'fat', // Database!C  раст. жиры и молочные (all fats EXCEPT cocoa butter)
  'cocoaButter', // Database!D  масло какао
  'milkSolids', // Database!E  сухое молоко
  'cocoaSolids', // Database!F  сухие какао
  'otherSolids', // Database!G  прочие сухие
  'water', // Database!H  вода
] as const;

export type CompositionComponent = (typeof COMPOSITION_COMPONENTS)[number];

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  brand: string | null;

  /** Percent of ingredient mass, 0..100. */
  sugarPercentage: number;
  /** Fats other than cocoa butter (vegetable + milk fat). Percent, 0..100. */
  fatPercentage: number;
  cocoaButterPercentage: number;
  milkSolidsPercentage: number;
  cocoaSolidsPercentage: number;
  otherSolidsPercentage: number;
  waterPercentage: number;

  /**
   * Relative sweetness index carried by the ingredient (Database!J, "сладость").
   * Sucrose = its own sugar fraction; e.g. inverted sugar is 1.27, sorbitol 0.5.
   * Expressed on the same 0..100 scale as the other percentage columns.
   */
  sweetness: number;

  /** Price per kilogram in the user's currency. `null` when unknown. */
  pricePerKg: number | null;

  source: string | null;
  sourceUrl: string | null;
  isCustom: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/** One line of a recipe. */
export interface RecipeItemInput {
  id: string;
  ingredient: Ingredient;
  weightGrams: number;
}

export interface RecipeInput {
  name?: string;
  items: RecipeItemInput[];
  /** When set, the recipe is scaled so the total equals this weight. */
  targetTotalWeightGrams?: number | null;
  /** Piece-based sizing: pieceCount × pieceWeightGrams becomes the target weight. */
  pieceCount?: number | null;
  pieceWeightGrams?: number | null;
}

/** Absolute grams of each component contributed by one ingredient line. */
export interface IngredientContribution {
  itemId: string;
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  /** Weight after scaling, in grams. */
  weightGrams: number;
  /** weightGrams / totalWeightGrams × 100 */
  percentage: number;

  sugarGrams: number;
  fatGrams: number;
  cocoaButterGrams: number;
  milkSolidsGrams: number;
  cocoaSolidsGrams: number;
  otherSolidsGrams: number;
  waterGrams: number;

  /**
   * Mass not described by any of the seven components, i.e.
   * weightGrams − Σ(component grams). Positive when the source row sums to
   * less than 100 %, negative when it sums to more (both occur in the Excel
   * Database — see docs/calculation-model.md §"Data quality").
   */
  unaccountedGrams: number;

  sweetnessGrams: number;
  costValue: number | null;
}

export interface RecipeTotals {
  totalWeightGrams: number;
  itemCount: number;

  sugarGrams: number;
  fatGrams: number;
  cocoaButterGrams: number;
  milkSolidsGrams: number;
  cocoaSolidsGrams: number;
  otherSolidsGrams: number;
  waterGrams: number;
  unaccountedGrams: number;

  /** fatGrams + cocoaButterGrams — Excel calculator!D36 "общие жиры". */
  totalFatGrams: number;
  /** totalWeightGrams − waterGrams. */
  dryMatterGrams: number;
  /** Σ of the six non-water components; ≤ dryMatterGrams. */
  accountedSolidsGrams: number;

  sweetnessGrams: number;
  /** Total batch cost, or null when no line has a known price. */
  totalCost: number | null;
  /** totalCost / totalWeightGrams × 1000 — Excel calculator!M31 "за кг". */
  costPerKg: number | null;
}

/** Every total also expressed as a percent of totalWeightGrams. */
export interface RecipePercentages {
  sugarPercentage: number;
  fatPercentage: number;
  cocoaButterPercentage: number;
  milkSolidsPercentage: number;
  cocoaSolidsPercentage: number;
  otherSolidsPercentage: number;
  waterPercentage: number;
  unaccountedPercentage: number;
  totalFatPercentage: number;
  dryMatterPercentage: number;
  accountedSolidsPercentage: number;
  sweetnessPercentage: number;
}

export interface RecipeAnalysis {
  /**
   * sugarGrams / waterGrams. `null` when the recipe contains no water —
   * deliberately not Infinity, so the UI never renders a non-finite number.
   */
  sugarWaterRatio: number | null;
  /** How much of the total mass the ingredient data actually describes, 0..100. */
  dataCompletenessPercentage: number;
  /** Lines whose ingredient composition sums to well under / over 100 %. */
  incompleteIngredients: { ingredientId: string; name: string; componentSum: number }[];
}

export interface ScalingInfo {
  /** Total of the entered weights, before scaling. */
  baseTotalWeightGrams: number;
  /** Requested total, when the user set one. */
  targetTotalWeightGrams: number | null;
  /** targetTotalWeightGrams / baseTotalWeightGrams; 1 when not scaling. */
  scaleFactor: number;
  pieceCount: number | null;
  pieceWeightGrams: number | null;
  /** Total weight actually used for the calculation. */
  effectiveTotalWeightGrams: number;
}

export interface RecipeCalculation {
  scaling: ScalingInfo;
  contributions: IngredientContribution[];
  totals: RecipeTotals;
  percentages: RecipePercentages;
  analysis: RecipeAnalysis;
  /** Non-fatal problems worth surfacing (empty recipe, zero weights, …). */
  warnings: CalculationWarning[];
}

export interface CalculationWarning {
  code:
    | 'empty_recipe'
    | 'zero_total_weight'
    | 'negative_weight'
    | 'incomplete_ingredient_data'
    | 'component_sum_exceeds_100'
    | 'target_weight_ignored';
  message: string;
  detail?: string;
}
