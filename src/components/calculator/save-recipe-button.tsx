'use client';

import * as React from 'react';
import { useRecipe } from '@/lib/store/recipe-store';
import { saveRecipe } from '@/app/actions/recipes';
import { Button } from '@/components/ui';

/**
 * Save controls for the working recipe.
 *
 * Two distinct actions, because they are not interchangeable:
 *   • «Обновить»            — writes over the saved recipe currently open
 *   • «Сохранить как новый» — creates a separate record, leaving the original
 *
 * The second only appears while a saved recipe is open. Without it the only
 * way to branch off an existing recipe was to overwrite it by accident.
 */
export function SaveRecipeButton() {
  const { recipe, patch } = useRecipe();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const disabled = pending || recipe.name.trim() === '' || recipe.items.length === 0;

  /** `targetId === null` creates a new record; otherwise it updates that one. */
  const persist = (targetId: string | null, successText: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveRecipe(targetId, {
        name: recipe.name,
        description: recipe.description || null,
        targetTotalWeightGrams: recipe.targetTotalWeightGrams,
        pieceCount: recipe.pieceCount,
        pieceWeightGrams: recipe.pieceWeightGrams,
        measuredWaterActivity: recipe.measuredWaterActivity,
        useMeasuredAw: recipe.useMeasuredAw,
        storageTemperatureC: recipe.storageTemperatureC,
        productType: recipe.productType || null,
        notes: recipe.notes || null,
        items: recipe.items.map((item, index) => ({
          ingredientId: item.ingredientId,
          weightGrams: item.weightGrams,
          position: index,
        })),
      });

      if (result.ok && result.data) {
        // Continue editing whichever record was just written.
        patch({ id: result.data.id });
        setMessage({ tone: 'ok', text: successText });
      } else {
        setMessage({ tone: 'error', text: result.error ?? 'Ошибка сохранения' });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={() => persist(recipe.id, recipe.id ? 'Рецепт обновлён' : 'Рецепт сохранён')}
        disabled={disabled}
      >
        {pending ? 'Сохранение…' : recipe.id ? 'Обновить' : 'Сохранить'}
      </Button>

      {recipe.id ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => persist(null, 'Создан отдельный рецепт')}
          disabled={disabled}
          title="Создать отдельную запись, не изменяя открытый рецепт"
        >
          Сохранить как новый
        </Button>
      ) : null}

      {message ? (
        <span
          role="status"
          className={
            message.tone === 'ok'
              ? 'text-xs text-[var(--success)]'
              : 'text-xs text-[var(--danger)]'
          }
        >
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
