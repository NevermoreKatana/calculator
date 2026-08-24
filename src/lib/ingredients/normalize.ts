import { z } from 'zod';
import type { Ingredient, IngredientCategory } from '../calculator/types';
import { INGREDIENT_CATEGORIES } from '../calculator/types';

/**
 * Normalizer + validation stage of the provider pipeline (spec §30).
 * Anything that fails validation is dropped rather than half-imported.
 */

const clampPercent = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
};

export const NormalizedIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(300),
  category: z.enum(INGREDIENT_CATEGORIES),
  brand: z.string().trim().max(200).nullable(),
  sugarPercentage: z.number().min(0).max(100),
  fatPercentage: z.number().min(0).max(100),
  cocoaButterPercentage: z.number().min(0).max(100),
  milkSolidsPercentage: z.number().min(0).max(100),
  cocoaSolidsPercentage: z.number().min(0).max(100),
  otherSolidsPercentage: z.number().min(0).max(100),
  waterPercentage: z.number().min(0).max(100),
  sweetness: z.number().min(0).max(300),
  pricePerKg: z.number().min(0).nullable(),
  source: z.string().max(300).nullable(),
  sourceUrl: z.string().max(500).nullable(),
  isCustom: z.boolean(),
});

export interface RawComposition {
  id: string;
  name: string;
  brand?: string | null;
  category?: IngredientCategory;
  sugarPercentage?: number;
  fatPercentage?: number;
  cocoaButterPercentage?: number;
  milkSolidsPercentage?: number;
  cocoaSolidsPercentage?: number;
  otherSolidsPercentage?: number;
  waterPercentage?: number;
  sweetness?: number;
  pricePerKg?: number | null;
  source?: string | null;
  sourceUrl?: string | null;
}

/** Returns a validated Ingredient, or null when the row is unusable. */
export function normalizeIngredient(raw: RawComposition): Ingredient | null {
  const candidate = {
    id: raw.id,
    name: (raw.name ?? '').trim(),
    category: raw.category ?? ('other' as IngredientCategory),
    brand: raw.brand?.trim() || null,
    sugarPercentage: clampPercent(raw.sugarPercentage),
    fatPercentage: clampPercent(raw.fatPercentage),
    cocoaButterPercentage: clampPercent(raw.cocoaButterPercentage),
    milkSolidsPercentage: clampPercent(raw.milkSolidsPercentage),
    cocoaSolidsPercentage: clampPercent(raw.cocoaSolidsPercentage),
    otherSolidsPercentage: clampPercent(raw.otherSolidsPercentage),
    waterPercentage: clampPercent(raw.waterPercentage),
    sweetness: Number.isFinite(raw.sweetness) ? Math.max(0, Math.min(raw.sweetness!, 300)) : 0,
    pricePerKg:
      typeof raw.pricePerKg === 'number' && Number.isFinite(raw.pricePerKg) && raw.pricePerKg >= 0
        ? raw.pricePerKg
        : null,
    source: raw.source ?? null,
    sourceUrl: raw.sourceUrl ?? null,
    isCustom: false,
  };

  const parsed = NormalizedIngredientSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
