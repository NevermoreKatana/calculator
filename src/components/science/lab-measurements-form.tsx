'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Notice,
  Select,
} from '@/components/ui';
import { useRecipe } from '@/lib/store/recipe-store';
import { SORBIC_ACID_PKA, undissociatedFraction } from '@/lib/science';

/**
 * Laboratory measurements and process facts (spec §51).
 *
 * Every field here is OPTIONAL and every one is something the recipe cannot
 * tell you. Leaving a field empty is a valid answer that lowers confidence;
 * it is never silently replaced by a default.
 */

/** Parses a numeric input, treating an empty string as "not measured". */
function parseOptionalNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function TriStateSelect({
  id,
  label,
  value,
  onChange,
  yes,
  no,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yes: string;
  no: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value === null ? '' : value ? 'yes' : 'no'}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v === 'yes');
        }}
      >
        <option value="">Не указано</option>
        <option value="yes">{yes}</option>
        <option value="no">{no}</option>
      </Select>
    </div>
  );
}

export function LabMeasurementsForm() {
  const { recipe, patch } = useRecipe();

  const sorbateActive =
    recipe.measuredPH !== null
      ? undissociatedFraction(recipe.measuredPH, SORBIC_ACID_PKA.value)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Лабораторные измерения и условия</CardTitle>
        <CardDescription>
          Всё в этом блоке — то, что нельзя вывести из рецептуры. Измеренное значение всегда
          имеет приоритет над расчётным. Пустое поле — допустимый ответ: он понижает уверенность
          оценки, но не подменяется значением по умолчанию.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-muted text-[11px] font-semibold tracking-wider uppercase">
            Измерения
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="measured-aw">Активность воды a_w (прибор)</Label>
              <Input
                id="measured-aw"
                type="number"
                step="0.001"
                min="0"
                max="1"
                placeholder="напр. 0.780"
                value={recipe.measuredWaterActivity ?? ''}
                onChange={(e) => {
                  const value = parseOptionalNumber(e.target.value);
                  patch({ measuredWaterActivity: value, useMeasuredAw: value !== null });
                }}
              />
              <p className="text-muted mt-1 text-xs">
                {recipe.useMeasuredAw && recipe.measuredWaterActivity !== null
                  ? 'Используется вместо расчёта.'
                  : 'Не задано — используется расчёт по составу.'}
              </p>
            </div>

            <div>
              <Label htmlFor="measured-ph">pH (pH-метр)</Label>
              <Input
                id="measured-ph"
                type="number"
                step="0.01"
                min="0"
                max="14"
                placeholder="напр. 6.40"
                value={recipe.measuredPH ?? ''}
                onChange={(e) => patch({ measuredPH: parseOptionalNumber(e.target.value) })}
              />
              <p className="text-muted mt-1 text-xs">
                Рассчитать из рецептуры нельзя: буферная ёмкость белков, кислот и щелочного какао
                взаимодействует нелинейно.
              </p>
            </div>

            <div>
              <Label htmlFor="measured-brix">°Brix водной фазы (рефрактометр)</Label>
              <Input
                id="measured-brix"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="напр. 66.0"
                value={recipe.measuredBrix ?? ''}
                onChange={(e) => patch({ measuredBrix: parseOptionalNumber(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="measured-moisture">Влажность, % (ГОСТ 5900-2014)</Label>
              <Input
                id="measured-moisture"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="напр. 18.2"
                value={recipe.measuredMoisturePercent ?? ''}
                onChange={(e) =>
                  patch({ measuredMoisturePercent: parseOptionalNumber(e.target.value) })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-muted text-[11px] font-semibold tracking-wider uppercase">
            Условия хранения и процесс
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="storage-temp">Температура хранения, °C</Label>
              <Input
                id="storage-temp"
                type="number"
                step="0.5"
                placeholder="напр. 18"
                value={recipe.storageTemperatureC ?? ''}
                onChange={(e) =>
                  patch({ storageTemperatureC: parseOptionalNumber(e.target.value) })
                }
              />
            </div>

            <TriStateSelect
              id="packaging"
              label="Упаковка"
              value={recipe.packagingSealed}
              onChange={(v) => patch({ packagingSealed: v })}
              yes="Герметичная"
              no="Негерметичная"
            />

            <TriStateSelect
              id="shell"
              label="Шоколадная оболочка"
              value={recipe.chocolateShell}
              onChange={(v) => patch({ chocolateShell: v })}
              yes="Есть"
              no="Нет"
            />

            <TriStateSelect
              id="thermal"
              label="Тепловая обработка"
              value={recipe.thermalTreatment}
              onChange={(v) => patch({ thermalTreatment: v })}
              yes="Проводилась"
              no="Не проводилась"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="preservative"
              type="checkbox"
              checked={recipe.hasPreservative}
              onChange={(e) => patch({ hasPreservative: e.target.checked })}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <div>
              <Label htmlFor="preservative" className="mb-0">
                Используется слабокислотный консервант (сорбат/бензоат)
              </Label>
              <p className="text-muted text-xs">
                Дозировки регулируются законодательством конкретной страны и здесь не приводятся.
              </p>
            </div>
          </div>
        </section>

        {recipe.hasPreservative && sorbateActive !== null ? (
          <Notice tone={sorbateActive >= 0.5 ? 'success' : sorbateActive >= 0.1 ? 'warning' : 'danger'}>
            При pH {recipe.measuredPH?.toFixed(2)} сорбиновая кислота недиссоциирована на{' '}
            <strong>{(sorbateActive * 100).toFixed(1)} %</strong>. Противомикробное действие
            оказывает только недиссоциированная форма (pKa = {SORBIC_ACID_PKA.value}).
            {sorbateActive < 0.1
              ? ' При таком pH консервант практически не работает — типичная ситуация для ганаша.'
              : ''}
          </Notice>
        ) : null}

        {recipe.measuredBrix !== null ? (
          <Notice tone="accent" title="Измеренный °Brix">
            Значение сохранено для сопоставления с расчётной концентрацией водной фазы. Оно не
            подставляется в расчёт a_w: рефрактометрия по продукту с жиром и какао-частицами
            даёт систематически смещённый результат, а °Brix строго определён только для чистого
            раствора сахарозы.
          </Notice>
        ) : null}
      </CardContent>
    </Card>
  );
}
