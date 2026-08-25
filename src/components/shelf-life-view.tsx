'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRecipe } from '@/lib/store/recipe-store';
import { formatDays, formatGrams, formatPercent, formatRatio } from '@/lib/calculator/numeric';
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Input, Label, Notice, Select, Stat,
} from '@/components/ui';
import { WaterActivityChart } from '@/components/charts/water-activity-chart';
import { SHELF_LIFE_REFERENCE_POINTS, buildRecommendations } from '@/lib/shelf-life';
import { analyseReferencePoint } from '@/lib/science';

export function ShelfLifeView() {
  const { recipe, calculation, waterActivity, shelfLife, patch, hydrated } = useRecipe();
  const { totals, percentages, analysis } = calculation;

  const recommendations = React.useMemo(
    () =>
      buildRecommendations({
        waterPercentage: percentages.waterPercentage,
        sugarPercentage: percentages.sugarPercentage,
        dryMatterPercentage: percentages.dryMatterPercentage,
        sugarWaterRatio: analysis.sugarWaterRatio,
        estimate: shelfLife,
      }),
    [percentages, analysis.sugarWaterRatio, shelfLife],
  );

  const aw = waterActivity.result.value;
  const classification = waterActivity.classification;

  return (
    <div className="space-y-6">
      {/* ── Parameters ─────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Вода" value={formatPercent(percentages.waterPercentage)} hint={formatGrams(totals.waterGrams)} />
        <Stat label="Сахара" value={formatPercent(percentages.sugarPercentage)} hint={formatGrams(totals.sugarGrams)} />
        <Stat label="Сухая масса" value={formatPercent(percentages.dryMatterPercentage)} hint={formatGrams(totals.dryMatterGrams)} />
        <Stat label="Общий вес" value={formatGrams(totals.totalWeightGrams)} />
        <Stat
          label="a_w"
          value={aw !== null ? aw.toFixed(3) : 'не определено'}
          hint={
            waterActivity.result.source === 'measured'
              ? 'Источник: измеренное значение'
              : waterActivity.result.source === 'reference'
                ? 'Источник: справочное измерение'
                : 'Источник: нет данных'
          }
          tone={aw !== null ? 'accent' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Estimate ─────────────────────────────────────────────── */}
        {/* min-w-0 keeps the a_w chart inside its own scroll container. */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {shelfLife.available ? 'Теоретическая оценка срока' : 'Оценка срока не рассчитана'}
              </CardTitle>
              <CardDescription>
                {shelfLife.available
                  ? 'Значение получено из эмпирических контрольных точек — это не гарантированный срок.'
                  : 'Приложение не подставляет число там, где нет данных.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shelfLife.available && shelfLife.daysMin !== null && shelfLife.daysMax !== null ? (
                <>
                  <p className="tabular font-display text-5xl font-semibold">
                    ≈ {formatDays(shelfLife.daysMin, shelfLife.daysMax)}
                    <span className="ml-2 text-2xl font-normal">дней</span>
                  </p>
                  <p className="text-secondary mt-3 text-sm">
                    <span className="font-medium">Метод:</span> {shelfLife.methodLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {shelfLife.basis.map((point) => (
                      <Badge key={point.id} tone="accent">
                        вода {point.waterPercentage} % / сахара{' '}
                        {point.sugarPercentageMin === point.sugarPercentageMax
                          ? point.sugarPercentageMin
                          : `${point.sugarPercentageMin}–${point.sugarPercentageMax}`}{' '}
                        % → {formatDays(point.shelfLifeDaysMin, point.shelfLifeDaysMax)} дн.
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl font-semibold">Недостаточно данных</p>
                  <p className="text-secondary mt-2 text-sm">{shelfLife.reason}</p>
                </>
              )}

              {shelfLife.notes.length > 0 ? (
                <ul className="text-muted mt-4 space-y-1.5 border-t border-[var(--border-subtle)] pt-4 text-xs">
                  {shelfLife.notes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Mandatory disclaimer (spec §25) ────────────────────── */}
          <Notice tone="danger" title={shelfLife.disclaimer.headline}>
            <p className="mt-1 text-xs">{shelfLife.disclaimer.factorsIntro}</p>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-3">
              {shelfLife.disclaimer.factors.map((factor) => (
                <li key={factor}>• {factor}</li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs font-medium">{shelfLife.disclaimer.conclusion}</p>
          </Notice>

          {/* ── a_w chart (spec §18–§21) ───────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Активность воды (a_w) и рост микроорганизмов</CardTitle>
              <CardDescription>
                {aw !== null ? (
                  <>
                    Текущая зона:{' '}
                    <span className="font-medium text-[var(--text-primary)]">
                      {classification?.primaryZone?.label ?? '—'}
                    </span>
                  </>
                ) : (
                  'Активность воды не определена — маркер на графике не показан.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WaterActivityChart value={aw} />

              {classification && classification.risks.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-secondary text-xs font-medium tracking-wide uppercase">
                    Применимые биологические флаги ({classification.risks.length})
                  </p>
                  {classification.zones.map((zone) => (
                    <div key={zone.id} className="flex items-start gap-2.5">
                      <Badge
                        tone={
                          zone.riskLevel === 'severe' || zone.riskLevel === 'high'
                            ? 'danger'
                            : zone.riskLevel === 'moderate'
                              ? 'warning'
                              : zone.riskLevel === 'low'
                                ? 'accent'
                                : 'success'
                        }
                      >
                        {zone.sourceRange}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{zone.label}</p>
                        <p className="text-muted text-xs">{zone.description}</p>
                        <code className="text-muted text-[10px]">{zone.id}</code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Reference cards (spec §23) ─────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Теоретические сроки годности</CardTitle>
              <CardDescription>
                Эмпирические контрольные значения, на которых строится вся оценка.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {SHELF_LIFE_REFERENCE_POINTS.map((point) => {
                  const isBasis = shelfLife.basis.some((b) => b.id === point.id);
                  // Spec §20: can these observations be explained physically?
                  // Computed by the engine, not hard-coded here (spec §55).
                  const physics = analyseReferencePoint(
                    point.waterPercentage,
                    point.sugarPercentageMin,
                  );
                  return (
                    <div
                      key={point.id}
                      className={
                        isBasis
                          ? 'surface-raised rounded-lg border-2 border-[var(--accent)] p-4'
                          : 'surface-raised rounded-lg p-4'
                      }
                    >
                      <p className="tabular text-sm">
                        <span className="font-medium">{point.waterPercentage} %</span> воды
                      </p>
                      <p className="tabular text-sm">
                        <span className="font-medium">
                          {point.sugarPercentageMin === point.sugarPercentageMax
                            ? point.sugarPercentageMin
                            : `${point.sugarPercentageMin}–${point.sugarPercentageMax}`}{' '}
                          %
                        </span>{' '}
                        сахаров
                      </p>
                      <p className="tabular font-display mt-3 text-2xl font-semibold">
                        ≈ {formatDays(point.shelfLifeDaysMin, point.shelfLifeDaysMax)}
                        <span className="ml-1 text-sm font-normal">дней</span>
                      </p>
                      <dl className="mt-3 space-y-0.5 border-t border-[var(--border-subtle)] pt-2.5 text-[11px]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Водная фаза</dt>
                          <dd className="tabular">
                            {physics.waterPhaseSolidsPercent.toFixed(1)} %
                            {physics.aboveBrixThreshold ? ' ✓' : ''}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Расчётная a_w</dt>
                          <dd className="tabular font-medium">
                            {physics.waterActivity.toFixed(3)}
                          </dd>
                        </div>
                      </dl>
                      {point.notes ? (
                        <p className="text-muted mt-2 text-[11px]">{point.notes}</p>
                      ) : null}
                      {isBasis ? (
                        <Badge tone="accent" className="mt-2">
                          используется в текущей оценке
                        </Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <Notice tone="accent" title="Эти наблюдения объяснимы физически">
                  Контрольные точки не случайны: чем концентрированнее водная фаза, тем ниже
                  активность воды и тем дольше срок. Зависимость монотонна, а порог 65 °Brix из
                  рецензируемого обзора по ганашу приходится ровно между первой и второй точками.
                  <br />
                  <br />
                  <strong>Чего это не означает:</strong> формулы «a_w → дни» по-прежнему не
                  существует. Для неё нужны данные по многим рецептурам, температурам и типам
                  упаковки. Расчётная a_w здесь получена в допущении, что все сахара — сахароза
                  (контрольные точки не сообщают их вид), поэтому это верхняя оценка.
                </Notice>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Измеренный a_w</CardTitle>
              <CardDescription>
                Измеренное значение имеет приоритет над любой расчётной оценкой.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="use-measured-aw"
                  type="checkbox"
                  checked={recipe.useMeasuredAw}
                  onChange={(e) => patch({ useMeasuredAw: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <label htmlFor="use-measured-aw" className="text-sm">
                  Использовать измеренный a_w
                </label>
              </div>

              <div>
                <Label htmlFor="measured-aw">Значение a_w (0–1)</Label>
                <Input
                  id="measured-aw"
                  type="number"
                  min={0}
                  max={1}
                  step={0.001}
                  inputMode="decimal"
                  disabled={!recipe.useMeasuredAw}
                  value={recipe.measuredWaterActivity ?? ''}
                  onChange={(e) =>
                    patch({
                      measuredWaterActivity:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="0.780"
                  className="tabular"
                />
              </div>

              {recipe.useMeasuredAw &&
              recipe.measuredWaterActivity !== null &&
              !waterActivity.result.available ? (
                <p className="text-xs text-[var(--danger)]">{waterActivity.result.reason}</p>
              ) : null}

              <div>
                <Label htmlFor="storage-temp">Температура хранения, °C</Label>
                <Input
                  id="storage-temp"
                  type="number"
                  min={-40}
                  max={80}
                  step={0.5}
                  inputMode="decimal"
                  value={recipe.storageTemperatureC ?? ''}
                  onChange={(e) =>
                    patch({
                      storageTemperatureC: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="18"
                  className="tabular"
                />
              </div>

              <div>
                <Label htmlFor="product-type">Тип продукта</Label>
                <Select
                  id="product-type"
                  value={recipe.productType}
                  onChange={(e) => patch({ productType: e.target.value })}
                >
                  <option value="">Не указан</option>
                  <option value="ganache-enrobed">Ганаш в шоколадной оболочке</option>
                  <option value="ganache-shell">Ганаш в корпусе</option>
                  <option value="ganache-cut">Нарезной ганаш</option>
                  <option value="praline">Пралине</option>
                  <option value="filling">Начинка</option>
                </Select>
                <p className="text-muted mt-1 text-[11px]">
                  Сохраняется вместе с рецептом. На расчёт не влияет: связи типа продукта со
                  сроком в эмпирических данных нет.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Модели a_w</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {waterActivity.attempts.map((attempt) => (
                <div key={attempt.modelId} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge tone={attempt.available ? 'success' : 'neutral'}>
                      {attempt.available ? 'активна' : 'нет данных'}
                    </Badge>
                    <span className="font-medium">{attempt.modelLabel}</span>
                  </div>
                  <p className="text-muted mt-1">{attempt.reason}</p>
                  {attempt.missingData && attempt.missingData.length > 0 ? (
                    <ul className="text-muted mt-1 space-y-0.5 pl-3">
                      {attempt.missingData.map((missing) => (
                        <li key={missing}>— {missing}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Рекомендации</CardTitle>
              <CardDescription>Технологические подсказки, а не гарантии.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hydrated ? (
                <p className="text-muted text-xs">Загрузка…</p>
              ) : recommendations.length === 0 ? (
                <p className="text-muted text-xs">
                  Рецепт находится внутри области эмпирических наблюдений.
                </p>
              ) : (
                recommendations.map((rec) => (
                  <div key={rec.id}>
                    <p
                      className={
                        rec.severity === 'attention'
                          ? 'text-sm font-medium text-[var(--warning)]'
                          : 'text-sm font-medium'
                      }
                    >
                      {rec.title}
                    </p>
                    <p className="text-muted mt-0.5 text-xs">{rec.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сахар / вода</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="tabular font-display text-2xl font-semibold">
                {formatRatio(analysis.sugarWaterRatio)}
              </p>
              <p className="text-muted mt-1 text-xs">
                Вспомогательный аналитический параметр. Не является доказанной формулой срока
                годности.
              </p>
            </CardContent>
          </Card>

          <p className="text-muted text-xs">
            Методика и её ограничения описаны в{' '}
            <Link href="/settings" className="text-accent hover:underline">
              настройках и документации
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
