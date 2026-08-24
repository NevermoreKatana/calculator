import { classifyWaterActivity, type WaterActivityClassification } from './classify';
import {
  DEFAULT_AW_MODEL_CHAIN,
  type WaterActivityInput,
  type WaterActivityModel,
  type WaterActivityResult,
} from './models';

export interface ResolvedWaterActivity {
  /** The winning result, or the last "unavailable" one when nothing resolved. */
  result: WaterActivityResult;
  /** Zone classification; `null` when a_w is unknown. */
  classification: WaterActivityClassification | null;
  /** What every model in the chain reported — shown on the settings page. */
  attempts: WaterActivityResult[];
}

/**
 * Runs the model chain in priority order and returns the first available value
 * (spec §27: a measured value takes precedence over any computed estimate).
 *
 * When no model can produce a value, `classification` is null and the UI must
 * render «Активность воды не определена» rather than substituting the recipe's
 * water percentage (spec §21, §26).
 */
export function resolveWaterActivity(
  input: WaterActivityInput,
  chain: readonly WaterActivityModel[] = DEFAULT_AW_MODEL_CHAIN,
): ResolvedWaterActivity {
  const attempts: WaterActivityResult[] = [];

  for (const model of chain) {
    const result = model.calculate(input);
    attempts.push(result);
    if (result.available && result.value !== null) {
      return { result, classification: classifyWaterActivity(result.value), attempts };
    }
  }

  const fallback: WaterActivityResult = attempts[0] ?? {
    available: false,
    value: null,
    source: 'none',
    modelId: 'none',
    modelLabel: 'Нет модели',
    reason: 'Ни одна модель активности воды не подключена.',
  };

  return {
    result: {
      ...fallback,
      available: false,
      value: null,
      source: 'none',
      reason:
        'Активность воды не определена: измеренное значение не введено, а валидированная расчётная модель не подключена.',
    },
    classification: null,
    attempts,
  };
}

/** Label for the "Источник a_w" field (spec §27). */
export function waterActivitySourceLabel(result: WaterActivityResult): string {
  switch (result.source) {
    case 'measured':
      return 'Измеренное значение';
    case 'reference':
      return 'Справочное измерение';
    case 'model':
      return 'Расчётная модель';
    default:
      return 'Нет данных';
  }
}
