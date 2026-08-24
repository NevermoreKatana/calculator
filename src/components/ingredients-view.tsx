'use client';

import * as React from 'react';
import type { Ingredient, IngredientCategory } from '@/lib/calculator/types';
import { INGREDIENT_CATEGORIES } from '@/lib/calculator/types';
import { componentSum } from '@/lib/calculator/calculateIngredientContribution';
import { formatPercent } from '@/lib/calculator/numeric';
import { CATEGORY_LABELS } from '@/lib/ingredients/labels';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Input, Label, Notice, Select,
} from '@/components/ui';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { NewIngredientForm } from './new-ingredient-form';

export function IngredientsView({
  initialIngredients,
  loadError,
}: {
  initialIngredients: Ingredient[];
  loadError: string | null;
}) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<IngredientCategory | ''>('');
  const [showForm, setShowForm] = React.useState(false);

  // External search runs against the network, so it is debounced (spec §45).
  const [externalQuery, setExternalQuery] = React.useState('');
  const debouncedExternal = useDebouncedValue(externalQuery, 400);
  const trimmedExternal = debouncedExternal.trim();

  /**
   * Results are kept in a query-keyed cache, so a repeated search is answered
   * from memory (spec §45) and the effect never has to write state
   * synchronously on a cache hit — it simply does not run. State changes only
   * happen in the fetch callback.
   */
  type ExternalEntry = { ingredients: Ingredient[]; error: string | null };
  const [externalCache, setExternalCache] = React.useState<Map<string, ExternalEntry>>(
    () => new Map(),
  );

  const entry = trimmedExternal.length >= 2 ? externalCache.get(trimmedExternal) : undefined;
  const external = entry?.ingredients ?? [];
  const externalError = entry?.error ?? null;
  const externalState: 'idle' | 'loading' | 'error' | 'done' =
    trimmedExternal.length < 2
      ? 'idle'
      : entry === undefined
        ? 'loading'
        : entry.error
          ? 'error'
          : 'done';

  React.useEffect(() => {
    if (trimmedExternal.length < 2) return;
    if (externalCache.has(trimmedExternal)) return;

    const controller = new AbortController();
    const store = (result: ExternalEntry) =>
      setExternalCache((prev) => new Map(prev).set(trimmedExternal, result));

    fetch(
      `/api/ingredients/search?source=external&q=${encodeURIComponent(trimmedExternal)}&limit=20`,
      { signal: controller.signal },
    )
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(String(response.status))),
      )
      .then((data: { ingredients: Ingredient[]; providerErrors?: { error: string }[] }) => {
        store({
          ingredients: data.ingredients ?? [],
          error: data.providerErrors?.[0]?.error ?? null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        store({
          ingredients: [],
          error: 'Внешняя база временно недоступна. Локальная база продолжает работать.',
        });
      });

    return () => controller.abort();
  }, [trimmedExternal, externalCache]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialIngredients.filter((i) => {
      if (category && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || (i.brand?.toLowerCase().includes(q) ?? false);
    });
  }, [initialIngredients, query, category]);

  return (
    <div className="space-y-6">
      {loadError ? (
        <Notice tone="danger" title="База недоступна">{loadError}</Notice>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="ing-search">Поиск в локальной базе</Label>
            <Input
              id="ing-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или бренд…"
            />
          </div>
          <div className="w-full sm:w-52">
            <Label htmlFor="ing-category">Категория</Label>
            <Select
              id="ing-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as IngredientCategory | '')}
            >
              <option value="">Все категории</option>
              {INGREDIENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Отменить' : 'Добавить ингредиент'}
          </Button>
        </CardHeader>

        {showForm ? (
          <CardContent className="border-t border-[var(--border-subtle)] pt-5">
            <NewIngredientForm onDone={() => setShowForm(false)} />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Локальная база{' '}
            <span className="text-muted text-sm font-normal">
              — {filtered.length} из {initialIngredients.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IngredientTable ingredients={filtered} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Внешний источник — Open Food Facts</CardTitle>
          <div className="mt-3 max-w-md">
            <Input
              value={externalQuery}
              onChange={(e) => setExternalQuery(e.target.value)}
              placeholder="Поиск во внешней базе (от 2 символов)…"
              aria-label="Поиск во внешней базе"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Notice tone="warning" title="Данные неполные" className="mb-4">
            Open Food Facts — общая база потребительских продуктов, а не профессиональная база
            кондитерского сырья. Из неё берутся только сахара и жиры. Масло какао, сухое молоко,
            сухие какао и вода в панели питательной ценности отсутствуют и остаются нулевыми —
            вода намеренно не вычисляется вычитанием, чтобы не подменять ключевой для срока
            годности показатель расчётной догадкой.
          </Notice>

          {externalState === 'loading' ? (
            <p className="text-muted py-4 text-center text-sm">Поиск…</p>
          ) : externalState === 'error' ? (
            <Notice tone="danger">{externalError}</Notice>
          ) : external.length > 0 ? (
            <IngredientTable ingredients={external} external />
          ) : externalQuery.trim().length >= 2 && externalState === 'done' ? (
            <p className="text-muted py-4 text-center text-sm">Ничего не найдено.</p>
          ) : (
            <p className="text-muted py-4 text-center text-sm">
              Введите запрос, чтобы искать во внешней базе.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IngredientTable({
  ingredients,
  external = false,
}: {
  ingredients: Ingredient[];
  external?: boolean;
}) {
  if (ingredients.length === 0) {
    return <p className="text-muted py-6 text-center text-sm">Ничего не найдено.</p>;
  }

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-[11px] tracking-wider uppercase">
            <th scope="col" className="px-2 py-2 font-medium">Название</th>
            <th scope="col" className="px-2 py-2 font-medium">Категория</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Сахара</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Жиры</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">М.какао</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Мол.сух.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Какао сух.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Проч.сух.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Вода</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Σ</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {ingredients.map((ingredient) => {
            const sum = componentSum(ingredient);
            return (
              <tr key={ingredient.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span>{ingredient.name}</span>
                    {ingredient.isCustom ? <Badge tone="accent">своё</Badge> : null}
                    {external ? <Badge tone="warning">внешний</Badge> : null}
                  </div>
                  {ingredient.brand ? (
                    <span className="text-muted text-xs">{ingredient.brand}</span>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Badge>{CATEGORY_LABELS[ingredient.category]}</Badge>
                </td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.sugarPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.fatPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.cocoaButterPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.milkSolidsPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.cocoaSolidsPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.otherSolidsPercentage)}</td>
                <td className="px-2 py-2 text-right">{formatPercent(ingredient.waterPercentage)}</td>
                <td className="px-2 py-2 text-right">
                  {sum > 100.5 ? (
                    <Badge tone="danger">{sum.toFixed(1)} %</Badge>
                  ) : sum < 99.5 ? (
                    <Badge tone="warning">{sum.toFixed(1)} %</Badge>
                  ) : (
                    <Badge tone="success">{sum.toFixed(1)} %</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
