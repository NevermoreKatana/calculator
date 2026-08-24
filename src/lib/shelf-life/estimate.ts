import {
  REFERENCE_ENVELOPE,
  REFERENCE_POINTS_BY_WATER,
  SHELF_LIFE_DISCLAIMER,
  type ShelfLifeReferencePoint,
} from './reference-points';

/**
 * Reference-based shelf-life estimation (spec §12–§14).
 *
 * There is NO formula relating water %, sugar % and dry matter to days. The
 * only thing this module is allowed to do is:
 *   • report a reference point when the recipe matches one, or
 *   • interpolate between two ADJACENT reference points, by an explicitly
 *     documented method, when the recipe lies between them, or
 *   • refuse, saying why.
 *
 * ── Why the interpolation is 1-D ──────────────────────────────────────────
 * The three reference points do not scatter across a (water, sugar) plane —
 * they trace a single monotone path: as water rises 17.5 → 18.6 → 20.0, sugar
 * falls 35 → 32 → 30–32 and shelf life falls 90 → 58–63 → 38–44. Three points
 * on one path cannot determine a 2-D surface: any fitted plane would be an
 * arbitrary choice among infinitely many that pass through the data (spec §14).
 *
 * So the estimator interpolates along WATER only, and then CHECKS that the
 * recipe's sugar level is consistent with the sugar trajectory between the same
 * two points. If sugar departs from that trajectory the recipe is off the
 * observed path, the interpolation would be unsupported, and the estimator
 * returns "insufficient data" instead of a number.
 *
 * a_w is accepted and echoed for display but takes NO part in the arithmetic:
 * the reference data contains no a_w measurements, and the a_w chart is not a
 * shelf-life chart (spec §22).
 */

export type ShelfLifeMethod =
  | 'reference_point_match'
  | 'linear_interpolation'
  | 'insufficient_data';

export interface ShelfLifeEstimateInput {
  waterPercentage: number;
  sugarPercentage: number;
  dryMatterPercentage: number;
  totalWeightGrams: number;
  /** Optional, display only. */
  waterActivity?: number | null;
}

export interface ShelfLifeEstimate {
  available: boolean;
  daysMin: number | null;
  daysMax: number | null;
  method: ShelfLifeMethod;
  /** User-facing description of the method (spec §14: it must be visible). */
  methodLabel: string;
  /** Reference points the answer rests on. */
  basis: ShelfLifeReferencePoint[];
  inputs: ShelfLifeEstimateInput;
  /** Why there is no estimate, when `available` is false. */
  reason?: string;
  notes: string[];
  disclaimer: typeof SHELF_LIFE_DISCLAIMER;
}

/** Water tolerance, in percentage points, for calling it an exact match. */
const WATER_MATCH_TOLERANCE = 0.15;
/** Sugar tolerance for an exact match. */
const SUGAR_MATCH_TOLERANCE = 0.5;
/**
 * How far the recipe's sugar may sit from the interpolated sugar trajectory
 * before the recipe is considered off the observed path.
 */
const SUGAR_TRAJECTORY_TOLERANCE = 2.0;

const QUALITATIVE_DRY_MATTER_NOTE =
  'Чем выше доля сухих веществ, тем потенциально ниже доля свободной воды. Это качественное наблюдение из исходных материалов, а не расчётная зависимость.';

function baseNotes(input: ShelfLifeEstimateInput): string[] {
  const notes = [QUALITATIVE_DRY_MATTER_NOTE];
  if (typeof input.waterActivity === 'number' && Number.isFinite(input.waterActivity)) {
    notes.push(
      `Значение a_w = ${input.waterActivity.toFixed(3)} учтено только для оценки микробиологических зон и не влияет на расчёт срока: эмпирические контрольные точки не содержат измерений a_w.`,
    );
  }
  return notes;
}

function unavailable(
  input: ShelfLifeEstimateInput,
  reason: string,
  extraNotes: string[] = [],
): ShelfLifeEstimate {
  return {
    available: false,
    daysMin: null,
    daysMax: null,
    method: 'insufficient_data',
    methodLabel: 'Недостаточно данных для оценки',
    basis: [],
    inputs: input,
    reason,
    notes: [...baseNotes(input), ...extraNotes],
    disclaimer: SHELF_LIFE_DISCLAIMER,
  };
}

function sugarWithinPoint(point: ShelfLifeReferencePoint, sugar: number): boolean {
  return (
    sugar >= point.sugarPercentageMin - SUGAR_MATCH_TOLERANCE &&
    sugar <= point.sugarPercentageMax + SUGAR_MATCH_TOLERANCE
  );
}

export function calculateShelfLifeEstimate(
  input: ShelfLifeEstimateInput,
): ShelfLifeEstimate {
  const { waterPercentage: water, sugarPercentage: sugar } = input;

  if (!Number.isFinite(water) || !Number.isFinite(sugar)) {
    return unavailable(input, 'Вода или сахара не определены — рецепт пуст или имеет нулевой вес.');
  }
  if (input.totalWeightGrams <= 0) {
    return unavailable(input, 'Общий вес рецепта равен нулю — состав не определён.');
  }

  // ── 1. Exact match against a reference point ────────────────────────────
  const exact = REFERENCE_POINTS_BY_WATER.find(
    (point) =>
      Math.abs(point.waterPercentage - water) <= WATER_MATCH_TOLERANCE &&
      sugarWithinPoint(point, sugar),
  );

  if (exact) {
    return {
      available: true,
      daysMin: exact.shelfLifeDaysMin,
      daysMax: exact.shelfLifeDaysMax,
      method: 'reference_point_match',
      methodLabel: 'Совпадение с эмпирической контрольной точкой',
      basis: [exact],
      inputs: input,
      notes: [
        ...baseNotes(input),
        `Рецепт совпадает с контрольной точкой: вода ${exact.waterPercentage} %, сахара ${
          exact.sugarPercentageMin === exact.sugarPercentageMax
            ? `${exact.sugarPercentageMin} %`
            : `${exact.sugarPercentageMin}–${exact.sugarPercentageMax} %`
        }.`,
        ...(exact.notes ? [exact.notes] : []),
      ],
      disclaimer: SHELF_LIFE_DISCLAIMER,
    };
  }

  // ── 2. Outside the empirical envelope → refuse (no extrapolation) ───────
  if (water < REFERENCE_ENVELOPE.waterMin || water > REFERENCE_ENVELOPE.waterMax) {
    const direction = water < REFERENCE_ENVELOPE.waterMin ? 'ниже' : 'выше';
    return unavailable(
      input,
      `Содержание воды ${water.toFixed(1)} % находится ${direction} диапазона эмпирических данных (${REFERENCE_ENVELOPE.waterMin}–${REFERENCE_ENVELOPE.waterMax} %). Экстраполяция за пределы наблюдений не выполняется.`,
    );
  }

  // ── 3. Bracket between two adjacent points ──────────────────────────────
  let lower: ShelfLifeReferencePoint | null = null;
  let upper: ShelfLifeReferencePoint | null = null;
  for (let i = 0; i < REFERENCE_POINTS_BY_WATER.length - 1; i += 1) {
    const a = REFERENCE_POINTS_BY_WATER[i];
    const b = REFERENCE_POINTS_BY_WATER[i + 1];
    if (water >= a.waterPercentage && water <= b.waterPercentage) {
      lower = a;
      upper = b;
      break;
    }
  }

  if (!lower || !upper) {
    return unavailable(
      input,
      'Не удалось подобрать пару соседних контрольных точек для интерполяции.',
    );
  }

  const span = upper.waterPercentage - lower.waterPercentage;
  if (span <= 0) {
    return unavailable(input, 'Контрольные точки вырождены: нулевой интервал по воде.');
  }

  const t = (water - lower.waterPercentage) / span;

  // Sugar must stay on the trajectory the two points describe.
  const expectedSugarMin =
    lower.sugarPercentageMin + t * (upper.sugarPercentageMin - lower.sugarPercentageMin);
  const expectedSugarMax =
    lower.sugarPercentageMax + t * (upper.sugarPercentageMax - lower.sugarPercentageMax);

  if (
    sugar < expectedSugarMin - SUGAR_TRAJECTORY_TOLERANCE ||
    sugar > expectedSugarMax + SUGAR_TRAJECTORY_TOLERANCE
  ) {
    return unavailable(
      input,
      `Нет достаточной эмпирической информации для расчёта точного срока. При воде ${water.toFixed(
        1,
      )} % контрольные значения описывают сахара ${expectedSugarMin.toFixed(
        1,
      )}–${expectedSugarMax.toFixed(1)} % (±${SUGAR_TRAJECTORY_TOLERANCE} п.п.), а в рецепте ${sugar.toFixed(
        1,
      )} %. Рецепт находится вне области, покрытой эмпирическими данными.`,
      [
        'Две переменные (вода и сахара) при трёх контрольных точках не задают двумерную поверхность, поэтому произвольная 2D-интерполяция здесь не применяется.',
      ],
    );
  }

  const rawMin = lower.shelfLifeDaysMin + t * (upper.shelfLifeDaysMin - lower.shelfLifeDaysMin);
  const rawMax = lower.shelfLifeDaysMax + t * (upper.shelfLifeDaysMax - lower.shelfLifeDaysMax);
  const daysMin = Math.min(rawMin, rawMax);
  const daysMax = Math.max(rawMin, rawMax);

  return {
    available: true,
    daysMin,
    daysMax,
    method: 'linear_interpolation',
    methodLabel: 'Интерполяция между эмпирическими контрольными точками',
    basis: [lower, upper],
    inputs: input,
    notes: [
      ...baseNotes(input),
      `Линейная интерполяция по содержанию воды между точками ${lower.waterPercentage} % и ${upper.waterPercentage} % (коэффициент t = ${t.toFixed(3)}).`,
      `Содержание сахаров ${sugar.toFixed(1)} % проверено на соответствие траектории контрольных точек (${expectedSugarMin.toFixed(1)}–${expectedSugarMax.toFixed(1)} % ±${SUGAR_TRAJECTORY_TOLERANCE} п.п.) и признано согласованным.`,
      'Сахара не интерполируются независимо: трёх контрольных точек недостаточно для двумерной модели.',
    ],
    disclaimer: SHELF_LIFE_DISCLAIMER,
  };
}
