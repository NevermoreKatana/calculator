export * from './provider';
export * from './normalize';
export { LocalIngredientProvider, listAllIngredients } from './providers/local';
export { OpenFoodFactsProvider } from './providers/open-food-facts';

import { LocalIngredientProvider } from './providers/local';
import { OpenFoodFactsProvider } from './providers/open-food-facts';
import type { IngredientProvider } from './provider';

/**
 * Registry. The local database always comes first: it is the only source with
 * complete composition data, and it must keep working when an external API
 * fails (spec §46).
 */
export const INGREDIENT_PROVIDERS: readonly IngredientProvider[] = [
  LocalIngredientProvider,
  OpenFoodFactsProvider,
];

export function getProvider(id: string): IngredientProvider | undefined {
  return INGREDIENT_PROVIDERS.find((p) => p.id === id);
}
