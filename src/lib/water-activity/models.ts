import type { IngredientContribution } from '../calculator/types';
import {
  calculateCompositionWaterActivity,
  type AqueousPhaseContribution,
  type SpeciationEntry,
  type CompositionAwResult,
} from '../science';

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
  /**
   * Aqueous-phase payload produced by the science adapter. Present when the
   * caller has resolved sugar speciation; absent when it has not, in which
   * case the composition model correctly reports that it cannot run.
   */
  science?: {
    contributions: readonly AqueousPhaseContribution[];
    speciation: readonly SpeciationEntry[];
  } | null;
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
  /**
   * Full scientific detail when a computed model produced the value: the
   * uncertainty band, the cross-check models, the aqueous phase and the
   * provenance record (spec §36).
   */
  detail?: CompositionAwResult;
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
 * Composition-based scientific model (spec §32 category 2).
 *
 * ── What changed, and why it is now allowed to compute ────────────────────
 * This slot used to hold `FutureScientificAwModel`, which deliberately
 * returned nothing. Its stated blocker was accurate: every published
 * confectionery a_w equation needs the MOLAR concentration of each dissolved
 * species, and the imported Database has a single aggregate "сахара" column.
 *
 * The blocker has been removed rather than waived. src/lib/science/sugars.ts
 * and ingredient-sugar-profiles.ts add a speciation layer that resolves each
 * ingredient's sugar into named species with real molar masses, so Norrish's
 * equation can be instantiated on actual numbers. The model still refuses when
 * that resolution fails — it does not fall back to a guess.
 *
 * The remaining honesty guarantees are unchanged:
 *   • a measured value still wins (this model sits below MeasuredAwModel);
 *   • the result carries an uncertainty band, not a bare number;
 *   • confidence degrades when speciation came from category defaults;
 *   • validity-range violations are reported rather than hidden.
 */
export const CompositionScientificAwModel: WaterActivityModel = {
  id: 'scientific',
  label: 'Расчёт по составу (уравнение Норриша)',
  description:
    'Мультисолютное уравнение Норриша по водной фазе рецепта, с перекрёстной проверкой уравнениями Росса и Рауля. Учитывает вид сахаров, а не только их суммарную массу.',
  calculate(input) {
    const science = input.science;

    if (!science || science.contributions.length === 0) {
      return {
        available: false,
        value: null,
        source: 'none',
        modelId: 'scientific',
        modelLabel: CompositionScientificAwModel.label,
        reason:
          'Состав водной фазы не подготовлен: расчёт вызван без данных о видах сахаров.',
        missingData: [
          'Разложение сахаров по видам (сахароза, глюкоза, фруктоза, лактоза, сорбит, сухие вещества глюкозного сиропа)',
        ],
      };
    }

    const detail = calculateCompositionWaterActivity({
      contributions: science.contributions,
      speciation: science.speciation,
      temperatureCelsius: input.temperatureCelsius ?? undefined,
    });

    if (!detail.available || detail.waterActivity === null) {
      return {
        available: false,
        value: null,
        source: 'none',
        modelId: 'scientific',
        modelLabel: CompositionScientificAwModel.label,
        reason: detail.reason,
        missingData: detail.warnings,
        detail,
      };
    }

    return {
      available: true,
      value: detail.waterActivity,
      source: 'model',
      modelId: 'scientific',
      modelLabel: CompositionScientificAwModel.label,
      reason: detail.reason,
      detail,
    };
  },
};

/** Resolution order: measured wins, then reference, then a scientific model. */
export const DEFAULT_AW_MODEL_CHAIN: readonly WaterActivityModel[] = [
  MeasuredAwModel,
  ReferenceAwModel,
  CompositionScientificAwModel,
];

export const ALL_AW_MODELS: readonly WaterActivityModel[] = DEFAULT_AW_MODEL_CHAIN;
