import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { NewRecipeButton } from '@/components/new-recipe-button';
import { RecipesView } from '@/components/recipes-view';
import { ExampleRecipesView } from '@/components/examples/example-recipes-view';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { Notice } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Рецепты',
  description: 'Сохранённые рецептуры ганаша и начинок.',
};

export const dynamic = 'force-dynamic';

async function loadRecipes() {
  if (!isDatabaseConfigured()) {
    return { recipes: [], error: 'DATABASE_URL не задан — сохранённые рецепты недоступны.' };
  }
  try {
    const recipes = await prisma.recipe.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { ingredient: true },
        },
      },
    });
    return { recipes, error: null };
  } catch (error) {
    return {
      recipes: [],
      error: error instanceof Error ? `База недоступна: ${error.message}` : 'База недоступна',
    };
  }
}

export default async function RecipesPage() {
  const { recipes, error } = await loadRecipes();

  return (
    <PageShell
      title="Рецепты"
      subtitle="Ваши сохранённые рецептуры и разобранные примеры, каждый из которых показывает одно конкретное явление."
      actions={<NewRecipeButton />}
    >
      {error ? (
        <Notice tone="danger" title="Не удалось загрузить рецепты">{error}</Notice>
      ) : (
        <RecipesView
          recipes={recipes.map((recipe) => ({
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            updatedAt: recipe.updatedAt.toISOString(),
            targetTotalWeightGrams: recipe.targetTotalWeightGrams,
            pieceCount: recipe.pieceCount,
            pieceWeightGrams: recipe.pieceWeightGrams,
            measuredWaterActivity: recipe.measuredWaterActivity,
            useMeasuredAw: recipe.useMeasuredAw,
            storageTemperatureC: recipe.storageTemperatureC,
            productType: recipe.productType,
            notes: recipe.notes,
            items: recipe.items.map((i) => ({
              id: i.id,
              ingredientId: i.ingredientId,
              ingredientName: i.ingredient.name,
              weightGrams: i.weightGrams,
            })),
          }))}
        />
      )}

      <section className="mt-10">
        <h2 className="font-display mb-1 text-2xl font-semibold tracking-tight">
          Примеры с разбором
        </h2>
        <p className="text-secondary mb-5 max-w-2xl text-sm">
          Готовые рецептуры, каждая из которых демонстрирует одно явление. Подпись говорит, что
          именно вы увидите; значения в подписях проверяются тестами против расчётного ядра.
        </p>
        <ExampleRecipesView />
      </section>
    </PageShell>
  );
}
