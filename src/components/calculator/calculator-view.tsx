'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRecipe } from '@/lib/store/recipe-store';
import { useIngredientsError } from '@/components/app-providers';
import { formatDays, formatGrams, formatPercent, formatRatio, round } from '@/lib/calculator/numeric';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Notice, Stat } from '@/components/ui';
import { IngredientPicker } from './ingredient-picker';
import { CATEGORY_LABELS } from '@/lib/ingredients/labels';
import { SaveRecipeButton } from './save-recipe-button';

export function CalculatorView() {
  const {
    ingredients,
    ingredientsById,
    recipe,
    hydrated,
    calculation,
    waterActivity,
    shelfLife,
    addIngredient,
    updateItemWeight,
    removeItem,
    reorderItem,
    patch,
    reset,
  } = useRecipe();
  const ingredientsError = useIngredientsError();

  const { totals, percentages, analysis, scaling, contributions, warnings } = calculation;
  const contributionById = React.useMemo(
    () => new Map(contributions.map((c) => [c.itemId, c])),
    [contributions],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* min-w-0: without it this grid item adopts min-width:auto and is widened
          by the ingredient table instead of letting it scroll internally. */}
      <div className="min-w-0 space-y-6">
        {ingredientsError ? (
          <Notice tone="danger" title="База ингредиентов недоступна">
            {ingredientsError}
          </Notice>
        ) : null}

        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Label htmlFor="recipe-name" className="mb-0">
                  Название рецепта
                </Label>
                {/* Which record the save buttons will write to must be obvious
                    before the user presses one, not discovered afterwards. */}
                {recipe.id ? (
                  <Badge tone="accent">открыт сохранённый — «Обновить» перезапишет его</Badge>
                ) : (
                  <Badge tone="neutral">новый, ещё не сохранён</Badge>
                )}
              </div>
              <Input
                id="recipe-name"
                value={recipe.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Вишнёвый ганаш"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-5">
              <SaveRecipeButton />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Starting fresh discards the current working recipe, so ask
                  // before throwing away entered weights.
                  if (
                    recipe.items.length === 0 ||
                    window.confirm(
                      'Начать новый рецепт? Текущий расчёт будет очищен. Сохранённые рецепты не пострадают.',
                    )
                  ) {
                    reset();
                  }
                }}
              >
                Новый рецепт
              </Button>
            </div>
          </CardHeader>

          <CardContent className="border-t border-[var(--border-subtle)] pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="piece-count">Количество конфет</Label>
                <Input
                  id="piece-count"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={recipe.pieceCount ?? ''}
                  onChange={(e) =>
                    patch({ pieceCount: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  placeholder="50"
                />
              </div>
              <div>
                <Label htmlFor="piece-weight">Вес одной конфеты, г</Label>
                <Input
                  id="piece-weight"
                  type="number"
                  min={0}
                  step={0.1}
                  inputMode="decimal"
                  value={recipe.pieceWeightGrams ?? ''}
                  onChange={(e) =>
                    patch({
                      pieceWeightGrams: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="18"
                />
              </div>
              <div>
                <Label htmlFor="target-weight">Общий вес, г</Label>
                <Input
                  id="target-weight"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={
                    scaling.pieceCount !== null && scaling.pieceWeightGrams !== null
                      ? round(scaling.targetTotalWeightGrams ?? 0, 2)
                      : (recipe.targetTotalWeightGrams ?? '')
                  }
                  disabled={scaling.pieceCount !== null && scaling.pieceWeightGrams !== null}
                  onChange={(e) =>
                    patch({
                      targetTotalWeightGrams:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="900"
                />
              </div>
            </div>

            {scaling.pieceCount !== null && scaling.pieceWeightGrams !== null ? (
              <p className="text-muted mt-2.5 text-xs">
                {scaling.pieceCount} × {formatGrams(scaling.pieceWeightGrams)} ={' '}
                {formatGrams(scaling.targetTotalWeightGrams)} — общий вес рассчитан по количеству
                конфет.
              </p>
            ) : null}

            {scaling.scaleFactor !== 1 && scaling.baseTotalWeightGrams > 0 ? (
              <p className="text-muted mt-2 text-xs">
                Коэффициент масштабирования: {formatGrams(scaling.targetTotalWeightGrams)} ÷{' '}
                {formatGrams(scaling.baseTotalWeightGrams)} ={' '}
                <span className="tabular font-medium">{round(scaling.scaleFactor, 4)}</span>.
                Проценты не меняются.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ингредиенты</CardTitle>
            <div className="mt-3">
              <IngredientPicker
                ingredients={ingredients}
                onSelect={(ingredient) => addIngredient(ingredient.id)}
              />
            </div>
          </CardHeader>

          <CardContent>
            {!hydrated ? (
              <p className="text-muted py-6 text-center text-sm">Загрузка рецепта…</p>
            ) : recipe.items.length === 0 ? (
              <p className="text-muted py-6 text-center text-sm">
                Добавьте ингредиенты через поиск выше.
              </p>
            ) : (
              <div className="scroll-x -mx-1">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-[11px] tracking-wider uppercase">
                      <th scope="col" className="px-1 py-2 font-medium">Ингредиент</th>
                      <th scope="col" className="px-1 py-2 text-right font-medium">Введено, г</th>
                      <th scope="col" className="px-1 py-2 text-right font-medium">В партии, г</th>
                      <th scope="col" className="px-1 py-2 text-right font-medium">Процент</th>
                      <th scope="col" className="px-1 py-2 font-medium">Категория</th>
                      <th scope="col" className="px-1 py-2"><span className="sr-only">Действия</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.items.map((item) => {
                      const ingredient = ingredientsById.get(item.ingredientId);
                      const contribution = contributionById.get(item.id);
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[var(--border-subtle)] last:border-0"
                        >
                          <td className="px-1 py-2">
                            {ingredient ? (
                              <span>{ingredient.name}</span>
                            ) : (
                              <span className="text-[var(--danger)]">
                                Ингредиент удалён из базы
                              </span>
                            )}
                          </td>
                          <td className="px-1 py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              inputMode="decimal"
                              aria-label={`Вес: ${ingredient?.name ?? 'ингредиент'}`}
                              value={item.weightGrams === 0 ? '' : item.weightGrams}
                              onChange={(e) =>
                                updateItemWeight(
                                  item.id,
                                  e.target.value === '' ? 0 : Number(e.target.value),
                                )
                              }
                              className="tabular h-8 w-24 text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="tabular px-1 py-2 text-right">
                            {formatGrams(contribution?.weightGrams ?? 0)}
                          </td>
                          <td className="tabular px-1 py-2 text-right font-medium">
                            {formatPercent(contribution?.percentage ?? 0, 2)}
                          </td>
                          <td className="px-1 py-2">
                            {ingredient ? (
                              <Badge>{CATEGORY_LABELS[ingredient.category]}</Badge>
                            ) : null}
                          </td>
                          <td className="px-1 py-2">
                            <div className="flex justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Переместить выше"
                                onClick={() => reorderItem(item.id, -1)}
                                className="h-7 w-7 px-0"
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Переместить ниже"
                                onClick={() => reorderItem(item.id, 1)}
                                className="h-7 w-7 px-0"
                              >
                                ↓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Удалить ингредиент"
                                onClick={() => removeItem(item.id)}
                                className="h-7 w-7 px-0 text-[var(--danger)]"
                              >
                                ✕
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium">
                      <td className="px-1 py-2.5">Итого</td>
                      <td className="tabular px-1 py-2.5 text-right">
                        {formatGrams(scaling.baseTotalWeightGrams)}
                      </td>
                      <td className="tabular px-1 py-2.5 text-right">
                        {formatGrams(totals.totalWeightGrams)}
                      </td>
                      <td className="tabular px-1 py-2.5 text-right">
                        {formatPercent(
                          contributions.reduce((s, c) => s + c.percentage, 0),
                          2,
                        )}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {warnings.length > 0 ? (
          <div className="space-y-2">
            {warnings.map((warning) => (
              <Notice
                key={warning.code}
                tone={warning.code === 'component_sum_exceeds_100' ? 'danger' : 'warning'}
                title={warning.message}
              >
                {warning.detail ? (
                  <p className="text-xs opacity-90">{warning.detail}</p>
                ) : null}
              </Notice>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Общий вес" value={formatGrams(totals.totalWeightGrams)} />
          <Stat label="Ингредиентов" value={totals.itemCount} />
          <Stat label="Вода" value={formatPercent(percentages.waterPercentage)} hint={formatGrams(totals.waterGrams)} />
          <Stat label="Сахара" value={formatPercent(percentages.sugarPercentage)} hint={formatGrams(totals.sugarGrams)} />
          <Stat label="Сухая масса" value={formatPercent(percentages.dryMatterPercentage)} hint={formatGrams(totals.dryMatterGrams)} />
          <Stat
            label="Общие жиры"
            value={formatPercent(percentages.totalFatPercentage)}
            hint="ориентир 28–32 %"
            tone={
              percentages.totalFatPercentage >= 28 && percentages.totalFatPercentage <= 32
                ? 'success'
                : 'neutral'
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сахар / вода</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular font-display text-3xl font-semibold">
              {formatRatio(analysis.sugarWaterRatio)}
            </p>
            <p className="text-muted mt-1 text-xs">
              {analysis.sugarWaterRatio === null
                ? 'В рецепте нет воды — отношение не определено.'
                : `${formatGrams(totals.sugarGrams)} сахаров на ${formatGrams(totals.waterGrams)} воды.`}
            </p>
            <p className="text-muted mt-2 text-xs">
              Вспомогательный аналитический показатель, не формула срока годности.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Вода и a_w — это разное</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary text-sm">Вода в рецептуре</span>
              <span className="tabular font-medium">
                {formatPercent(percentages.waterPercentage)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary text-sm">Активность воды a_w</span>
              <span className="tabular font-medium">
                {waterActivity.result.value !== null
                  ? waterActivity.result.value.toFixed(3)
                  : 'не определено'}
              </span>
            </div>
            <p className="text-muted text-xs">
              Источник a_w:{' '}
              {waterActivity.result.source === 'measured'
                ? 'Измеренное значение'
                : waterActivity.result.source === 'reference'
                  ? 'Справочное измерение'
                  : 'Нет данных'}
            </p>
            <Link
              href="/shelf-life"
              className="text-accent inline-block text-xs font-medium hover:underline"
            >
              Ввести измеренный a_w →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Теоретическая оценка срока</CardTitle>
          </CardHeader>
          <CardContent>
            {shelfLife.available && shelfLife.daysMin !== null && shelfLife.daysMax !== null ? (
              <>
                <p className="tabular font-display text-3xl font-semibold">
                  ≈ {formatDays(shelfLife.daysMin, shelfLife.daysMax)}{' '}
                  <span className="text-lg font-normal">дней</span>
                </p>
                <p className="text-muted mt-1.5 text-xs">Метод: {shelfLife.methodLabel}</p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-semibold">Недостаточно данных</p>
                <p className="text-muted mt-1.5 text-xs">{shelfLife.reason}</p>
              </>
            )}
            <p className="mt-3 text-xs text-[var(--danger)]">{shelfLife.disclaimer.headline}</p>
            <Link
              href="/shelf-life"
              className="text-accent mt-2 inline-block text-xs font-medium hover:underline"
            >
              Подробнее о сроке годности →
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
