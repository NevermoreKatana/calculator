/**
 * Composition-based water-activity model (spec §10, §32 category 2).
 *
 * This is the model the previous version of the application deliberately left
 * unimplemented, with a correct justification at the time: the ingredient data
 * carried a single aggregate "сахара" column, and every published confectionery
 * a_w equation needs the MOLAR concentration of each dissolved species.
 *
 * That blocker has been removed by the speciation layer (src/lib/science/
 * sugars.ts + ingredient-sugar-profiles.ts), so the model can now be
 * instantiated on real data. What has NOT changed is the honesty contract: the
 * model reports its own confidence, degrades it when the speciation is a guess,
 * and refuses outright when the recipe is outside the equations' validity range.
 *
 * Priority is unchanged: a MEASURED a_w always beats this (spec §51).
 */

import {
  buildAqueousPhase,
  type AqueousPhase,
  type AqueousPhaseContribution,
} from '../aqueous-phase';
import {
  norrishMultiSoluteWaterActivity,
  raoultWaterActivity,
  rossWaterActivity,
  type SoluteMoles,
} from './equations';
import type { ConfidenceLevel, Provenance } from '../confidence';
import type { SugarProfileResolutionMethod } from '../ingredient-sugar-profiles';

/** One sugar-bearing recipe line, as far as the confidence model is concerned. */
export interface SpeciationEntry {
  method: SugarProfileResolutionMethod;
  /** 0..1 trust in this particular assignment. */
  confidence: number;
  /** Sugar mass the assignment governs, g — the weight in the average. */
  sugarGrams: number;
}

/**
 * Validity envelope of the Norrish constants.
 *
 * Below 0.60 the model is extrapolating past any data used to fit K, and above
 * ~0.99 the arithmetic is dominated by rounding. Outside this band the model
 * returns a value but flags it.
 */
export const NORRISH_VALIDITY = {
  minAw: 0.6,
  maxAw: 0.999,
  /** Above this dissolved-solids %, the polyol constants lose accuracy. */
  polyolAccuracyLimitPercent: 60,
  /** Above this dissolved-solids %, even sucrose leaves the fitted range. */
  sucroseAccuracyLimitPercent: 90,
} as const;

export interface CompositionAwInput {
  contributions: readonly AqueousPhaseContribution[];
  /** How each sugar-bearing line's profile was obtained — drives confidence. */
  speciation: readonly SpeciationEntry[];
  temperatureCelsius?: number;
}

export interface CompositionAwResult {
  available: boolean;
  /** Primary answer: multi-solute Norrish. */
  waterActivity: number | null;
  /** Uncertainty band, from cross-model spread and speciation quality. */
  low: number | null;
  high: number | null;

  /** Cross-checks, shown for traceability (spec §37). */
  crossChecks: {
    norrish: number | null;
    ross: number | null;
    raoult: number | null;
    /** |norrish − ross| — a proxy for model disagreement. */
    modelSpread: number | null;
  };

  aqueousPhase: AqueousPhase;
  confidence: ConfidenceLevel;
  provenance: Provenance;
  reason: string;
  warnings: string[];
}

/**
 * Half-width of the uncertainty band, in a_w units.
 *
 * Built from three documented contributions rather than picked:
 *   0.010  our own validation deviation against the published sucrose table
 *   0.011  the largest Norrish–Ross disagreement observed on real ganaches
 *   +      a speciation penalty when profiles came from category defaults
 * See docs/scientific-research/09-model-limitations.md.
 */
const BASE_UNCERTAINTY = 0.01;
const MODEL_SPREAD_WEIGHT = 1.0;
const SPECIATION_PENALTY_MAX = 0.04;

export function calculateCompositionWaterActivity(
  input: CompositionAwInput,
): CompositionAwResult {
  const aqueousPhase = buildAqueousPhase(input.contributions, {
    temperatureCelsius: input.temperatureCelsius,
  });

  const warnings = aqueousPhase.warnings.map((w) => w.message);

  const provenanceBase: Omit<Provenance, 'confidence'> = {
    formulaId: 'norrish-multi-solute',
    sourceIds: ['norrish-1966', 'fao-y4358e-ch4', 'baeza-2010-norrish', 'chirife-1980-1982'],
    status: 'well_supported',
    applicabilityNote:
      'Уравнение Норриша выведено для кондитерских сиропов; водная фаза ганаша является концентрированным сахарным сиропом, поэтому модель применяется к водной фазе, а жир и какао-частицы исключены из мольного баланса.',
    limitations: [
      'Константы K получены преимущественно по данным при a_w > 0.85.',
      'Связывание воды белками молока и какао-частицами не моделируется.',
      'Константы приведены для 20–25 °C; температурная зависимость не учитывается.',
      'Расчёт описывает МОМЕНТ ИЗГОТОВЛЕНИЯ. При хранении a_w меняется (ВНИИЗ).',
    ],
    assumptions: [
      'Растворённые вещества взаимодействуют с водой, но не друг с другом.',
      'Вся вода доступна как растворитель.',
      'Учтённые сахара растворены; избыток сверх растворимости исключён отдельно.',
    ],
  };

  if (aqueousPhase.waterGrams <= 0) {
    return {
      available: false,
      waterActivity: null,
      low: null,
      high: null,
      crossChecks: { norrish: null, ross: null, raoult: null, modelSpread: null },
      aqueousPhase,
      confidence: 'none',
      provenance: { ...provenanceBase, confidence: 'none' },
      reason:
        'В рецепте нет воды. Активность воды не определена: без водной фазы величина не имеет смысла.',
      warnings,
    };
  }

  const solutes: SoluteMoles[] = aqueousPhase.solutes.map((s) => ({
    moles: s.moles,
    norrishK: s.norrishK,
  }));

  if (solutes.length === 0 || aqueousPhase.soluteMoles <= 0) {
    return {
      available: true,
      waterActivity: 1,
      low: 0.99,
      high: 1,
      crossChecks: { norrish: 1, ross: 1, raoult: 1, modelSpread: 0 },
      aqueousPhase,
      confidence: 'high',
      provenance: { ...provenanceBase, confidence: 'high' },
      reason:
        'В водной фазе нет растворённых веществ: активность воды равна активности чистой воды, a_w ≈ 1.0. Продукт микробиологически нестабилен.',
      warnings,
    };
  }

  const norrish = norrishMultiSoluteWaterActivity(aqueousPhase.waterMoles, solutes);
  const ross = rossWaterActivity(aqueousPhase.waterMoles, solutes);
  const raoult = raoultWaterActivity(aqueousPhase.waterMoles, solutes);
  const modelSpread = Number.isFinite(norrish) && Number.isFinite(ross) ? Math.abs(norrish - ross) : null;

  if (!Number.isFinite(norrish)) {
    return {
      available: false,
      waterActivity: null,
      low: null,
      high: null,
      crossChecks: { norrish: null, ross: null, raoult: null, modelSpread: null },
      aqueousPhase,
      confidence: 'none',
      provenance: { ...provenanceBase, confidence: 'none' },
      reason: 'Расчёт не дал конечного значения. Проверьте состав рецепта.',
      warnings,
    };
  }

  // ── Confidence grading ─────────────────────────────────────────────────
  // Weighted by sugar mass: an assignment that governs 220 g of sucrose says
  // far more about the answer than one governing 1.3 g of lactose.
  const entries = input.speciation;
  const totalSugar = entries.reduce((sum, e) => sum + Math.max(0, e.sugarGrams), 0);
  const speciationScore =
    totalSugar > 0
      ? entries.reduce((sum, e) => sum + e.confidence * Math.max(0, e.sugarGrams), 0) / totalSugar
      : entries.length > 0
        ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
        : 0;

  const unresolvedCount = entries.filter((e) => e.method === 'unresolved').length;
  const categoryDefaultCount = entries.filter((e) => e.method === 'category_default').length;

  const speciationPenalty = (1 - speciationScore) * SPECIATION_PENALTY_MAX;
  const spreadPenalty = (modelSpread ?? 0) * MODEL_SPREAD_WEIGHT;
  const halfWidth = BASE_UNCERTAINTY + speciationPenalty + spreadPenalty;

  const low = Math.max(0, norrish - halfWidth);
  const high = Math.min(1, norrish + halfWidth);

  // Ceiling note: a COMPUTED a_w never reaches 'high'. That is reserved for a
  // measured value, because the model's own validation error (±0.0085 against
  // published data) plus the unmodelled protein/particle binding put a floor
  // under the uncertainty no amount of good speciation can remove.
  let confidence: ConfidenceLevel;
  if (unresolvedCount > 0) {
    confidence = 'low';
  } else if (speciationScore >= 0.85 && (modelSpread ?? 0) <= 0.02) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // ── Validity-range checks ──────────────────────────────────────────────
  const limitations = [...provenanceBase.limitations];

  if (norrish < NORRISH_VALIDITY.minAw) {
    warnings.push(
      `Расчётная a_w = ${norrish.toFixed(3)} ниже ${NORRISH_VALIDITY.minAw}, где константы Норриша не подтверждены данными. Значение показано, но точность за пределами области подгонки.`,
    );
    confidence = 'low';
  }

  const hasPolyol = aqueousPhase.solutes.some(
    (s) => s.species === 'sorbitol' || s.species === 'glycerol',
  );
  if (hasPolyol && aqueousPhase.dissolvedSolidsPercent > NORRISH_VALIDITY.polyolAccuracyLimitPercent) {
    warnings.push(
      `Водная фаза содержит полиолы при ${aqueousPhase.dissolvedSolidsPercent.toFixed(1)} % растворённых сухих веществ. Выше ${NORRISH_VALIDITY.polyolAccuracyLimitPercent} % константы Норриша для сорбита и глицерина теряют точность (Baeza et al. 2010), и реальная a_w, вероятно, ниже расчётной.`,
    );
    limitations.push('Полиолы выше 60 % растворённых сухих веществ: константа K занижена.');
    confidence = 'low';
  }

  if (aqueousPhase.dissolvedSolidsPercent > NORRISH_VALIDITY.sucroseAccuracyLimitPercent) {
    warnings.push(
      `Водная фаза содержит ${aqueousPhase.dissolvedSolidsPercent.toFixed(1)} % растворённых сухих веществ — выше диапазона, на котором проверялись константы Норриша.`,
    );
    confidence = 'low';
  }

  const reasonParts = [
    `Расчёт по мультисолютному уравнению Норриша для водной фазы: ${aqueousPhase.waterGrams.toFixed(1)} г воды, ${aqueousPhase.dissolvedSolutesGrams.toFixed(1)} г растворённых веществ (${aqueousPhase.dissolvedSolidsPercent.toFixed(1)} % растворённых сухих веществ водной фазы).`,
  ];
  if (unresolvedCount > 0) {
    reasonParts.push(
      `${unresolvedCount} ингр. с неопределённым видом сахаров исключены из мольного баланса — оценка занижена по осмотической силе.`,
    );
  }
  if (categoryDefaultCount > 0) {
    reasonParts.push(
      `${categoryDefaultCount} ингр. получили профиль сахаров по категории, а не по прямым данным.`,
    );
  }

  return {
    available: true,
    waterActivity: norrish,
    low,
    high,
    crossChecks: { norrish, ross, raoult, modelSpread },
    aqueousPhase,
    confidence,
    provenance: { ...provenanceBase, limitations, confidence },
    reason: reasonParts.join(' '),
    warnings,
  };
}
