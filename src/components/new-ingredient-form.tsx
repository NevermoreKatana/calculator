'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { INGREDIENT_CATEGORIES } from '@/lib/calculator/types';
import { IngredientInputSchema } from '@/lib/validation/schemas';

/**
 * Zod `.default()` makes a field optional on the way IN and guaranteed on the
 * way OUT, so the form is typed with the input shape and the submit handler
 * receives the parsed output shape.
 */
type FormValues = z.input<typeof IngredientInputSchema>;
type ParsedValues = z.output<typeof IngredientInputSchema>;
import { CATEGORY_LABELS, COMPONENT_LABELS } from '@/lib/ingredients/labels';
import { createIngredient } from '@/app/actions/ingredients';
import { Button, Input, Label, Notice, Select } from '@/components/ui';

const COMPONENT_FIELDS = Object.keys(COMPONENT_LABELS) as (keyof typeof COMPONENT_LABELS)[];

export function NewIngredientForm({ onDone }: { onDone: () => void }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(IngredientInputSchema),
    defaultValues: {
      name: '',
      category: 'other',
      brand: null,
      sugarPercentage: 0,
      fatPercentage: 0,
      cocoaButterPercentage: 0,
      milkSolidsPercentage: 0,
      cocoaSolidsPercentage: 0,
      otherSolidsPercentage: 0,
      waterPercentage: 0,
      sweetness: 0,
      pricePerKg: null,
      source: null,
      sourceUrl: null,
    },
  });

  // useWatch subscribes without the render-time `watch()` call, which the
  // React Compiler cannot reason about.
  const values = useWatch({ control });
  const sum = COMPONENT_FIELDS.reduce((acc, field) => acc + (Number(values?.[field]) || 0), 0);

  const onSubmit = handleSubmit((data) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createIngredient(data);
      if (result.ok) {
        onDone();
        // The catalogue is server-rendered, so a refresh is the honest way to
        // show the new row everywhere it appears.
        window.location.reload();
      } else {
        setServerError(result.error ?? 'Не удалось создать ингредиент');
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="ni-name">Название *</Label>
          <Input id="ni-name" {...register('name')} placeholder="Шоколад 70 %" />
          {errors.name ? (
            <p className="mt-1 text-xs text-[var(--danger)]">{errors.name.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="ni-category">Категория</Label>
          <Select id="ni-category" {...register('category')}>
            {INGREDIENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <p className="text-secondary mb-3 text-xs font-medium tracking-wide uppercase">
          Состав, % от массы ингредиента
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMPONENT_FIELDS.map((field) => (
            <div key={field}>
              <Label htmlFor={`ni-${field}`}>{COMPONENT_LABELS[field]}</Label>
              <Input
                id={`ni-${field}`}
                type="number"
                min={0}
                max={100}
                step={0.1}
                inputMode="decimal"
                className="tabular"
                {...register(field, { valueAsNumber: true })}
              />
              {errors[field] ? (
                <p className="mt-1 text-xs text-[var(--danger)]">{errors[field]?.message}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3">
          {sum > 100.5 ? (
            <Notice tone="danger">
              Сумма компонентов {sum.toFixed(1)} % превышает 100 % — это физически невозможно.
            </Notice>
          ) : sum < 99.5 ? (
            <Notice tone="warning">
              Сумма компонентов {sum.toFixed(1)} %. Остаток {(100 - sum).toFixed(1)} % будет учтён
              как «не учтено» — это допустимо, если состав известен не полностью.
            </Notice>
          ) : (
            <Notice tone="success">Сумма компонентов {sum.toFixed(1)} %.</Notice>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="ni-brand">Бренд</Label>
          <Input id="ni-brand" {...register('brand')} placeholder="Valrhona" />
        </div>
        <div>
          <Label htmlFor="ni-sweetness">Сладость</Label>
          <Input
            id="ni-sweetness"
            type="number"
            min={0}
            max={300}
            step={0.1}
            className="tabular"
            {...register('sweetness', { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="ni-price">Цена за кг</Label>
          <Input
            id="ni-price"
            type="number"
            min={0}
            step={1}
            className="tabular"
            {...register('pricePerKg', {
              setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
            })}
          />
        </div>
        <div>
          <Label htmlFor="ni-source">Источник данных</Label>
          <Input id="ni-source" {...register('source')} placeholder="Спецификация производителя" />
        </div>
      </div>

      {serverError ? <Notice tone="danger">{serverError}</Notice> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Сохранение…' : 'Создать ингредиент'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
