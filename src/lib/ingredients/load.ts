import 'server-only';
import type { Ingredient } from '../calculator/types';
import { isDatabaseConfigured } from '../db';
import { listAllIngredients } from './providers/local';

/**
 * Loads the catalogue without ever letting a database problem crash a page
 * (spec §46). A failure returns an empty list plus a message the UI can show;
 * the calculator itself keeps working, because the engine is pure and does not
 * need the database.
 */
export async function loadIngredientsSafely(): Promise<{
  ingredients: Ingredient[];
  error: string | null;
}> {
  if (!isDatabaseConfigured()) {
    return {
      ingredients: [],
      error:
        'DATABASE_URL не задан. База ингредиентов недоступна — задайте переменную окружения и выполните «npm run import:excel».',
    };
  }

  try {
    return { ingredients: await listAllIngredients(), error: null };
  } catch (error) {
    return {
      ingredients: [],
      error:
        error instanceof Error
          ? `База ингредиентов недоступна: ${error.message}`
          : 'База ингредиентов недоступна.',
    };
  }
}
