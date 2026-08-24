import { REFERENCE_ENVELOPE } from './reference-points';
import type { ShelfLifeEstimate } from './estimate';

/**
 * Technological hints (spec §36).
 *
 * Every string here is phrased as a POSSIBILITY, never as a promise of extra
 * days. The thresholds are the bounds of the empirical envelope — they say
 * "your recipe sits outside the region where we have observations", which is a
 * statement about the data, not a claim about physics.
 */

export type RecommendationSeverity = 'info' | 'attention';

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  body: string;
}

export interface RecommendationInput {
  waterPercentage: number;
  sugarPercentage: number;
  dryMatterPercentage: number;
  sugarWaterRatio: number | null;
  estimate: ShelfLifeEstimate;
}

/** Dry matter at the driest reference point, used as an orientation value. */
const DRY_MATTER_REFERENCE = 100 - REFERENCE_ENVELOPE.waterMin; // 82.5 %

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];

  if (input.waterPercentage > REFERENCE_ENVELOPE.waterMax) {
    out.push({
      id: 'water-high',
      severity: 'attention',
      title: 'Воды больше, чем в эмпирических наблюдениях',
      body: `Содержание воды ${input.waterPercentage.toFixed(1)} % выше верхней контрольной точки (${REFERENCE_ENVELOPE.waterMax} %). Уменьшение воды потенциально снижает долю свободной воды. Величина эффекта по имеющимся данным не определяется.`,
    });
  }

  if (input.dryMatterPercentage < DRY_MATTER_REFERENCE) {
    out.push({
      id: 'dry-matter-low',
      severity: 'info',
      title: 'Доля сухих веществ ниже ориентира',
      body: `Сухая масса ${input.dryMatterPercentage.toFixed(1)} % против ${DRY_MATTER_REFERENCE.toFixed(1)} % у наиболее стабильной контрольной точки. Увеличение сухой массы может уменьшить долю свободной воды. Это качественная зависимость, не пересчитываемая в дни хранения.`,
    });
  }

  if (input.sugarPercentage < REFERENCE_ENVELOPE.sugarMin) {
    out.push({
      id: 'sugar-low',
      severity: 'attention',
      title: 'Сахаров меньше, чем в эмпирических наблюдениях',
      body: `Содержание сахаров ${input.sugarPercentage.toFixed(1)} % ниже нижней контрольной точки (${REFERENCE_ENVELOPE.sugarMin} %). Изменение концентрации сахаров может влиять на активность воды. Направление и величина влияния зависят от типа сахаров, который в текущей базе не детализирован.`,
    });
  } else if (input.sugarPercentage > REFERENCE_ENVELOPE.sugarMax) {
    out.push({
      id: 'sugar-high',
      severity: 'info',
      title: 'Сахаров больше, чем в эмпирических наблюдениях',
      body: `Содержание сахаров ${input.sugarPercentage.toFixed(1)} % выше верхней контрольной точки (${REFERENCE_ENVELOPE.sugarMax} %). Рецепт находится вне области, для которой есть наблюдения по сроку годности.`,
    });
  }

  if (input.sugarWaterRatio === null) {
    out.push({
      id: 'ratio-undefined',
      severity: 'info',
      title: 'Соотношение сахар / вода не определено',
      body: 'В рецепте нет воды, поэтому отношение сахаров к воде не вычисляется. Для безводных изделий микробиологическая порча обычно не является ограничивающим фактором, но окислительная и структурная стабильность оцениваются отдельно.',
    });
  }

  if (!input.estimate.available) {
    out.push({
      id: 'no-estimate',
      severity: 'attention',
      title: 'Теоретическая оценка срока не рассчитана',
      body:
        input.estimate.reason ??
        'Рецепт находится вне области, покрытой эмпирическими контрольными точками.',
    });
  }

  return out;
}
