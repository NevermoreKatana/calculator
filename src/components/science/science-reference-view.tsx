'use client';

import * as React from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Notice,
} from '@/components/ui';
import {
  CONFIDENCE_LABELS,
  EVIDENCE_STATUS_LABELS,
  IMPLEMENTATION_STATUS_LABELS,
  MICROBIAL_GROWTH_THRESHOLDS,
  NORRISH_CONSTANTS,
  PARAMETER_CAPABILITIES,
  PARAMETER_KIND_LABELS,
  SCIENTIFIC_FORMULAS,
  SCIENTIFIC_SOURCES,
  getSource,
  type ImplementationStatus,
  type ParameterKind,
  type SourceTier,
} from '@/lib/science';

/**
 * Scientific reference (spec §34, §35, §37, §47).
 *
 * Renders the registries directly, so the page cannot disagree with what the
 * engine does. Answers spec §60's five questions for the whole system rather
 * than for one number.
 */

type Tab = 'capabilities' | 'formulas' | 'constants' | 'microbiology' | 'sources';

const TABS: { id: Tab; label: string }[] = [
  { id: 'capabilities', label: 'Что можно рассчитать' },
  { id: 'formulas', label: 'Формулы' },
  { id: 'constants', label: 'Константы' },
  { id: 'microbiology', label: 'Микробиология' },
  { id: 'sources', label: 'Источники' },
];

const IMPL_TONE: Record<ImplementationStatus, 'success' | 'accent' | 'warning' | 'neutral'> = {
  implemented: 'success',
  implemented_as_crosscheck: 'accent',
  available_needs_data: 'warning',
  researched_not_applicable: 'neutral',
  planned: 'neutral',
};

const KIND_TONE: Record<ParameterKind, 'success' | 'accent' | 'warning' | 'danger'> = {
  exact_from_recipe: 'success',
  scientific_model: 'accent',
  requires_measurement: 'warning',
  requires_calibration: 'danger',
};

const TIER_TONE: Record<SourceTier, 'success' | 'accent' | 'warning' | 'danger'> = {
  S: 'success',
  A: 'accent',
  B: 'warning',
  C: 'danger',
};

export function ScienceReferenceView() {
  const [tab, setTab] = React.useState<Tab>('capabilities');

  return (
    <div className="space-y-6">
      <Notice tone="accent" title="Принцип">
        Система не пытается всегда выдать число. Она различает, что можно рассчитать точно, что
        можно оценить, для чего нужно измерение и где данных недостаточно. Каждая константа
        расчётного ядра обязана ссылаться на зарегистрированный источник — иначе тесты падают.
      </Notice>

      <div role="tablist" aria-label="Разделы научной справки" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent)]'
                : 'rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'capabilities' ? <CapabilitiesTab /> : null}
      {tab === 'formulas' ? <FormulasTab /> : null}
      {tab === 'constants' ? <ConstantsTab /> : null}
      {tab === 'microbiology' ? <MicrobiologyTab /> : null}
      {tab === 'sources' ? <SourcesTab /> : null}
    </div>
  );
}

function CapabilitiesTab() {
  const kinds: ParameterKind[] = [
    'exact_from_recipe',
    'scientific_model',
    'requires_measurement',
    'requires_calibration',
  ];

  return (
    <div className="space-y-5">
      {kinds.map((kind) => {
        const rows = PARAMETER_CAPABILITIES.filter((c) => c.kind === kind);
        if (rows.length === 0) return null;
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Badge tone={KIND_TONE[kind]}>{PARAMETER_KIND_LABELS[kind]}</Badge>
                <span className="text-muted text-sm font-normal">{rows.length} параметров</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                      <th className="py-2 font-medium">Параметр</th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        Из рецепта
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        Измерение
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        Калибровка
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        Уверенность
                      </th>
                      <th className="py-2 pl-4 font-medium">Метод</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id} className="border-b border-[var(--border-subtle)]">
                        <td className="py-2.5 font-medium">{c.parameter}</td>
                        <td className="px-2 py-2.5 text-center">{c.fromRecipe ? '✓' : '—'}</td>
                        <td className="px-2 py-2.5 text-center">
                          {c.requiresMeasurement ? '✓' : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {c.requiresCalibration ? '✓' : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs whitespace-nowrap">
                          {CONFIDENCE_LABELS[c.confidence]}
                        </td>
                        <td className="py-2.5 pl-4 text-[var(--text-secondary)]">
                          {c.recommendedMethod}
                          {c.note ? <p className="text-muted mt-1 text-xs">{c.note}</p> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FormulasTab() {
  return (
    <div className="space-y-4">
      {SCIENTIFIC_FORMULAS.map((f) => (
        <Card key={f.id}>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{f.nameRu}</CardTitle>
              <CardDescription>{f.name}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={IMPL_TONE[f.implementationStatus]}>
                {IMPLEMENTATION_STATUS_LABELS[f.implementationStatus]}
              </Badge>
              <Badge tone="neutral">{EVIDENCE_STATUS_LABELS[f.status]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <pre className="tabular overflow-x-auto rounded-md bg-[var(--surface-sunken)] px-3 py-2 text-xs">
              {f.equation}
            </pre>

            <div>
              <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
                Применимость к ганашу
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">{f.ganacheApplicability}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
                  Диапазон
                </p>
                <p className="mt-1 text-[var(--text-secondary)]">{f.validityRange}</p>
              </div>
              <div>
                <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
                  Точность
                </p>
                <p className="mt-1 text-[var(--text-secondary)]">{f.accuracy}</p>
              </div>
            </div>

            {f.limitations.length > 0 ? (
              <div>
                <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
                  Ограничения
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--text-secondary)]">
                  {f.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {f.implementationPath ? (
              <p className="text-muted tabular text-xs">Код: {f.implementationPath}</p>
            ) : null}

            <p className="text-muted text-xs">
              Источники:{' '}
              {f.sourceIds
                .map((id) => {
                  const s = getSource(id);
                  return s ? `${s.authors[0] ?? s.publication}${s.year ? ` (${s.year})` : ''}` : id;
                })
                .join('; ')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ConstantsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Константы уравнения Норриша</CardTitle>
        <CardDescription>
          Соглашение о знаке: <span className="tabular">a_w = X_w · exp(−K · X_s²)</span>, K
          положительна. В литературе встречается и эквивалентная запись с отрицательным K —
          смешение двух соглашений даёт a_w больше единицы, поэтому соглашение зафиксировано
          явно и проверяется тестом.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                <th className="py-2 font-medium">Вещество</th>
                <th className="py-2 text-right font-medium">K</th>
                <th className="py-2 text-right font-medium">±</th>
                <th className="py-2 pl-4 font-medium">Достоверность</th>
                <th className="py-2 pl-4 font-medium">Проверенный диапазон</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(NORRISH_CONSTANTS).map(([name, c]) => (
                <tr key={name} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2.5 font-medium">{name}</td>
                  <td className="tabular py-2.5 text-right font-semibold">{c.k}</td>
                  <td className="tabular text-muted py-2.5 text-right">{c.uncertainty ?? '—'}</td>
                  <td className="py-2.5 pl-4">
                    <Badge tone={c.status === 'validated' ? 'success' : 'neutral'}>
                      {EVIDENCE_STATUS_LABELS[c.status]}
                    </Badge>
                  </td>
                  <td className="py-2.5 pl-4 text-[var(--text-secondary)]">
                    {c.validatedRange}
                    {'note' in c && c.note ? (
                      <p className="text-muted mt-1 text-xs">{c.note}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Declared at module scope, not inside MicrobiologyTab: a component created
 * during render is a new type on every render, so React remounts it and any
 * state inside it is lost.
 */
function OrganismTable({
  rows,
  title,
}: {
  rows: readonly (typeof MICROBIAL_GROWTH_THRESHOLDS)[number][];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                <th className="py-2 font-medium">Организм</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">min a_w</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Разброс</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">min pH</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">T, °C</th>
                <th className="py-2 pl-4 font-medium">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2.5">
                    <p className="font-medium">{t.organismRu}</p>
                    {!t.relevantToConfectionery ? (
                      <Badge tone="neutral" className="mt-1">
                        не релевантен кондитерке
                      </Badge>
                    ) : null}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right font-semibold">
                    {t.minimumAw.toFixed(2)}
                  </td>
                  <td className="tabular text-muted px-2 py-2.5 text-right text-xs whitespace-nowrap">
                    {t.minimumAwRange[0] === t.minimumAwRange[1]
                      ? '—'
                      : `${t.minimumAwRange[0]}–${t.minimumAwRange[1]}`}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right">{t.minimumPH ?? '—'}</td>
                  <td className="tabular px-2 py-2.5 text-right text-xs whitespace-nowrap">
                    {t.temperatureRangeC
                      ? `${t.temperatureRangeC[0]}…${t.temperatureRangeC[1]}`
                      : '—'}
                  </td>
                  <td className="py-2.5 pl-4 text-xs text-[var(--text-secondary)]">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MicrobiologyTab() {
  const spoilage = MICROBIAL_GROWTH_THRESHOLDS.filter((t) => t.hazard === 'spoilage');
  const safety = MICROBIAL_GROWTH_THRESHOLDS.filter((t) => t.hazard === 'safety');

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Безопасность ≠ порча">
        Порог FDA a_w ≤ 0.85 относится к росту <strong>патогенов</strong>. Осмофильные дрожжи и
        ксерофильные плесени растут значительно ниже. Ганаш с a_w = 0.84 безопасен по критерию
        FDA и при этом испортится. Кроме того, «может расти» ≠ «успеет вырасти»: Xeromyces
        bisporus при своём пределе a_w 0.61 прорастает около 120 суток.
      </Notice>
      <OrganismTable rows={spoilage} title="Организмы порчи" />
      <OrganismTable rows={safety} title="Патогены (безопасность)" />
    </div>
  );
}

function SourcesTab() {
  const tiers: SourceTier[] = ['S', 'A', 'B', 'C'];
  return (
    <div className="space-y-5">
      <Notice tone="accent" title="Иерархия источников">
        Уровень S — рецензируемые публикации, научные книги, государственные организации и
        стандарты. Уровень C — блоги и рецептурные сайты, пригодные только для гипотез.
        <strong> Ни одна константа расчётного ядра не опирается на источник уровня C.</strong>
      </Notice>

      {tiers.map((tier) => {
        const rows = SCIENTIFIC_SOURCES.filter((s) => s.tier === tier);
        if (rows.length === 0) return null;
        return (
          <Card key={tier}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge tone={TIER_TONE[tier]}>Уровень {tier}</Badge>
                <span className="text-muted text-sm font-normal">{rows.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {rows.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="font-medium">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] underline underline-offset-2"
                        >
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                    </p>
                    <p className="text-muted text-xs">
                      {s.authors.join(', ')}
                      {s.year ? `, ${s.year}` : ''} · {s.publication} ·{' '}
                      <span className="uppercase">{s.language}</span>
                      {s.doi ? ` · DOI ${s.doi}` : ''}
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      <span className="font-medium">Используется для:</span> {s.usedFor}
                    </p>
                    {s.caveats ? (
                      <p className="mt-0.5 text-xs text-[var(--warning)]">
                        <span className="font-medium">Оговорки:</span> {s.caveats}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
