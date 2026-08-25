/**
 * Evidence status and confidence vocabulary (spec §33, §48).
 *
 * Every scientific output in this application carries one of these labels. The
 * point is spec §59: the system must be able to say "this is exact", "this is
 * an estimate", "this needs a measurement" and "the literature disagrees"
 * instead of always producing a number.
 */

/** Spec §48 — how well supported a claim, formula or coefficient is. */
export type EvidenceStatus =
  | 'validated'
  | 'well_supported'
  | 'empirical'
  | 'approximate'
  | 'experimental'
  | 'uncertain'
  | 'not_recommended';

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  validated: 'Валидировано',
  well_supported: 'Хорошо обосновано',
  empirical: 'Эмпирическое',
  approximate: 'Приближённое',
  experimental: 'Экспериментальное',
  uncertain: 'Неопределённое',
  not_recommended: 'Не рекомендуется',
};

export const EVIDENCE_STATUS_DESCRIPTIONS: Record<EvidenceStatus, string> = {
  validated:
    'Модель проверена по опубликованным данным, и наша реализация численно воспроизводит опубликованные значения.',
  well_supported:
    'Модель или величина многократно подтверждена в рецензируемой литературе, но независимой численной проверки в этом проекте нет.',
  empirical:
    'Наблюдение или подгонка по данным. Работает в пределах наблюдённого диапазона и не является физическим законом.',
  approximate:
    'Упрощение с известной систематической погрешностью. Порядок величины верен, точное значение — нет.',
  experimental:
    'Гипотеза или предварительная модель. Не использовать для решений о безопасности продукта.',
  uncertain:
    'Литература противоречива или данных недостаточно. Значение показывается только с явной оговоркой.',
  not_recommended:
    'Проверено и отвергнуто для этого класса продуктов. Сохранено, чтобы объяснить, почему не используется.',
};

/** Spec §36 — how much trust a specific computed result deserves. */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
  none: 'Недостаточно данных',
};

/** Spec §32 — the four categories every parameter falls into. */
export type ParameterKind =
  | 'exact_from_recipe'
  | 'scientific_model'
  | 'requires_measurement'
  | 'requires_calibration';

export const PARAMETER_KIND_LABELS: Record<ParameterKind, string> = {
  exact_from_recipe: 'Точный расчёт из рецепта',
  scientific_model: 'Расчёт по научной модели',
  requires_measurement: 'Требует лабораторного измерения',
  requires_calibration: 'Требует экспериментальной калибровки',
};

/**
 * Traceability record attached to every scientific result (spec §36, §60).
 *
 * Answers the five mandatory questions: where did the number come from, which
 * formula produced it, why that formula applies, over what range it is valid,
 * and how much it can be trusted.
 */
export interface Provenance {
  /** Id from the formula registry, when a formula produced the value. */
  formulaId: string | null;
  /** Ids from the source registry. */
  sourceIds: string[];
  status: EvidenceStatus;
  confidence: ConfidenceLevel;
  /** Why this method is applicable to the recipe at hand. */
  applicabilityNote: string;
  /** Conditions under which the result stops being valid. */
  limitations: string[];
  /** Assumptions the number rests on. */
  assumptions: string[];
}

/**
 * A numeric result that knows its own uncertainty (spec §33).
 *
 * `value` is the point estimate; `low`/`high` bound it. Never render `value`
 * to more precision than `low`/`high` justify — see formatUncertain().
 */
export interface UncertainValue {
  value: number | null;
  low: number | null;
  high: number | null;
  unit: string;
  provenance: Provenance;
}

/**
 * Formats an uncertain value without inventing precision (spec §33).
 *
 * Returns e.g. "0.85 (0.82–0.88)" rather than "0.8523". When the interval is
 * wide the point estimate is suppressed entirely, because quoting it would
 * imply an accuracy the model does not have.
 */
export function formatUncertain(
  v: UncertainValue,
  digits = 2,
  /** Relative half-width above which the point estimate is hidden. */
  suppressPointAbove = 0.25,
): string {
  if (v.value === null || !Number.isFinite(v.value)) return '—';

  const hasRange =
    v.low !== null && v.high !== null && Number.isFinite(v.low) && Number.isFinite(v.high);

  if (!hasRange) return v.value.toFixed(digits);

  const low = v.low as number;
  const high = v.high as number;
  const halfWidth = (high - low) / 2;
  const relative = v.value !== 0 ? Math.abs(halfWidth / v.value) : Number.POSITIVE_INFINITY;

  if (relative > suppressPointAbove) {
    return `${low.toFixed(digits)}–${high.toFixed(digits)}`;
  }
  return `${v.value.toFixed(digits)} (${low.toFixed(digits)}–${high.toFixed(digits)})`;
}
