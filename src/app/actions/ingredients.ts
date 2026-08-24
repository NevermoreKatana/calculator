'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { IngredientInputSchema, formatZodErrors } from '@/lib/validation/schemas';
import type { ActionResult } from './recipes';

export async function createIngredient(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = IngredientInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Проверьте поля формы', fieldErrors: formatZodErrors(parsed.error) };
  }
  const input = parsed.data;

  try {
    const componentSum =
      input.sugarPercentage +
      input.fatPercentage +
      input.cocoaButterPercentage +
      input.milkSolidsPercentage +
      input.cocoaSolidsPercentage +
      input.otherSolidsPercentage +
      input.waterPercentage;

    const existing = await prisma.ingredient.findFirst({
      where: { name: input.name, brand: input.brand ?? null },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: 'Ингредиент с таким названием и брендом уже существует.' };
    }

    const created = await prisma.ingredient.create({
      data: { ...input, brand: input.brand ?? null, isCustom: true, componentSum },
      select: { id: true },
    });

    revalidatePath('/ingredients');
    revalidatePath('/calculator');
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `Не удалось создать: ${error.message}` : 'Не удалось создать ингредиент',
    };
  }
}

export async function deleteIngredient(id: string): Promise<ActionResult> {
  if (!id || typeof id !== 'string') return { ok: false, error: 'Некорректный идентификатор' };
  try {
    const usage = await prisma.recipeItem.count({ where: { ingredientId: id } });
    if (usage > 0) {
      return {
        ok: false,
        error: `Ингредиент используется в ${usage} строк(ах) сохранённых рецептов и не может быть удалён.`,
      };
    }
    await prisma.ingredient.delete({ where: { id } });
    revalidatePath('/ingredients');
    revalidatePath('/calculator');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось удалить ингредиент' };
  }
}

/** Imports an external (Open Food Facts) row into the local database. */
export async function importExternalIngredient(payload: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = IngredientInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Данные внешнего источника не прошли валидацию' };
  }
  return createIngredient(parsed.data);
}
