/**
 * "What can actually be calculated" table (spec §47, §32).
 *
 * This is the honest inventory the whole project is judged by. For every
 * parameter it records whether it can be computed from the recipe, whether it
 * needs a laboratory measurement, whether it needs experimental calibration,
 * how much the answer can be trusted, and by what method.
 *
 * The table is DATA, rendered by the UI. It is not a document that can drift
 * out of sync with the code, because the same ids drive the calculation.
 */

import type { ConfidenceLevel, ParameterKind } from './confidence';

export interface ParameterCapability {
  id: string;
  parameter: string;
  /** Can it be derived from the recipe alone? */
  fromRecipe: boolean;
  /** Does a trustworthy answer require an instrument? */
  requiresMeasurement: boolean;
  /** Does it require fitting coefficients to experimental data? */
  requiresCalibration: boolean;
  kind: ParameterKind;
  confidence: ConfidenceLevel;
  /** The method actually used, or the reason there is none. */
  recommendedMethod: string;
  formulaId: string | null;
  note?: string;
}

export const PARAMETER_CAPABILITIES: readonly ParameterCapability[] = [
  // ── Category 1: exact from the recipe ──────────────────────────────────
  {
    id: 'total_weight',
    parameter: 'Общая масса',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'exact_from_recipe',
    confidence: 'high',
    recommendedMethod: 'Сумма масс ингредиентов.',
    formulaId: null,
  },
  {
    id: 'water_percent',
    parameter: 'Вода, %',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'exact_from_recipe',
    confidence: 'high',
    recommendedMethod: 'Массовый баланс по колонке воды базы ингредиентов.',
    formulaId: null,
    note: 'Точность ограничена качеством данных состава ингредиентов, а не арифметикой.',
  },
  {
    id: 'sugar_percent',
    parameter: 'Сахара, %',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'exact_from_recipe',
    confidence: 'high',
    recommendedMethod: 'Массовый баланс по колонке сахаров.',
    formulaId: null,
  },
  {
    id: 'sugar_speciation',
    parameter: 'Состав сахаров по видам',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod:
      'Разложение суммарных сахаров по видам через профиль ингредиента (по названию, категории или явному указанию пользователя).',
    formulaId: null,
    note:
      'Уверенность средняя, а не высокая: исходная база хранит одну суммарную колонку сахаров, и разложение опирается на знание об ингредиенте, а не на его измеренный состав.',
  },
  {
    id: 'dry_matter',
    parameter: 'Сухие вещества, %',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'exact_from_recipe',
    confidence: 'high',
    recommendedMethod: 'Общая масса минус вода.',
    formulaId: null,
    note:
      'Расчётная сухая масса может расходиться с измеренной по ГОСТ 5900-2014: высушивание удаляет не только воду, но и часть летучих веществ.',
  },
  {
    id: 'fat_percent',
    parameter: 'Жир, %',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'exact_from_recipe',
    confidence: 'high',
    recommendedMethod: 'Сумма прочих жиров и масла какао.',
    formulaId: null,
  },
  {
    id: 'water_phase_solids',
    parameter: 'Растворённые сухие вещества водной фазы, %',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod:
      'Растворённые вещества / (вода + растворённые вещества) с учётом пределов растворимости сахарозы и лактозы.',
    formulaId: null,
    note:
      'Приближается рефрактометрическим °Brix, но не тождественно ему: °Brix определён для чистого раствора сахарозы.',
  },

  // ── Category 2: scientific model ───────────────────────────────────────
  {
    id: 'water_activity_calculated',
    parameter: 'Активность воды (расчётная)',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod:
      'Мультисолютное уравнение Норриша по водной фазе, с перекрёстной проверкой уравнениями Росса и Рауля.',
    formulaId: 'norrish-multi-solute',
    note:
      'Наша реализация воспроизводит опубликованную таблицу для растворов сахарозы с отклонением ≤0.0085. Для реального ганаша неопределённость выше из-за связывания воды белками и какао-частицами, которое модель не описывает.',
  },
  {
    id: 'erh',
    parameter: 'Равновесная относительная влажность (ERH)',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod: 'ERH = a_w × 100; наследует неопределённость a_w.',
    formulaId: 'aw-erh',
  },
  {
    id: 'microbial_risk',
    parameter: 'Микробиологический риск',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod:
      'Сопоставление a_w, pH и температуры с опубликованными пределами роста организмов.',
    formulaId: null,
    note:
      'Отвечает на вопрос «что МОЖЕТ расти», а не «что вырастет» и не «как быстро». Пересечённый порог означает отсутствие барьера, а не неизбежную порчу.',
  },
  {
    id: 'preservative_active_fraction',
    parameter: 'Активная доля консерванта',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'high',
    recommendedMethod: 'Гендерсон–Хассельбальх по измеренному pH.',
    formulaId: 'henderson-hasselbalch-preservative',
    note: 'Формула точная, но требует ИЗМЕРЕННОГО pH: без него доля неизвестна.',
  },
  {
    id: 'crystallisation_risk',
    parameter: 'Риск кристаллизации сахарозы',
    fromRecipe: true,
    requiresMeasurement: false,
    requiresCalibration: false,
    kind: 'scientific_model',
    confidence: 'medium',
    recommendedMethod: 'Сравнение сахарозы водной фазы с её растворимостью при заданной температуре.',
    formulaId: null,
    note: 'Указывает на пересыщение. Реальная кристаллизация зависит также от зародышей и механического воздействия.',
  },

  // ── Category 3: requires measurement ───────────────────────────────────
  {
    id: 'water_activity_measured',
    parameter: 'Активность воды (измеренная)',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'requires_measurement',
    confidence: 'high',
    recommendedMethod: 'Измеритель активности воды (например, Rotronic HygroPalm, AquaLab).',
    formulaId: null,
    note: 'Всегда имеет приоритет над расчётом. Измеренное значение — единственный способ снять неопределённость модели.',
  },
  {
    id: 'ph_measured',
    parameter: 'pH',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'requires_measurement',
    confidence: 'high',
    recommendedMethod: 'pH-метр в водной фазе продукта.',
    formulaId: null,
    note:
      'Рассчитать pH из рецептуры в общем случае НЕЛЬЗЯ: он определяется буферной ёмкостью белков молока, органическими кислотами фруктов и щелочностью алкализованного какао, которые взаимодействуют нелинейно.',
  },
  {
    id: 'moisture_measured',
    parameter: 'Влажность (измеренная)',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'requires_measurement',
    confidence: 'high',
    recommendedMethod: 'ГОСТ 5900-2014 — высушивание до постоянной массы.',
    formulaId: null,
  },
  {
    id: 'brix_measured',
    parameter: '°Brix (измеренный)',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'requires_measurement',
    confidence: 'high',
    recommendedMethod: 'Рефрактометр по водной фазе.',
    formulaId: null,
    note: 'В присутствии жира и какао-частиц рефрактометрия по продукту целиком не даёт корректного результата.',
  },
  {
    id: 'microbiology_result',
    parameter: 'Микробиологические показатели',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: false,
    kind: 'requires_measurement',
    confidence: 'high',
    recommendedMethod: 'Лабораторный посев по срокам хранения.',
    formulaId: null,
    note: 'Единственный способ подтвердить срок годности. Расчёт его не заменяет.',
  },

  // ── Category 4: requires calibration ───────────────────────────────────
  {
    id: 'shelf_life_theoretical',
    parameter: 'Теоретический срок годности',
    fromRecipe: true,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'low',
    recommendedMethod:
      'Только интерполяция между эмпирическими контрольными точками, внутри наблюдённого диапазона. Общей формулы не существует.',
    formulaId: 'shelf-life-water-sugar',
    note:
      'Рецензируемый обзор по ганашу (2024) не приводит ни одной модели прогнозирования срока. Любое число здесь — экстраполяция чужого опыта на вашу рецептуру.',
  },
  {
    id: 'shelf_life_validated',
    parameter: 'Подтверждённый срок годности',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'none',
    recommendedMethod:
      'Реальные испытания хранения с микробиологическим и органолептическим контролем. Расчётом не определяется в принципе.',
    formulaId: null,
    note: 'Spec §50: теоретическая стабильность и подтверждённый срок годности — разные вещи и никогда не подменяют друг друга.',
  },
  {
    id: 'activation_energy',
    parameter: 'Энергия активации E_a',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'none',
    recommendedMethod: 'Ускоренные испытания минимум при трёх температурах.',
    formulaId: 'arrhenius',
    note: 'Для ганаша не опубликована. Использование чужого значения дало бы произвольный результат.',
  },
  {
    id: 'q10',
    parameter: 'Коэффициент Q10',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'none',
    recommendedMethod: 'Испытания минимум при двух температурах.',
    formulaId: 'q10',
    note:
      'Для пищевых продуктов обычно 2–3, но подстановка произвольного значения из этого диапазона меняет расчётный срок в полтора раза.',
  },
  {
    id: 'moisture_migration',
    parameter: 'Миграция влаги через оболочку',
    fromRecipe: false,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'none',
    recommendedMethod:
      'Требует коэффициента диффузии воды через конкретный шоколад, толщины оболочки и градиента a_w между начинкой и оболочкой.',
    formulaId: null,
    note:
      'Качественно направление известно: влага идёт от высокой a_w к низкой. Количественно — коэффициенты диффузии для конкретного шоколада измеряются, а не берутся из литературы.',
  },
  {
    id: 'glass_transition',
    parameter: 'Температура стеклования T_g',
    fromRecipe: true,
    requiresMeasurement: true,
    requiresCalibration: true,
    kind: 'requires_calibration',
    confidence: 'none',
    recommendedMethod: 'ДСК (дифференциальная сканирующая калориметрия).',
    formulaId: 'gordon-taylor',
    note:
      'Для ганаша при обычном хранении не лимитирует: при 17–20 % воды T_g водной фазы лежит глубоко ниже температуры хранения, система заведомо в резиноподобном состоянии.',
  },
];

export function capabilitiesByKind(kind: ParameterKind): ParameterCapability[] {
  return PARAMETER_CAPABILITIES.filter((c) => c.kind === kind);
}
