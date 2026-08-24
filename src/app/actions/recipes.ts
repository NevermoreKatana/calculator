'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { RecipeInputSchema, formatZodErrors } from '@/lib/validation/schemas';

/**
 * Recipe CRUD as server actions (spec §40).
 * Every payload is re-validated on the server — the client schema is a
 * convenience, never the security boundary (spec §47).
 */

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function saveRecipe(
  recipeId: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = RecipeInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Проверьте поля формы', fieldErrors: formatZodErrors(parsed.error) };
  }
  const input = parsed.data;

  try {
    // Reject unknown ingredient ids before writing, so a stale client cannot
    // create dangling rows.
    if (input.items.length > 0) {
      const ids = [...new Set(input.items.map((i) => i.ingredientId))];
      const found = await prisma.ingredient.count({ where: { id: { in: ids } } });
      if (found !== ids.length) {
        return { ok: false, error: 'Часть ингредиентов не найдена в базе. Обновите страницу.' };
      }
    }

    const data = {
      name: input.name,
      description: input.description ?? null,
      targetTotalWeightGrams: input.targetTotalWeightGrams ?? null,
      pieceCount: input.pieceCount ?? null,
      pieceWeightGrams: input.pieceWeightGrams ?? null,
      measuredWaterActivity: input.measuredWaterActivity ?? null,
      useMeasuredAw: input.useMeasuredAw,
      storageTemperatureC: input.storageTemperatureC ?? null,
      productType: input.productType ?? null,
      notes: input.notes ?? null,
    };

    const items = input.items.map((item, index) => ({
      ingredientId: item.ingredientId,
      weightGrams: item.weightGrams,
      position: item.position || index,
    }));

    const saved = recipeId
      ? await prisma.$transaction(async (tx) => {
          await tx.recipeItem.deleteMany({ where: { recipeId } });
          return tx.recipe.update({
            where: { id: recipeId },
            data: { ...data, items: { create: items } },
            select: { id: true },
          });
        })
      : await prisma.recipe.create({
          data: { ...data, items: { create: items } },
          select: { id: true },
        });

    revalidatePath('/recipes');
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `Не удалось сохранить: ${error.message}` : 'Не удалось сохранить рецепт',
    };
  }
}

export async function deleteRecipe(recipeId: string): Promise<ActionResult> {
  if (!recipeId || typeof recipeId !== 'string') {
    return { ok: false, error: 'Некорректный идентификатор рецепта' };
  }
  try {
    await prisma.recipe.delete({ where: { id: recipeId } });
    revalidatePath('/recipes');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось удалить рецепт' };
  }
}

export async function duplicateRecipe(recipeId: string): Promise<ActionResult<{ id: string }>> {
  if (!recipeId || typeof recipeId !== 'string') {
    return { ok: false, error: 'Некорректный идентификатор рецепта' };
  }
  try {
    const source = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { items: true },
    });
    if (!source) return { ok: false, error: 'Рецепт не найден' };

    const copy = await prisma.recipe.create({
      data: {
        name: `${source.name} (копия)`,
        description: source.description,
        targetTotalWeightGrams: source.targetTotalWeightGrams,
        pieceCount: source.pieceCount,
        pieceWeightGrams: source.pieceWeightGrams,
        measuredWaterActivity: source.measuredWaterActivity,
        useMeasuredAw: source.useMeasuredAw,
        storageTemperatureC: source.storageTemperatureC,
        productType: source.productType,
        notes: source.notes,
        items: {
          create: source.items.map((i) => ({
            ingredientId: i.ingredientId,
            weightGrams: i.weightGrams,
            position: i.position,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath('/recipes');
    return { ok: true, data: { id: copy.id } };
  } catch {
    return { ok: false, error: 'Не удалось дублировать рецепт' };
  }
}
