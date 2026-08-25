'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { EMPTY_RECIPE, useRecipe } from '@/lib/store/recipe-store';
import { deleteRecipe, duplicateRecipe } from '@/app/actions/recipes';
import { formatGrams } from '@/lib/calculator/numeric';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Notice } from '@/components/ui';

export interface SavedRecipeItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  weightGrams: number;
}

export interface SavedRecipe {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  targetTotalWeightGrams: number | null;
  pieceCount: number | null;
  pieceWeightGrams: number | null;
  measuredWaterActivity: number | null;
  useMeasuredAw: boolean;
  storageTemperatureC: number | null;
  productType: string | null;
  notes: string | null;
  items: SavedRecipeItem[];
}

export function RecipesView({ recipes }: { recipes: SavedRecipe[] }) {
  const router = useRouter();
  const { loadRecipe } = useRecipe();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (recipes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<span className="text-3xl">📋</span>}
          title="Сохранённых рецептов пока нет"
          description="Соберите рецепт в калькуляторе и нажмите «Сохранить»."
        />
      </Card>
    );
  }

  /**
   * Loads a saved recipe into the working store and navigates to one of the
   * views that read it. All three destinations show the same recipe — the
   * calculator edits it, /composition breaks it down, /shelf-life estimates it.
   */
  const openAt = (recipe: SavedRecipe, path: '/calculator' | '/composition' | '/shelf-life') => {
    loadRecipe({
      // Spread the empty recipe first so newly added measurement fields default
      // to "not measured" rather than being undefined for older saved rows.
      ...EMPTY_RECIPE,
      id: recipe.id,
      name: recipe.name,
      description: recipe.description ?? '',
      items: recipe.items.map((i) => ({
        id: i.id,
        ingredientId: i.ingredientId,
        weightGrams: i.weightGrams,
      })),
      targetTotalWeightGrams: recipe.targetTotalWeightGrams,
      pieceCount: recipe.pieceCount,
      pieceWeightGrams: recipe.pieceWeightGrams,
      useMeasuredAw: recipe.useMeasuredAw,
      measuredWaterActivity: recipe.measuredWaterActivity,
      storageTemperatureC: recipe.storageTemperatureC,
      productType: recipe.productType ?? '',
      notes: recipe.notes ?? '',
    });
    router.push(path);
  };

  const onDuplicate = async (id: string) => {
    setPendingId(id);
    setError(null);
    const result = await duplicateRecipe(id);
    setPendingId(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? 'Не удалось дублировать');
  };

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить рецепт «${name}»? Действие необратимо.`)) return;
    setPendingId(id);
    setError(null);
    const result = await deleteRecipe(id);
    setPendingId(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? 'Не удалось удалить');
  };

  return (
    <div className="space-y-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => {
          const total = recipe.items.reduce((sum, i) => sum + i.weightGrams, 0);
          const busy = pendingId === recipe.id;
          return (
            <Card key={recipe.id}>
              <CardHeader>
                <CardTitle className="text-base">{recipe.name}</CardTitle>
                <p className="text-muted mt-1 text-xs">
                  {recipe.items.length} ингр. · {formatGrams(total)} ·{' '}
                  {new Date(recipe.updatedAt).toLocaleDateString('ru-RU')}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="text-secondary mb-4 space-y-0.5 text-xs">
                  {recipe.items.slice(0, 4).map((item) => (
                    <li key={item.id} className="tabular flex justify-between gap-2">
                      <span className="truncate">{item.ingredientName}</span>
                      <span className="shrink-0">{formatGrams(item.weightGrams)}</span>
                    </li>
                  ))}
                  {recipe.items.length > 4 ? (
                    <li className="text-muted">…и ещё {recipe.items.length - 4}</li>
                  ) : null}
                </ul>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openAt(recipe, '/calculator')}
                      disabled={busy}
                    >
                      Открыть
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openAt(recipe, '/composition')}
                      disabled={busy}
                    >
                      Состав
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openAt(recipe, '/shelf-life')}
                      disabled={busy}
                    >
                      Срок годности
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDuplicate(recipe.id)}
                      disabled={busy}
                    >
                      Дублировать
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(recipe.id, recipe.name)}
                      disabled={busy}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
