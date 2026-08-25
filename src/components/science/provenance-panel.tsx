'use client';

import * as React from 'react';
import { Badge } from '@/components/ui';
import {
  CONFIDENCE_LABELS,
  EVIDENCE_STATUS_LABELS,
  getFormula,
  getSource,
  type ConfidenceLevel,
  type Provenance,
} from '@/lib/science';

/**
 * "Where did this number come from?" (spec §36, §60).
 *
 * Renders the five mandatory answers for any scientific result: the formula,
 * its inputs' sources, why it applies here, the range it is valid over, and
 * how much it can be trusted. Collapsed by default so it informs without
 * crowding the number itself.
 *
 * The component renders DATA supplied by the engine. It contains no science
 * of its own (spec §55).
 */

const CONFIDENCE_TONE: Record<ConfidenceLevel, 'success' | 'accent' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'accent',
  low: 'warning',
  none: 'danger',
};

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  return (
    <Badge tone={CONFIDENCE_TONE[confidence]}>Уверенность: {CONFIDENCE_LABELS[confidence]}</Badge>
  );
}

export function ProvenancePanel({
  provenance,
  extraWarnings = [],
  defaultOpen = false,
}: {
  provenance: Provenance;
  extraWarnings?: string[];
  defaultOpen?: boolean;
}) {
  const formula = provenance.formulaId ? getFormula(provenance.formulaId) : null;
  const sources = provenance.sourceIds.map(getSource).filter((s) => s !== null);

  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
    >
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium select-none">
        <span className="text-[var(--accent)]">Откуда это число</span>
        <span className="text-muted ml-2 text-xs group-open:hidden">
          формула, источники, ограничения
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--border-subtle)] px-4 py-4 text-sm">
        {formula ? (
          <section>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Формула
            </h4>
            <p className="font-medium">{formula.nameRu}</p>
            <pre className="tabular mt-1.5 overflow-x-auto rounded-md bg-[var(--surface-card)] px-3 py-2 text-xs">
              {formula.equation}
            </pre>
            {formula.variables.length > 0 ? (
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                {formula.variables.map((v) => (
                  <div key={v.symbol} className="flex gap-2">
                    <dt className="tabular shrink-0 font-semibold">{v.symbol}</dt>
                    <dd className="text-muted">
                      {v.meaning}
                      <span className="opacity-70"> · {v.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ) : null}

        <section>
          <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
            Почему эта формула подходит
          </h4>
          <p className="text-[var(--text-secondary)]">{provenance.applicabilityNote}</p>
        </section>

        {formula ? (
          <section>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Диапазон действия
            </h4>
            <p className="text-[var(--text-secondary)]">{formula.validityRange}</p>
            <p className="text-muted mt-1 text-xs">Точность: {formula.accuracy}</p>
          </section>
        ) : null}

        {provenance.assumptions.length > 0 ? (
          <section>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Допущения
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-[var(--text-secondary)]">
              {provenance.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {provenance.limitations.length > 0 ? (
          <section>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Ограничения
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-[var(--text-secondary)]">
              {provenance.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {extraWarnings.length > 0 ? (
          <section>
            <h4 className="mb-1.5 text-[11px] font-semibold tracking-wider text-[var(--warning)] uppercase">
              Предупреждения по этому рецепту
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-[var(--text-secondary)]">
              {extraWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {sources.length > 0 ? (
          <section>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              Источники
            </h4>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={s.tier === 'S' ? 'success' : s.tier === 'A' ? 'accent' : 'neutral'}>
                      Уровень {s.tier}
                    </Badge>
                    <span className="text-muted uppercase">{s.language}</span>
                  </div>
                  <p className="mt-0.5 font-medium">
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
                  <p className="text-muted">
                    {s.authors.join(', ')}
                    {s.year ? `, ${s.year}` : ''} · {s.publication}
                  </p>
                  {s.caveats ? (
                    <p className="mt-0.5 text-[var(--warning)]">Оговорка: {s.caveats}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-muted border-t border-[var(--border-subtle)] pt-3 text-xs">
          Статус метода: {EVIDENCE_STATUS_LABELS[provenance.status]} · Уверенность результата:{' '}
          {CONFIDENCE_LABELS[provenance.confidence]}
        </p>
      </div>
    </details>
  );
}
