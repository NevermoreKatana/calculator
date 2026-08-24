import type { Ingredient } from '../../calculator/types';
import { normalizeIngredient } from '../normalize';
import type { IngredientFilters, IngredientProvider, ProviderSearchResult } from '../provider';

/**
 * Open Food Facts adapter (spec §31).
 *
 * ── What this provider can and cannot give you ───────────────────────────────
 * Open Food Facts is a general consumer-food database, NOT a professional
 * confectionery-ingredient database. Its nutrition panel supplies:
 *     sugars, fat, carbohydrates, proteins, salt, energy
 * It does NOT supply the split the calculator actually needs:
 *     cocoa butter vs other fat · milk solids · cocoa solids · water
 *
 * So results are marked `partial`: sugar and fat are mapped from real fields,
 * everything else is left at 0 and the residual shows up as "не учтено". The
 * UI labels these rows so a user never mistakes them for workbook-grade data.
 *
 * Water is deliberately NOT inferred as 100 − (fat + carbs + protein + …).
 * That subtraction silently absorbs ash, fibre and rounding error into the one
 * number the whole shelf-life model keys off, which is exactly the kind of
 * invented value this project refuses to produce (spec §51).
 */

const BASE_URL = process.env.OPEN_FOOD_FACTS_BASE_URL ?? 'https://world.openfoodfacts.org';
const TIMEOUT_MS = Number(process.env.EXTERNAL_LOOKUP_TIMEOUT_MS ?? 6000);
const USER_AGENT = 'GanacheCalculator/1.0 (recipe formulation tool)';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

const numberOf = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Times out rather than hanging a request forever (spec §47). */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

function toIngredient(product: OffProduct): Ingredient | null {
  const name = product.product_name?.trim();
  if (!name || !product.code) return null;

  const n = product.nutriments ?? {};
  // OFF reports "_100g" fields, i.e. grams per 100 g == percent by mass.
  const sugars = numberOf(n['sugars_100g']) ?? 0;
  const fat = numberOf(n['fat_100g']) ?? 0;

  return normalizeIngredient({
    id: `off:${product.code}`,
    name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    category: 'other',
    sugarPercentage: sugars,
    // OFF cannot separate cocoa butter from other fat, so everything lands in
    // the generic fat column and cocoaButterPercentage stays 0.
    fatPercentage: fat,
    cocoaButterPercentage: 0,
    milkSolidsPercentage: 0,
    cocoaSolidsPercentage: 0,
    otherSolidsPercentage: 0,
    // Not inferable from a nutrition panel — left unknown on purpose.
    waterPercentage: 0,
    sweetness: sugars,
    pricePerKg: null,
    source: 'Open Food Facts (неполные данные: только сахара и жиры)',
    sourceUrl: `https://world.openfoodfacts.org/product/${product.code}`,
  });
}

export const OpenFoodFactsProvider: IngredientProvider = {
  id: 'open-food-facts',
  label: 'Open Food Facts (внешний источник, неполные данные)',
  dataQuality: 'partial',

  async search(query, filters: IngredientFilters = {}): Promise<ProviderSearchResult> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { ingredients: [], ok: true, providerId: 'open-food-facts' };
    }

    const limit = Math.min(filters.limit ?? 20, 50);
    const url =
      `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
      `&search_simple=1&action=process&json=1&page_size=${limit}` +
      `&fields=code,product_name,brands,nutriments`;

    try {
      const response = await fetchWithTimeout(url);

      if (response.status === 429) {
        return {
          ingredients: [],
          ok: false,
          providerId: 'open-food-facts',
          error: 'Внешняя база ограничила частоту запросов. Попробуйте позже.',
        };
      }
      if (!response.ok) {
        return {
          ingredients: [],
          ok: false,
          providerId: 'open-food-facts',
          error: `Внешняя база вернула статус ${response.status}.`,
        };
      }

      const payload: unknown = await response.json();
      const products =
        payload && typeof payload === 'object' && Array.isArray((payload as { products?: unknown }).products)
          ? ((payload as { products: OffProduct[] }).products)
          : [];

      const ingredients = products
        .map(toIngredient)
        .filter((value): value is Ingredient => value !== null);

      return { ingredients, ok: true, providerId: 'open-food-facts' };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        ingredients: [],
        ok: false,
        providerId: 'open-food-facts',
        error: aborted
          ? 'Внешняя база не ответила вовремя.'
          : 'Внешняя база временно недоступна.',
      };
    }
  },

  async getById(id): Promise<Ingredient | null> {
    const code = id.startsWith('off:') ? id.slice(4) : id;
    if (!/^\d{4,16}$/.test(code)) return null;
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/api/v2/product/${code}.json`);
      if (!response.ok) return null;
      const payload = (await response.json()) as { product?: OffProduct };
      return payload.product ? toIngredient(payload.product) : null;
    } catch {
      return null;
    }
  },
};
