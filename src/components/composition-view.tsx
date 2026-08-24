'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRecipe } from '@/lib/store/recipe-store';
import { formatGrams, formatPercent, formatRatio } from '@/lib/calculator/numeric';
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  EmptyState, Notice, ProgressBar, Stat,
} from '@/components/ui';
import { CompositionChart, COMPOSITION_COLORS, buildCompositionSlices } from '@/components/charts/composition-chart';
import { CATEGORY_LABELS } from '@/lib/ingredients/labels';

export function CompositionView() {
  const { recipe, hydrated, calculation } = useRecipe();
  const { totals, percentages, analysis, contributions } = calculation;

  const slices = React.useMemo(
    () =>
      buildCompositionSlices({
        totalFatGrams: totals.totalFatGrams,
        sugarGrams: totals.sugarGrams,
        cocoaSolidsGrams: totals.cocoaSolidsGrams,
        milkSolidsGrams: totals.milkSolidsGrams,
        otherSolidsGrams: totals.otherSolidsGrams,
        waterGrams: totals.waterGrams,
        unaccountedGrams: totals.unaccountedGrams,
        totalWeightGrams: totals.totalWeightGrams,
      }),
    [totals],
  );

  if (!hydrated) {
    return <p className="text-muted py-10 text-center text-sm">Загрузка…</p>;
  }

  if (recipe.items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<span className="text-3xl">🍫</span>}
          title="Рецепт пуст"
          description="Добавьте ингредиенты в калькуляторе, чтобы увидеть состав."
          action={
            <Link href="/calculator" className="text-accent text-sm font-medium hover:underline">
              Перейти к калькулятору →
            </Link>
          }
        />
      </Card>
    );
  }

  const bars = [
    { label: 'Общие жиры', value: percentages.totalFatPercentage, color: COMPOSITION_COLORS.fat, hint: 'ориентир 28–32 %' },
    { label: 'Сахара', value: percentages.sugarPercentage, color: COMPOSITION_COLORS.sugar },
    { label: 'Какао сухие', value: percentages.cocoaSolidsPercentage, color: COMPOSITION_COLORS.cocoaSolids },
    { label: 'Молочные сухие', value: percentages.milkSolidsPercentage, color: COMPOSITION_COLORS.milkSolids },
    { label: 'Прочие сухие', value: percentages.otherSolidsPercentage, color: COMPOSITION_COLORS.otherSolids },
    { label: 'Вода', value: percentages.waterPercentage, color: COMPOSITION_COLORS.water },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Общий вес" value={formatGrams(totals.totalWeightGrams)} />
        <Stat label="Количество ингредиентов" value={totals.itemCount} />
        <Stat
          label="Сухая масса"
          value={formatPercent(percentages.dryMatterPercentage)}
          hint={formatGrams(totals.dryMatterGrams)}
        />
        <Stat
          label="Сахар / вода"
          value={formatRatio(analysis.sugarWaterRatio)}
          hint={analysis.sugarWaterRatio === null ? 'воды нет' : 'вспомогательный показатель'}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Диаграмма состава</CardTitle>
            <CardDescription>
              Категории соответствуют диаграмме из исходной книги Excel (calculator!C36:D41).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompositionChart slices={slices} totalGrams={totals.totalWeightGrams} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Показатели</CardTitle>
            <CardDescription>Доля каждого компонента от общей массы.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm">{bar.label}</span>
                  <span className="tabular text-sm font-medium">{formatPercent(bar.value)}</span>
                </div>
                <ProgressBar value={bar.value} color={bar.color} />
                {bar.hint ? <p className="text-muted mt-1 text-[11px]">{bar.hint}</p> : null}
              </div>
            ))}

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm">Полнота данных</span>
                <span className="tabular text-sm font-medium">
                  {formatPercent(analysis.dataCompletenessPercentage)}
                </span>
              </div>
              <ProgressBar
                value={analysis.dataCompletenessPercentage}
                color={
                  analysis.dataCompletenessPercentage > 97
                    ? 'var(--success)'
                    : 'var(--warning)'
                }
              />
              <p className="text-muted mt-1 text-[11px]">
                Доля массы, описанная составом ингредиентов. Остаток —{' '}
                {formatPercent(percentages.unaccountedPercentage)} — показан как «не учтено» и не
                перераспределяется.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {analysis.incompleteIngredients.length > 0 ? (
        <Notice tone="warning" title="Состав описан не полностью">
          <p className="mb-2 text-xs">
            Эти строки исходной таблицы не суммируются до 100 %. Значения импортированы как есть,
            без нормализации:
          </p>
          <ul className="space-y-0.5 text-xs">
            {analysis.incompleteIngredients.map((i) => (
              <li key={i.ingredientId} className="tabular">
                {i.name} — {i.componentSum.toFixed(1)} %
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Вклад ингредиентов</CardTitle>
          <CardDescription>Абсолютные граммы каждого компонента по строкам рецепта.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="scroll-x">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-[11px] tracking-wider uppercase">
                  <th scope="col" className="px-2 py-2 font-medium">Ингредиент</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Вес</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">%</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Сахара</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Жиры</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">М.какао</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Мол.сух.</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Какао сух.</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Проч.сух.</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Вода</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Не учтено</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {contributions.map((c) => (
                  <tr key={c.itemId} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-2 py-2">
                      <span className="mr-2">{c.ingredientName}</span>
                      <Badge>{CATEGORY_LABELS[c.category]}</Badge>
                    </td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.weightGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatPercent(c.percentage, 2)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.sugarGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.fatGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.cocoaButterGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.milkSolidsGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.cocoaSolidsGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.otherSolidsGrams)}</td>
                    <td className="px-2 py-2 text-right">{formatGrams(c.waterGrams)}</td>
                    <td className={c.unaccountedGrams < 0 ? 'px-2 py-2 text-right text-[var(--danger)]' : 'px-2 py-2 text-right'}>
                      {formatGrams(c.unaccountedGrams)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tabular font-medium">
                  <td className="px-2 py-2.5">Итого</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.totalWeightGrams)}</td>
                  <td className="px-2 py-2.5 text-right">100.0 %</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.sugarGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.fatGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.cocoaButterGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.milkSolidsGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.cocoaSolidsGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.otherSolidsGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.waterGrams)}</td>
                  <td className="px-2 py-2.5 text-right">{formatGrams(totals.unaccountedGrams)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
