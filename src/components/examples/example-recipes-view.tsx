'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Notice,
} from '@/components/ui';
import { EMPTY_RECIPE, useRecipe } from '@/lib/store/recipe-store';
import { formatGrams } from '@/lib/calculator/numeric';
import {
  EXAMPLE_RECIPES,
  getExampleRecipe,
  observationPageLabel,
  resolveExample,
  type ExampleRecipe,
} from '@/lib/examples/example-recipes';

/**
 * Worked examples (§«что тут можно увидеть»).
 *
 * Each card is a named recipe plus a caption stating what the example makes
 * visible, and pointers to where in the app to look. Loading one replaces the
 * working recipe and jumps to the page where the effect shows.
 *
 * The captions are not decorative prose: tests/example-recipes.test.ts runs
 * every example through the engine and asserts the claimed a_w and warnings
 * actually occur, so a caption cannot drift out of truth.
 */

const DESTINATION: Record<string, string> = {
  stability: '/stability',
  calculator: '/calculator',
  composition: '/composition',
  'shelf-life': '/shelf-life',
};

export function ExampleRecipesView() {
  const router = useRouter();
  const { ingredients, loadRecipe } = useRecipe();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const resolved = React.useMemo(
    () => EXAMPLE_RECIPES.map((example) => resolveExample(example, ingredients)),
    [ingredients],
  );

  const load = (example: ExampleRecipe, destination: string) => {
    const match = resolved.find((r) => r.example.id === example.id);
    if (!match || !match.complete) return;

    loadRecipe({
      ...EMPTY_RECIPE,
      name: example.name,
      description: example.caption,
      items: match.items.map((item, index) => ({
        id: `example-${example.id}-${index}`,
        ingredientId: item.ingredient.id,
        weightGrams: item.weightGrams,
      })),
      storageTemperatureC: example.conditions?.storageTemperatureC ?? null,
      measuredPH: example.conditions?.measuredPH ?? null,
      packagingSealed: example.conditions?.packagingSealed ?? null,
      chocolateShell: example.conditions?.chocolateShell ?? null,
      thermalTreatment: example.conditions?.thermalTreatment ?? null,
      hasPreservative: example.conditions?.hasPreservative ?? false,
    });
    router.push(destination);
  };

  if (ingredients.length === 0) {
    return (
      <Notice tone="warning" title="База ингредиентов недоступна">
        Примеры собираются из реальных ингредиентов базы. Подключите базу и выполните импорт —
        после этого примеры можно будет загрузить одним нажатием.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="accent" title="Зачем эти примеры">
        Каждый пример показывает <strong>одно</strong> явление, которое иначе остаётся
        абстракцией: что вид сахара важнее его массы, что классический ганаш не хранится, что
        кристаллический сахар перестаёт понижать активность воды, что консервант при pH ганаша
        не работает. Подпись говорит, что вы увидите, и все указанные значения проверяются
        тестами против расчётного ядра.
      </Notice>

      {EXAMPLE_RECIPES.map((example) => {
        const match = resolved.find((r) => r.example.id === example.id);
        const complete = match?.complete ?? false;
        const isExpanded = expandedId === example.id;
        const primaryPage = example.observations[0]?.page ?? 'stability';

        return (
          <Card key={example.id}>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{example.name}</CardTitle>
                  <CardDescription className="mt-1">{example.caption}</CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!complete}
                    onClick={() => load(example, DESTINATION[primaryPage])}
                  >
                    Загрузить и открыть
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setExpandedId(isExpanded ? null : example.id)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Свернуть' : 'Подробнее'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {!complete && match ? (
                <Notice tone="warning" title="Пример нельзя загрузить целиком">
                  В базе нет ингредиентов: {match.missingIngredientNames.join(', ')}. Пример не
                  загружается частично — неполный состав демонстрировал бы не то явление.
                </Notice>
              ) : null}

              {/* What to look at — the heart of the feature */}
              <section>
                <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                  Что тут можно увидеть
                </h4>
                <ul className="space-y-1.5">
                  {example.observations.map((o) => (
                    <li key={o.what} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge tone="neutral">{observationPageLabel(o.page)}</Badge>
                      <span className="text-[var(--text-secondary)]">{o.what}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {isExpanded ? (
                <>
                  <section>
                    <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                      Что это доказывает
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
                      {example.demonstrates.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                      Рецептура
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {example.items.map((item) => (
                        <li
                          key={item.ingredientName}
                          className="flex justify-between gap-3 border-b border-[var(--border-subtle)] py-1"
                        >
                          <span>{item.ingredientName}</span>
                          <span className="tabular text-muted shrink-0">
                            {formatGrams(item.weightGrams)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {example.conditions ? (
                      <p className="text-muted mt-2 text-xs">
                        Условия:{' '}
                        {[
                          example.conditions.storageTemperatureC != null
                            ? `${example.conditions.storageTemperatureC} °C`
                            : null,
                          example.conditions.measuredPH != null
                            ? `pH ${example.conditions.measuredPH}`
                            : null,
                          example.conditions.packagingSealed ? 'герметичная упаковка' : null,
                          example.conditions.chocolateShell ? 'шоколадная оболочка' : null,
                          example.conditions.thermalTreatment ? 'тепловая обработка' : null,
                          example.conditions.hasPreservative ? 'консервант' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </section>
                </>
              ) : null}

              {example.compareWith && example.compareWith.length > 0 ? (
                <section>
                  <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                    Сравните с
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {example.compareWith.map((otherId) => {
                      const other = getExampleRecipe(otherId);
                      const otherResolved = resolved.find((r) => r.example.id === otherId);
                      if (!other) return null;
                      return (
                        <Button
                          key={otherId}
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!otherResolved?.complete}
                          onClick={() =>
                            load(other, DESTINATION[other.observations[0]?.page ?? 'stability'])
                          }
                        >
                          {other.name}
                        </Button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
