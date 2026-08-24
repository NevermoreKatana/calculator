import { z } from 'zod';
import { INGREDIENT_CATEGORIES } from '../calculator/types';

/**
 * Server-side validation (spec §47). Every route handler and server action
 * parses its input through these schemas before touching the database.
 */

const percentage = z
  .number({ message: 'Ожидается число' })
  .min(0, 'Не может быть отрицательным')
  .max(100, 'Не может превышать 100 %');

export const IngredientInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Укажите название').max(200, 'Слишком длинное название'),
    category: z.enum(INGREDIENT_CATEGORIES),
    brand: z.string().trim().max(120).nullable().optional().default(null),

    sugarPercentage: percentage.default(0),
    fatPercentage: percentage.default(0),
    cocoaButterPercentage: percentage.default(0),
    milkSolidsPercentage: percentage.default(0),
    cocoaSolidsPercentage: percentage.default(0),
    otherSolidsPercentage: percentage.default(0),
    waterPercentage: percentage.default(0),

    sweetness: z.number().min(0).max(300).default(0),
    pricePerKg: z.number().min(0).max(1_000_000).nullable().optional().default(null),

    source: z.string().trim().max(300).nullable().optional().default(null),
    sourceUrl: z.string().url('Некорректный URL').max(500).nullable().optional().default(null),
  })
  .superRefine((value, ctx) => {
    const sum =
      value.sugarPercentage +
      value.fatPercentage +
      value.cocoaButterPercentage +
      value.milkSolidsPercentage +
      value.cocoaSolidsPercentage +
      value.otherSolidsPercentage +
      value.waterPercentage;
    // Over 100 % is physically impossible; under 100 % is allowed and reported
    // as "не учтено", because most rows of the source workbook are like that.
    if (sum > 100.5) {
      ctx.addIssue({
        code: 'custom',
        path: ['sugarPercentage'],
        message: `Сумма компонентов ${sum.toFixed(1)} % превышает 100 %.`,
      });
    }
  });

export type IngredientInput = z.infer<typeof IngredientInputSchema>;

export const RecipeItemInputSchema = z.object({
  ingredientId: z.string().min(1, 'Выберите ингредиент'),
  weightGrams: z
    .number({ message: 'Ожидается число' })
    .min(0, 'Вес не может быть отрицательным')
    .max(1_000_000, 'Слишком большой вес'),
  position: z.number().int().min(0).default(0),
});

export const RecipeInputSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название рецепта').max(200),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  targetTotalWeightGrams: z.number().min(0).max(1_000_000).nullable().optional().default(null),
  pieceCount: z.number().int().min(0).max(1_000_000).nullable().optional().default(null),
  pieceWeightGrams: z.number().min(0).max(10_000).nullable().optional().default(null),

  /** Instrument reading only. Never populated by a computation. */
  measuredWaterActivity: z
    .number()
    .gt(0, 'a_w должно быть больше 0')
    .max(1, 'a_w не может превышать 1')
    .nullable()
    .optional()
    .default(null),
  useMeasuredAw: z.boolean().default(false),
  storageTemperatureC: z.number().min(-40).max(80).nullable().optional().default(null),
  productType: z.string().trim().max(120).nullable().optional().default(null),
  notes: z.string().trim().max(5000).nullable().optional().default(null),

  items: z.array(RecipeItemInputSchema).max(200, 'Слишком много ингредиентов').default([]),
});

export type RecipeInputPayload = z.infer<typeof RecipeInputSchema>;

export const IngredientSearchSchema = z.object({
  query: z.string().trim().max(200).default(''),
  category: z.enum(INGREDIENT_CATEGORIES).nullable().optional().default(null),
  source: z.enum(['local', 'external', 'all']).default('local'),
  limit: z.number().int().min(1).max(100).default(50),
});

export const SettingsSchema = z.object({
  currency: z.string().trim().min(1).max(10).default('RUB'),
  defaultPieceWeightG: z.number().min(0.1).max(10_000).default(12),
  awModelId: z.enum(['measured', 'reference', 'scientific']).default('measured'),
  enableExternalLookup: z.boolean().default(true),
});

/** Formats a ZodError into `{ field: message }` for form display. */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
