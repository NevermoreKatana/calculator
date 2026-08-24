import { prisma } from '../../db';
import type { Ingredient } from '../../calculator/types';
import type { IngredientFilters, IngredientProvider, ProviderSearchResult } from '../provider';

/**
 * The workbook-derived catalogue in PostgreSQL. This is the authoritative
 * source: its rows carry the full seven-component composition the calculator
 * needs, and it keeps working when every external API is down (spec §46).
 */

type DbIngredient = Awaited<ReturnType<typeof prisma.ingredient.findFirst>>;

function toIngredient(row: NonNullable<DbIngredient>): Ingredient {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    sugarPercentage: row.sugarPercentage,
    fatPercentage: row.fatPercentage,
    cocoaButterPercentage: row.cocoaButterPercentage,
    milkSolidsPercentage: row.milkSolidsPercentage,
    cocoaSolidsPercentage: row.cocoaSolidsPercentage,
    otherSolidsPercentage: row.otherSolidsPercentage,
    waterPercentage: row.waterPercentage,
    sweetness: row.sweetness,
    pricePerKg: row.pricePerKg,
    source: row.source,
    sourceUrl: row.sourceUrl,
    isCustom: row.isCustom,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const LocalIngredientProvider: IngredientProvider = {
  id: 'local',
  label: 'Локальная база (Excel + пользовательские)',
  dataQuality: 'authoritative',

  async search(query, filters: IngredientFilters = {}): Promise<ProviderSearchResult> {
    try {
      const rows = await prisma.ingredient.findMany({
        where: {
          ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
          ...(filters.category ? { category: filters.category } : {}),
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: filters.limit ?? 100,
      });
      return { ingredients: rows.map(toIngredient), ok: true, providerId: 'local' };
    } catch (error) {
      return {
        ingredients: [],
        ok: false,
        providerId: 'local',
        error: error instanceof Error ? error.message : 'Ошибка базы данных',
      };
    }
  },

  async getById(id): Promise<Ingredient | null> {
    try {
      const row = await prisma.ingredient.findUnique({ where: { id } });
      return row ? toIngredient(row) : null;
    } catch {
      return null;
    }
  },
};

export async function listAllIngredients(): Promise<Ingredient[]> {
  const rows = await prisma.ingredient.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toIngredient);
}
