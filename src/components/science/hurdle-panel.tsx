'use client';

import * as React from 'react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Notice } from '@/components/ui';
import { HURDLE_STATE_LABELS, type HurdleAnalysis, type HurdleState } from '@/lib/science';

/**
 * Hurdle-by-hurdle stability picture (spec §17).
 *
 * Shows WHICH barriers are present rather than a single stability score,
 * because that is what the science supports: the gamma model's structure is
 * sound, but its cardinal parameters do not exist for ganache, so a numeric
 * growth rate would be fabricated.
 */

const STATE_TONE: Record<HurdleState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  effective: 'success',
  partial: 'warning',
  absent: 'danger',
  unknown: 'neutral',
};

const STATE_MARK: Record<HurdleState, string> = {
  effective: '✓',
  partial: '~',
  absent: '✗',
  unknown: '?',
};

export function HurdlePanel({ analysis }: { analysis: HurdleAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Барьеры стабильности</CardTitle>
        <CardDescription>
          Барьерная технология (hurdle technology): устойчивость обеспечивается совокупностью
          барьеров, а не одним фактором. Скорость роста микроорганизмов здесь намеренно не
          рассчитывается — кардинальные параметры для ганаша в жировой матрице не опубликованы,
          и любое число было бы выдумано.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">Работают: {analysis.effectiveCount}</Badge>
          <Badge tone="warning">Частичные: {analysis.partialCount}</Badge>
          <Badge tone="danger">Отсутствуют: {analysis.absentCount}</Badge>
          <Badge tone="neutral">Нет данных: {analysis.unknownCount}</Badge>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">{analysis.summary}</p>

        <ul className="space-y-2.5">
          {analysis.hurdles.map((h) => (
            <li
              key={h.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <span
                    aria-hidden
                    className={
                      h.state === 'effective'
                        ? 'text-[var(--success)]'
                        : h.state === 'partial'
                          ? 'text-[var(--warning)]'
                          : h.state === 'absent'
                            ? 'text-[var(--danger)]'
                            : 'text-muted'
                    }
                  >
                    {STATE_MARK[h.state]}
                  </span>
                  {h.label}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {h.valueLabel ? <span className="tabular text-xs">{h.valueLabel}</span> : null}
                  <Badge tone={STATE_TONE[h.state]}>{HURDLE_STATE_LABELS[h.state]}</Badge>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{h.explanation}</p>
              {h.recommendation ? (
                <p className="mt-1.5 text-xs text-[var(--accent)]">→ {h.recommendation}</p>
              ) : null}
            </li>
          ))}
        </ul>

        {analysis.criticalGaps.length > 0 ? (
          <Notice tone="warning" title="Что ограничивает эту рецептуру">
            <ul className="list-disc space-y-1 pl-5">
              {analysis.criticalGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
      </CardContent>
    </Card>
  );
}
