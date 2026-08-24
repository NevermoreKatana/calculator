'use client';

import * as React from 'react';
import { formatGrams, formatPercent } from '@/lib/calculator/numeric';
import { cn } from '@/lib/utils';

/**
 * Composition donut (spec §34).
 *
 * The six slices mirror the pie the Excel workbook drew from
 * calculator!C36:D41 — общие жиры / сахара / обш какао / общ молочные сухие /
 * прочие сухие / вода — plus a seventh "не учтено" slice that the workbook had
 * no way to show. That slice is the mass the ingredient rows do not describe;
 * hiding it would silently overstate how complete the data is.
 */

export interface CompositionSlice {
  id: string;
  label: string;
  grams: number;
  percentage: number;
  color: string;
}

export const COMPOSITION_COLORS = {
  fat: 'var(--color-caramel-400)',
  sugar: 'var(--color-beige-400)',
  cocoaSolids: 'var(--color-cocoa-600)',
  milkSolids: 'var(--color-cream-300)',
  otherSolids: 'var(--color-pistachio-400)',
  water: 'var(--color-bordeaux-400)',
  unaccounted: 'var(--color-cocoa-400)',
} as const;

const SIZE = 220;
const RADIUS = 88;
const THICKNESS = 30;
const CENTER = SIZE / 2;

function arcPath(startAngle: number, endAngle: number): string {
  const outer = RADIUS;
  const inner = RADIUS - THICKNESS;
  // A full circle cannot be drawn with a single arc — split it in two.
  const sweep = endAngle - startAngle;
  if (sweep >= 359.999) {
    return [
      `M ${CENTER} ${CENTER - outer}`,
      `A ${outer} ${outer} 0 1 1 ${CENTER - 0.01} ${CENTER - outer}`,
      `M ${CENTER} ${CENTER - inner}`,
      `A ${inner} ${inner} 0 1 0 ${CENTER - 0.01} ${CENTER - inner}`,
      'Z',
    ].join(' ');
  }

  const toXY = (angle: number, r: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startAngle, outer);
  const [x2, y2] = toXY(endAngle, outer);
  const [x3, y3] = toXY(endAngle, inner);
  const [x4, y4] = toXY(startAngle, inner);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export function CompositionChart({
  slices,
  totalGrams,
  className,
}: {
  slices: CompositionSlice[];
  totalGrams: number;
  className?: string;
}) {
  const [active, setActive] = React.useState<string | null>(null);

  // Negative slices (a row declaring >100 %) cannot be drawn on a donut; they
  // are excluded from the geometry and called out in the legend instead.
  const drawable = slices.filter((s) => s.grams > 0);
  const drawableTotal = drawable.reduce((sum, s) => sum + s.grams, 0);
  const hasNegative = slices.some((s) => s.grams < 0);

  // Cumulative angles are computed in one self-contained pass rather than by
  // mutating a variable captured by a map callback.
  const arcs = React.useMemo(() => {
    const built: { slice: CompositionSlice; path: string }[] = [];
    let cursor = 0;
    for (const slice of drawable) {
      const sweep = drawableTotal > 0 ? (slice.grams / drawableTotal) * 360 : 0;
      built.push({ slice, path: arcPath(cursor, cursor + sweep) });
      cursor += sweep;
    }
    return built;
  }, [drawable, drawableTotal]);

  const activeSlice = slices.find((s) => s.id === active) ?? null;

  if (totalGrams <= 0 || drawable.length === 0) {
    return (
      <div
        className={cn(
          'text-muted flex h-[220px] items-center justify-center text-sm',
          className,
        )}
      >
        Нет данных для диаграммы — добавьте ингредиенты.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:items-start', className)}>
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[220px] w-[220px]"
          role="img"
          aria-label={`Диаграмма состава. Общий вес ${formatGrams(totalGrams)}.`}
        >
          {arcs.map(({ slice, path }) => (
            <path
              key={slice.id}
              d={path}
              fill={slice.color}
              stroke="var(--surface-card)"
              strokeWidth="1.5"
              opacity={active === null || active === slice.id ? 1 : 0.35}
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
              className="cursor-pointer transition-opacity"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {activeSlice ? (
            <>
              <span className="text-muted max-w-[110px] text-center text-[10px] tracking-wide uppercase">
                {activeSlice.label}
              </span>
              <span className="tabular font-display text-xl font-semibold">
                {formatPercent(activeSlice.percentage)}
              </span>
              <span className="text-muted tabular text-[11px]">
                {formatGrams(activeSlice.grams)}
              </span>
            </>
          ) : (
            <>
              <span className="text-muted text-[10px] tracking-wide uppercase">Общий вес</span>
              <span className="tabular font-display text-xl font-semibold">
                {formatGrams(totalGrams)}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(slice.id)}
              onBlur={() => setActive(null)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                active === slice.id ? 'bg-[var(--surface-sunken)]' : '',
              )}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-xs">{slice.label}</span>
              <span className="tabular shrink-0 text-xs font-medium">
                {formatPercent(slice.percentage)}
              </span>
              <span className="text-muted tabular w-20 shrink-0 text-right text-xs">
                {formatGrams(slice.grams)}
              </span>
            </button>
          </li>
        ))}
        {hasNegative ? (
          <li className="text-[var(--danger)] px-2 text-[11px]">
            Отрицательная доля «не учтено» означает, что состав ингредиента заявлен больше 100 %.
            Такие доли не отображаются на кольце.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Builds the slice list from a calculation, in the workbook's own order. */
export function buildCompositionSlices(input: {
  totalFatGrams: number;
  sugarGrams: number;
  cocoaSolidsGrams: number;
  milkSolidsGrams: number;
  otherSolidsGrams: number;
  waterGrams: number;
  unaccountedGrams: number;
  totalWeightGrams: number;
}): CompositionSlice[] {
  const pct = (grams: number) =>
    input.totalWeightGrams > 0 ? (grams / input.totalWeightGrams) * 100 : 0;

  return [
    { id: 'fat', label: 'Общие жиры', grams: input.totalFatGrams, percentage: pct(input.totalFatGrams), color: COMPOSITION_COLORS.fat },
    { id: 'sugar', label: 'Сахара', grams: input.sugarGrams, percentage: pct(input.sugarGrams), color: COMPOSITION_COLORS.sugar },
    { id: 'cocoaSolids', label: 'Какао сухие', grams: input.cocoaSolidsGrams, percentage: pct(input.cocoaSolidsGrams), color: COMPOSITION_COLORS.cocoaSolids },
    { id: 'milkSolids', label: 'Молочные сухие', grams: input.milkSolidsGrams, percentage: pct(input.milkSolidsGrams), color: COMPOSITION_COLORS.milkSolids },
    { id: 'otherSolids', label: 'Прочие сухие', grams: input.otherSolidsGrams, percentage: pct(input.otherSolidsGrams), color: COMPOSITION_COLORS.otherSolids },
    { id: 'water', label: 'Вода', grams: input.waterGrams, percentage: pct(input.waterGrams), color: COMPOSITION_COLORS.water },
    { id: 'unaccounted', label: 'Не учтено', grams: input.unaccountedGrams, percentage: pct(input.unaccountedGrams), color: COMPOSITION_COLORS.unaccounted },
  ];
}
