'use client';

import * as React from 'react';
import {
  WATER_ACTIVITY_AXIS,
  WATER_ACTIVITY_ZONES,
  classifyWaterActivity,
  type MicrobialRiskLevel,
  type WaterActivityZone,
} from '@/lib/water-activity';
import { cn } from '@/lib/utils';

/**
 * «Активность воды (a_w) и рост микроорганизмов» (spec §18–§21).
 *
 * X: a_w from 0.4 to 1.0. Y: how many microorganism groups can grow — a step
 * function that rises each time another group's threshold is crossed, which is
 * the "ступенчатое увеличение" the source chart shows.
 *
 * Below the step chart every zone is drawn as its own band, so the deliberate
 * OVERLAP between "0.80–0.87" and "> 0.86" is visible rather than hidden
 * (spec §20). Two bands covering the same stretch of axis is the point.
 *
 * This chart says which organisms could grow. It says NOTHING about days of
 * shelf life, and nothing here feeds the shelf-life estimate (spec §22).
 */

const RISK_COLORS: Record<MicrobialRiskLevel, string> = {
  none: 'var(--success)',
  low: 'var(--color-caramel-300)',
  moderate: 'var(--color-caramel-500)',
  high: 'var(--color-bordeaux-400)',
  severe: 'var(--color-bordeaux-600)',
};

const VIEW = { width: 820, height: 300 };
const PAD = { top: 18, right: 24, bottom: 34, left: 46 };
const PLOT = {
  width: VIEW.width - PAD.left - PAD.right,
  height: VIEW.height - PAD.top - PAD.bottom,
};

/** Zones that represent growth (everything except "нет роста"). */
const GROWTH_ZONES = WATER_ACTIVITY_ZONES.filter((z) => z.id !== 'no_growth');
const MAX_GROUPS = GROWTH_ZONES.length;

const xScale = (aw: number): number =>
  PAD.left +
  ((aw - WATER_ACTIVITY_AXIS.min) / (WATER_ACTIVITY_AXIS.max - WATER_ACTIVITY_AXIS.min)) *
    PLOT.width;

const yScale = (count: number): number => PAD.top + PLOT.height - (count / MAX_GROUPS) * PLOT.height;

/** How many groups can grow at this a_w. */
function groupCount(aw: number): number {
  return GROWTH_ZONES.filter((z) => (z.min === null ? true : aw > z.min - 1e-9)).length;
}

/** Step path across the whole axis. */
function buildStepPath(): string {
  const thresholds = [
    WATER_ACTIVITY_AXIS.min,
    ...GROWTH_ZONES.map((z) => z.min ?? WATER_ACTIVITY_AXIS.min).sort((a, b) => a - b),
    WATER_ACTIVITY_AXIS.max,
  ];
  const points: string[] = [];
  let previousCount = 0;
  points.push(`M ${xScale(WATER_ACTIVITY_AXIS.min)} ${yScale(0)}`);
  for (const t of thresholds) {
    const x = xScale(Math.min(Math.max(t, WATER_ACTIVITY_AXIS.min), WATER_ACTIVITY_AXIS.max));
    points.push(`L ${x} ${yScale(previousCount)}`);
    const count = groupCount(t + 1e-9);
    points.push(`L ${x} ${yScale(count)}`);
    previousCount = count;
  }
  points.push(`L ${xScale(WATER_ACTIVITY_AXIS.max)} ${yScale(previousCount)}`);
  return points.join(' ');
}

const STEP_PATH = buildStepPath();
const AREA_PATH = `${STEP_PATH} L ${xScale(WATER_ACTIVITY_AXIS.max)} ${yScale(0)} L ${xScale(
  WATER_ACTIVITY_AXIS.min,
)} ${yScale(0)} Z`;

const X_TICKS = [0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.87, 0.9, 0.95, 1.0];

export function WaterActivityChart({
  value,
  className,
}: {
  /** Current a_w, or null when it is not determined. */
  value: number | null;
  className?: string;
}) {
  const [hoverAw, setHoverAw] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const active = hoverAw ?? value;
  const classification = active !== null ? classifyWaterActivity(active) : null;

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    // Convert client px → viewBox units → a_w.
    const viewX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    const ratio = (viewX - PAD.left) / PLOT.width;
    if (ratio < 0 || ratio > 1) {
      setHoverAw(null);
      return;
    }
    const aw =
      WATER_ACTIVITY_AXIS.min + ratio * (WATER_ACTIVITY_AXIS.max - WATER_ACTIVITY_AXIS.min);
    setHoverAw(Math.round(aw * 1000) / 1000);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="scroll-x">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          className="h-auto w-full min-w-[560px] touch-none"
          role="img"
          aria-label={
            active !== null
              ? `График активности воды. Текущее значение a_w ${active.toFixed(3)}, зона: ${
                  classification?.primaryZone?.label ?? 'не определена'
                }`
              : 'График активности воды и роста микроорганизмов. Текущее значение a_w не определено.'
          }
          onPointerMove={handlePointer}
          onPointerLeave={() => setHoverAw(null)}
        >
          <defs>
            <linearGradient id="aw-area" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.28" />
              <stop offset="45%" stopColor="var(--color-caramel-400)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-bordeaux-500)" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {/* Horizontal grid */}
          {Array.from({ length: MAX_GROUPS + 1 }, (_, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={yScale(i)}
                x2={PAD.left + PLOT.width}
                y2={yScale(i)}
                stroke="var(--border-subtle)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={yScale(i) + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {i}
              </text>
            </g>
          ))}

          <path d={AREA_PATH} fill="url(#aw-area)" />
          <path d={STEP_PATH} fill="none" stroke="var(--accent)" strokeWidth="2" />

          {/* X ticks */}
          {X_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={xScale(tick)}
                y1={PAD.top + PLOT.height}
                x2={xScale(tick)}
                y2={PAD.top + PLOT.height + 4}
                stroke="var(--border-strong)"
              />
              <text
                x={xScale(tick)}
                y={PAD.top + PLOT.height + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          <text
            x={PAD.left + PLOT.width / 2}
            y={VIEW.height - 2}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-secondary)"
          >
            Активность воды (a_w)
          </text>
          <text
            x={-(PAD.top + PLOT.height / 2)}
            y={12}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-secondary)"
            transform="rotate(-90)"
          >
            Групп микроорганизмов
          </text>

          {/* Current-value marker */}
          {active !== null ? (
            <g>
              <line
                x1={xScale(active)}
                y1={PAD.top}
                x2={xScale(active)}
                y2={PAD.top + PLOT.height}
                stroke={
                  classification ? RISK_COLORS[classification.highestRiskLevel] : 'var(--accent)'
                }
                strokeWidth="2"
                strokeDasharray={hoverAw !== null && value === null ? '4 3' : undefined}
              />
              <circle
                cx={xScale(active)}
                cy={yScale(groupCount(active))}
                r="4.5"
                fill={
                  classification ? RISK_COLORS[classification.highestRiskLevel] : 'var(--accent)'
                }
                stroke="var(--surface-card)"
                strokeWidth="2"
              />
              <g transform={`translate(${xScale(active)}, ${PAD.top - 4})`}>
                <rect
                  x={active > 0.85 ? -68 : -34}
                  y={-14}
                  width="68"
                  height="16"
                  rx="4"
                  fill="var(--surface-inverse)"
                />
                <text
                  x={active > 0.85 ? -34 : 0}
                  y={-2.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--text-inverse)"
                >
                  a_w {active.toFixed(3)}
                </text>
              </g>
            </g>
          ) : null}
        </svg>
      </div>

      {/* Zone bands — overlaps are visible here by design */}
      <div className="scroll-x">
        <div className="min-w-[560px] space-y-1.5">
          {WATER_ACTIVITY_ZONES.map((zone) => {
            const isActive = classification?.risks.includes(zone.id) ?? false;
            return (
              <ZoneBand key={zone.id} zone={zone} active={isActive} currentAw={active} />
            );
          })}
        </div>
      </div>

      <p className="text-muted text-xs">
        График показывает потенциальную микробиологическую активность, а не срок хранения.
        Пересечение зон 0.80–0.87 и &gt; 0.86 воспроизводит исходный график и не является ошибкой.
      </p>
    </div>
  );
}

function ZoneBand({
  zone,
  active,
  currentAw,
}: {
  zone: WaterActivityZone;
  active: boolean;
  currentAw: number | null;
}) {
  const from = zone.min ?? WATER_ACTIVITY_AXIS.min;
  const to = zone.max ?? WATER_ACTIVITY_AXIS.max;
  const span = WATER_ACTIVITY_AXIS.max - WATER_ACTIVITY_AXIS.min;
  const left = ((Math.max(from, WATER_ACTIVITY_AXIS.min) - WATER_ACTIVITY_AXIS.min) / span) * 100;
  const width =
    ((Math.min(to, WATER_ACTIVITY_AXIS.max) - Math.max(from, WATER_ACTIVITY_AXIS.min)) / span) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="w-[136px] shrink-0 text-right">
        <span
          className={cn(
            'tabular text-[11px]',
            active ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
          )}
        >
          {zone.sourceRange}
        </span>
      </div>
      <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[var(--surface-sunken)]">
        <div
          className={cn(
            'absolute inset-y-0 rounded-md transition-opacity',
            active ? 'opacity-100' : 'opacity-30',
          )}
          style={{
            left: `${left}%`,
            width: `${Math.max(width, 1.5)}%`,
            backgroundColor: RISK_COLORS[zone.riskLevel],
          }}
        />
        {currentAw !== null ? (
          <div
            className="absolute inset-y-0 w-px bg-[var(--text-primary)] opacity-60"
            style={{
              left: `${((currentAw - WATER_ACTIVITY_AXIS.min) / span) * 100}%`,
            }}
          />
        ) : null}
      </div>
      <div className="w-[280px] shrink-0">
        <span
          className={cn(
            'text-xs',
            active ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
          )}
        >
          {zone.label}
        </span>
      </div>
    </div>
  );
}
