'use client';

import * as React from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Notice, Stat } from '@/components/ui';
import { ConfidenceBadge, ProvenancePanel } from './provenance-panel';
import { SUGAR_SPECIES_LABELS, type SugarSpecies } from '@/lib/science';
import type { ResolvedWaterActivity } from '@/lib/water-activity';

/**
 * Water-activity result (spec §33, §36, §51).
 *
 * Three rules this component enforces visually:
 *   1. a_w is shown as a BAND, never as a bare point estimate.
 *   2. The SOURCE of the value (measured vs computed) is always visible.
 *   3. When nothing can produce a value, it says so instead of showing a number.
 */

const SOLUTE_LABEL = (species: string): string =>
  species in SUGAR_SPECIES_LABELS
    ? SUGAR_SPECIES_LABELS[species as SugarSpecies]
    : species === 'ethanol'
      ? 'Этанол'
      : species === 'sodiumChloride'
        ? 'Соль (NaCl)'
        : species;

export function WaterActivityPanel({ resolved }: { resolved: ResolvedWaterActivity }) {
  const { result } = resolved;
  const detail = result.detail;

  if (!result.available || result.value === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Активность воды</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Stat label="a_w" value="—" hint="Не определена" tone="danger" />
          <Notice tone="warning" title="Значение не рассчитано">
            {result.reason}
          </Notice>
          {result.missingData && result.missingData.length > 0 ? (
            <div>
              <p className="text-muted mb-1 text-[11px] font-semibold tracking-wider uppercase">
                Чего не хватает
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                {result.missingData.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const measured = result.source === 'measured';
  const band =
    detail && detail.low !== null && detail.high !== null
      ? `${detail.low.toFixed(3)} – ${detail.high.toFixed(3)}`
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Активность воды</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={measured ? 'success' : 'accent'}>
            {measured ? 'Измерено прибором' : 'Расчёт по составу'}
          </Badge>
          {detail ? <ConfidenceBadge confidence={detail.confidence} /> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="a_w"
            value={result.value.toFixed(3)}
            hint={measured ? 'показание прибора' : band ? `интервал ${band}` : undefined}
            tone={result.value <= 0.85 ? 'success' : result.value <= 0.9 ? 'warning' : 'danger'}
          />
          <Stat
            label="ERH"
            value={`${(result.value * 100).toFixed(1)} %`}
            hint="равновесная относительная влажность"
          />
          {detail ? (
            <Stat
              label="Водная фаза"
              value={`${detail.aqueousPhase.dissolvedSolidsPercent.toFixed(1)} %`}
              hint="растворённых сухих веществ"
              tone={detail.aqueousPhase.dissolvedSolidsPercent >= 65 ? 'success' : 'neutral'}
            />
          ) : null}
        </div>

        {measured && detail?.waterActivity != null ? (
          <Notice tone="accent" title="Измеренное значение имеет приоритет">
            Расчёт по составу дал бы {detail.waterActivity.toFixed(3)}. Показано измеренное
            значение, потому что прибор всегда точнее модели. Расхождение{' '}
            {Math.abs(detail.waterActivity - result.value).toFixed(3)} — полезный сигнал о том,
            насколько состав ингредиентов в базе соответствует реальному сырью.
          </Notice>
        ) : null}

        {detail ? (
          <>
            {/* Cross-model comparison — spec §37 */}
            <section>
              <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                Сравнение моделей
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-sm">
                  <thead>
                    <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                      <th className="py-1.5 font-medium">Модель</th>
                      <th className="py-1.5 text-right font-medium">a_w</th>
                      <th className="py-1.5 pl-4 font-medium">Роль</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-1.5 font-medium">Норриш (мультисолютный)</td>
                      <td className="py-1.5 text-right font-semibold text-[var(--accent)]">
                        {detail.crossChecks.norrish?.toFixed(3) ?? '—'}
                      </td>
                      <td className="text-muted py-1.5 pl-4 text-xs">основная</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-1.5">Ross</td>
                      <td className="py-1.5 text-right">
                        {detail.crossChecks.ross?.toFixed(3) ?? '—'}
                      </td>
                      <td className="text-muted py-1.5 pl-4 text-xs">перекрёстная проверка</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Рауль (идеальный раствор)</td>
                      <td className="py-1.5 text-right">
                        {detail.crossChecks.raoult?.toFixed(3) ?? '—'}
                      </td>
                      <td className="text-muted py-1.5 pl-4 text-xs">
                        база сравнения, завышает
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {detail.crossChecks.modelSpread !== null ? (
                <p className="text-muted mt-2 text-xs">
                  Расхождение Норриш ↔ Ross:{' '}
                  <span className="tabular">{detail.crossChecks.modelSpread.toFixed(4)}</span>.
                  Оно включено в ширину интервала: чем сильнее модели расходятся, тем меньше
                  определённости.
                </p>
              ) : null}
            </section>

            {/* Water phase composition */}
            <section>
              <h4 className="text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">
                Состав водной фазы
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead>
                    <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                      <th className="py-1.5 font-medium">Вещество</th>
                      <th className="py-1.5 text-right font-medium">Растворено, г</th>
                      <th className="py-1.5 text-right font-medium">M, г/моль</th>
                      <th className="py-1.5 text-right font-medium">Моль</th>
                      <th className="py-1.5 text-right font-medium">K</th>
                      <th className="py-1.5 text-right font-medium">Мольн. доля</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-1.5 font-medium">Вода</td>
                      <td className="py-1.5 text-right">
                        {detail.aqueousPhase.waterGrams.toFixed(1)}
                      </td>
                      <td className="py-1.5 text-right">18.02</td>
                      <td className="py-1.5 text-right">
                        {detail.aqueousPhase.waterMoles.toFixed(4)}
                      </td>
                      <td className="text-muted py-1.5 text-right">—</td>
                      <td className="py-1.5 text-right">
                        {detail.aqueousPhase.waterMoleFraction.toFixed(4)}
                      </td>
                    </tr>
                    {detail.aqueousPhase.solutes.map((s) => (
                      <tr key={s.species} className="border-b border-[var(--border-subtle)]">
                        <td className="py-1.5">
                          {SOLUTE_LABEL(s.species)}
                          {s.undissolvedGrams > 0 ? (
                            <span className="ml-1.5 text-xs text-[var(--warning)]">
                              +{s.undissolvedGrams.toFixed(1)} г не раств.
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-right">{s.grams.toFixed(1)}</td>
                        <td className="py-1.5 text-right">{s.molarMass.toFixed(1)}</td>
                        <td className="py-1.5 text-right">{s.moles.toFixed(4)}</td>
                        <td className="py-1.5 text-right">{s.norrishK.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{s.moleFraction.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted mt-2 text-xs">
                Жир, какао-частицы и белок ({detail.aqueousPhase.nonSoluteSolidsGrams.toFixed(1)} г)
                в мольный баланс не входят: они не растворяются и не растворяют, поэтому на
                активность воды напрямую не влияют.
              </p>
            </section>

            {detail.warnings.length > 0 ? (
              <Notice tone="warning" title="Предупреждения расчёта">
                <ul className="list-disc space-y-1 pl-5">
                  {detail.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            <ProvenancePanel provenance={detail.provenance} />
          </>
        ) : (
          <Notice tone="accent">{result.reason}</Notice>
        )}
      </CardContent>
    </Card>
  );
}
