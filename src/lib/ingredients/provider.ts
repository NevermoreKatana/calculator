import type { Ingredient, IngredientCategory } from '../calculator/types';

/**
 * Ingredient source abstraction (spec §30).
 *
 *   External API → Provider → Normalizer → Zod validation → Ingredient → DB
 *
 * Every provider returns the SAME internal `Ingredient` shape, so the calculator
 * neither knows nor cares where a row came from. Adding a professional
 * confectionery-supplier API later means writing one more implementation of
 * this interface — nothing else changes.
 */

export interface IngredientFilters {
  category?: IngredientCategory | null;
  limit?: number;
}

export interface ProviderSearchResult {
  ingredients: Ingredient[];
  /** False when the provider failed; the UI degrades instead of breaking. */
  ok: boolean;
  /** User-facing explanation when `ok` is false. */
  error?: string;
  providerId: string;
}

export interface IngredientProvider {
  id: string;
  label: string;
  /**
   * How complete the composition data is. `partial` providers cannot fill all
   * seven components and must say so in the UI.
   */
  dataQuality: 'authoritative' | 'partial';
  search(query: string, filters?: IngredientFilters): Promise<ProviderSearchResult>;
  getById(id: string): Promise<Ingredient | null>;
}
