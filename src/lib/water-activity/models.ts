import type { IngredientContribution } from '../calculator/types';

/**
 * Pluggable water-activity models (spec §27, §28).
 *
 * The deliberate design constraint: NO MODEL IN THIS FILE INVENTS a_w FROM THE
 * RECIPE COMPOSITION. Water percentage and a_w are different physical
 * quantities and one cannot be derived from the other without a validated
 * model plus data this application does not have (spec §8).
 *
 * A model that cannot answer returns `available: false` together with a
 * machine-readable reason, so the UI can say "нет данных" instead of showing a
 * fabricated number.
 */

export type WaterActivitySourceKind = 'measured' | 'reference' | 'model' | 'none';

export interface WaterActivityInput {
  waterPercentage: number;
  dryMatterPercentage: number;
  sugarPercentage: number;
  temperatureCelsius?: number | null;
  ingredients: IngredientContribution[];
  /** User-supplied instrument reading, 0..1. */
  measuredValue?: number | null;
}

export interface WaterActivityResult {
  available: boolean;
  value: number | null;
  source: WaterActivitySourceKind;
  modelId: string;
  modelLabel: string;
  /** Human-readable explanation of the source or of why there is no value. */
  reason: string;
  /** For unavailable results: what would be required to produce a value. */
  missingData?: string[];
}

export interface WaterActivityModel {
  id: string;
  label: string;
  description: string;
  calculate(input: WaterActivityInput): WaterActivityResult;
}

/**
 * Priority 1. A reading from a water-activity meter, entered by the user.
 * A measured value always wins over anything computed (spec §27).
 */
export const MeasuredAwModel: WaterActivityModel = {
  id: 'measured',
  label: 'Измеренное значение',
  description:
    'Значение a_w, измеренное прибором и введённое пользователем. Имеет приоритет над любыми расчётными оценками.',
  calculate(input) {
    const value = input.measuredValue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
      return {
        available: false,
        value: null,
        source: 'none',
        modelId: 'measured',
        modelLabel: MeasuredAwModel.label,
        reason: 'Измеренное значение a_w не введено.',
        missingData: ['Показание влагомера (a_w) в диапазоне 0–1'],
      };
    }
    return {
      available: true,
      value,
      source: 'measured',
      modelId: 'measured',
      modelLabel: MeasuredAwModel.label,
      reason: 'Измеренное значение, введённое пользователем.',
    };
  },
};

/**
 * A measured a_w attached to an empirical reference formulation.
 *
 * The table below is intentionally EMPTY. The reference data supplied for this
 * project (spec §10) records water %, sugar % and shelf life in days — it
 * contains no a_w measurements at all. Rather than back-fill it with guesses,
 * the model reports that it has nothing to match against. Populating
 * `REFERENCE_AW_MEASUREMENTS` with real instrument readings is all that is
 * needed to activate this model; no other code has to change.
 */
export interface ReferenceAwMeasurement {
  label: string;
  waterPercentage: number;
  sugarPercentage: number;
  waterActivity: number;
  source: string;
}

export const REFERENCE_AW_MEASUREMENTS: readonly ReferenceAwMeasurement[] = [];

/** Tolerance, in percentage points, for matching a recipe to a reference. */
const REFERENCE_MATCH_TOLERANCE = 0.5;

export const ReferenceAwModel: WaterActivityModel = {
  id: 'reference',
  label: 'Справочные измерения',
  description:
    'Подбор a_w по таблице реальных измерений для эталонных рецептур. Активируется при наполнении таблицы измерений.',
  calculate(input) {
    if (REFERENCE_AW_MEASUREMENTS.length === 0) {
      return {
        available: false,
        value: null,
        source: 'none',
        modelId: 'reference',
        modelLabel: ReferenceAwModel.label,
        reason:
          'В наборе эталонных данных нет ни одного измерения a_w. Контрольные точки срока годности содержат только воду, сахара и дни.',
        missingData: [
          'Измеренные значения a_w для эталонных рецептур',
          'Условия измерения (температура, прибор, методика)',
        ],
      };
    }

    const match = REFERENCE_AW_MEASUREMENTS.find(
      (ref) =>
        Math.abs(ref.waterPercentage - input.waterPercentage) <= REFERENCE_MATCH_TOLERANCE &&
        Math.abs(ref.sugarPercentage - input.sugarPercentage) <= REFERENCE_MATCH_TOLERANCE,
    );

    if (!match) {
      return {
        available: false,
        value: null,
        source: 'none',
        modelId: 'reference',
        modelLabel: ReferenceAwModel.label,
        reason: 'Рецепт не совпадает ни с одной эталонной рецептурой с измеренным a_w.',
      };
    }

    return {
      available: true,
      value: match.waterActivity,
      source: 'reference',
      modelId: 'reference',
      modelLabel: ReferenceAwModel.label,
      reason: `Измерение эталонной рецептуры «${match.label}» (${match.source}).`,
    };
  },
};

/**
 * Placeholder for a validated physico-chemical model (Norrish, Money–Born,
 * Grover, or a fitted product-specific correlation).
 *
 * It deliberately computes nothing. The blockers below are concrete and
 * verifiable against the imported ingredient schema, not hedging: every
 * published confectionery a_w equation needs the MOLAR concentration of each
 * dissolved species, and the source Database carries a single aggregate
 * "сахара" column with no speciation. Until the ingredient model records which
 * sugars are present, the equations cannot be instantiated at all.
 */
export const FutureScientificAwModel: WaterActivityModel = {
  id: 'scientific',
  label: 'Научная модель (не подключена)',
  description:
    'Слот для валидированной физико-химической модели a_w. Не реализован: во входных данных отсутствуют величины, которые требуются любой из известных формул.',
  calculate() {
    return {
      available: false,
      value: null,
      source: 'none',
      modelId: 'scientific',
      modelLabel: FutureScientificAwModel.label,
      reason:
        'Валидированная модель не подключена. Формула не выдумывается: расчёт a_w из одного процента воды физически некорректен.',
      missingData: [
        'Раздельный состав сахаров (сахароза, глюкоза, фруктоза, инвертный сироп, сорбит) — в базе есть только суммарная колонка «сахара»',
        'Молярные массы растворённых веществ для расчёта мольной доли',
        'Содержание солей (NaCl) — отдельной колонки в базе нет',
        'Разделение «прочих сухих» на растворимые и нерастворимые',
        'Температура продукта при измерении',
        'Валидация модели по измеренным a_w для этого класса изделий',
      ],
    };
  },
};

/** Resolution order: measured wins, then reference, then a scientific model. */
export const DEFAULT_AW_MODEL_CHAIN: readonly WaterActivityModel[] = [
  MeasuredAwModel,
  ReferenceAwModel,
  FutureScientificAwModel,
];

export const ALL_AW_MODELS: readonly WaterActivityModel[] = DEFAULT_AW_MODEL_CHAIN;
