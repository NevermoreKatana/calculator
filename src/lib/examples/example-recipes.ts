/**
 * Worked example recipes.
 *
 * Each example exists to make ONE thing visible that is otherwise abstract:
 * that sugar species matter more than sugar mass, that a classic ganache is not
 * shelf-stable, that crystalline sugar stops lowering a_w, that a preservative
 * is inert at ganache pH. The `caption` says what you will see; `lookAt` says
 * where to look.
 *
 * ── Why the captions can be trusted ───────────────────────────────────────
 * Every example carries an `expected` envelope, and tests/example-recipes.test.ts
 * runs each one through the real engine and asserts the result lands inside it.
 * So a caption cannot quietly become false when a constant changes — the test
 * fails first. The numbers quoted in captions were produced by the engine, not
 * estimated by hand.
 *
 * ── Ingredients are referenced BY NAME ────────────────────────────────────
 * Ingredient ids are database-generated cuids and differ between installs, so
 * an example stores names and resolves them at load time. A missing ingredient
 * is reported rather than silently dropped, because a partially-loaded example
 * would demonstrate the wrong thing.
 */

import type { Ingredient } from '../calculator/types';

export interface ExampleRecipeItem {
  /** Exact `name` in the ingredient database. */
  ingredientName: string;
  weightGrams: number;
}

export interface ExampleConditions {
  storageTemperatureC?: number;
  measuredPH?: number;
  packagingSealed?: boolean;
  chocolateShell?: boolean;
  thermalTreatment?: boolean;
  hasPreservative?: boolean;
}

/** Where to look in the app, and what the example puts there. */
export interface ExampleObservation {
  page: 'stability' | 'calculator' | 'composition' | 'shelf-life';
  what: string;
}

export interface ExampleRecipe {
  id: string;
  name: string;
  /** One line: what this example lets you see. */
  caption: string;
  /** The point being demonstrated, in full. */
  demonstrates: string[];
  observations: ExampleObservation[];
  items: ExampleRecipeItem[];
  conditions?: ExampleConditions;
  /** Examples meant to be opened one after another and compared. */
  compareWith?: string[];
  /**
   * Envelope the engine must land in for the caption to be true.
   * Enforced by tests, not decorative.
   */
  expected: {
    waterActivityMin: number;
    waterActivityMax: number;
    /** Warning codes that MUST fire. */
    warningCodes?: string[];
    /** Warning codes that must NOT fire. */
    absentWarningCodes?: string[];
  };
}

const PAGE_LABELS: Record<ExampleObservation['page'], string> = {
  stability: 'Стабильность',
  calculator: 'Калькулятор',
  composition: 'Состав',
  'shelf-life': 'Срок годности',
};

export function observationPageLabel(page: ExampleObservation['page']): string {
  return PAGE_LABELS[page];
}

export const EXAMPLE_RECIPES: readonly ExampleRecipe[] = [
  // ══════════════════════════════════════════════════════════════════════
  // The baseline everything else is measured against
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dark-classic-2-1',
    name: 'Тёмный ганаш 2:1 — классика',
    caption:
      'Каноническое соотношение шоколад : сливки = 2 : 1. a_w ≈ 0.91 — выше порога безопасности FDA. Классический ганаш не является продуктом длительного хранения при комнатной температуре.',
    demonstrates: [
      'Традиционная пропорция даёт a_w около 0.91, то есть зону, где возможен рост патогенных бактерий, а не только порчи.',
      'Обзор по ганашу связывает a_w выше 0.85 со сроком годности менее двух недель для незащищённых образцов.',
      'Это не ошибка рецептуры — это причина, по которой свежий сливочный ганаш хранят в холоде и едят быстро.',
    ],
    observations: [
      { page: 'stability', what: 'a_w около 0.91 и красное предупреждение «Возможен рост патогенов»' },
      { page: 'stability', what: 'Барьер по активности воды помечен как отсутствующий' },
      { page: 'stability', what: 'В таблице водной фазы почти вся масса сахаров — сахароза из шоколада' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 250 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true, thermalTreatment: true },
    compareWith: ['stable-target-aw', 'cream-heavy-unstable'],
    expected: { waterActivityMin: 0.895, waterActivityMax: 0.92, absentWarningCodes: ['sucrose_supersaturated'] },
  },

  // ══════════════════════════════════════════════════════════════════════
  // The controlled experiment: same mass, different species (spec §11)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'sugar-species-de40',
    name: 'Сравнение сахаров ① — сироп глюкозы DE 40',
    caption:
      'К базовому ганашу добавлено 60 г сиропа DE 40. Держите в уме a_w ≈ 0.905 и откройте следующие два примера: масса сахаров и воды у них та же, отличается только ВИД сахара.',
    demonstrates: [
      'Сироп DE 40 — самый слабый понизитель a_w из трёх: его среднечисловая молярная масса около 450 г/моль, то есть частиц на грамм меньше, чем у сахарозы.',
      'Отраслевое утверждение «глюкозный сироп связывает воду» для низких DE неверно. Его настоящая роль — препятствовать кристаллизации и давать тело.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.905 — почти как у базового рецепта без добавки' },
      { page: 'stability', what: 'Строка «Сухие вещества глюкозного сиропа»: M ≈ 450 г/моль' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 250 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
      { ingredientName: 'sugar glucose 40DE', weightGrams: 60 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true },
    compareWith: ['sugar-species-de60', 'sugar-species-invert'],
    expected: { waterActivityMin: 0.895, waterActivityMax: 0.915 },
  },
  {
    id: 'sugar-species-de60',
    name: 'Сравнение сахаров ② — сироп глюкозы DE 60',
    caption:
      'То же самое, но сироп DE 60. a_w ≈ 0.900. Выше DE — короче цепи — больше частиц на грамм — сильнее понижение a_w. Разница видна при абсолютно одинаковой массе.',
    demonstrates: [
      'DE 60 даёт молярную массу около 300 г/моль против 450 у DE 40, то есть в полтора раза больше частиц на грамм.',
      'Соотношение M_n = 18015.6 / DE выводится из определения декстрозного эквивалента, а не подбирается.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.900 против 0.905 у DE 40 при той же массе' },
      { page: 'stability', what: 'Строка сиропа: M ≈ 300 г/моль вместо 450' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 250 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
      { ingredientName: 'sugar glucose 60DE', weightGrams: 60 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true },
    compareWith: ['sugar-species-de40', 'sugar-species-invert'],
    expected: { waterActivityMin: 0.89, waterActivityMax: 0.91 },
  },
  {
    id: 'sugar-species-invert',
    name: 'Сравнение сахаров ③ — инвертный сахар',
    caption:
      'Те же 60 г, но инвертный сахар. a_w ≈ 0.891 — на 0.014 ниже, чем с сиропом DE 40. Вот цена вопроса «какой сахар», при нулевой разнице в массе.',
    demonstrates: [
      'Инвертный сахар — глюкоза и фруктоза, по 180 г/моль. На грамм это в 1.9 раза больше частиц, чем у сахарозы, и в 2.5 раза больше, чем у сиропа DE 40.',
      'Именно поэтому кондитерская практика «добавьте инвертного сахара для сохранности» работает. Это стехиометрия, а не свойство «удерживать влагу».',
      'Разброс 0.891–0.905 получен при одинаковых 60 г добавки и одинаковой воде. Единственная переменная — вид сахара.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.891 — самое низкое значение из трёх примеров' },
      { page: 'stability', what: 'В водной фазе появляются отдельные строки глюкозы и фруктозы, по 180.2 г/моль' },
      { page: 'stability', what: 'Блок «Состав сахаров по видам»: инвертный сахар определён по названию ингредиента' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 250 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
      { ingredientName: 'sugar inverted', weightGrams: 60 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true },
    compareWith: ['sugar-species-de40', 'sugar-species-de60'],
    expected: { waterActivityMin: 0.88, waterActivityMax: 0.9 },
  },

  // ══════════════════════════════════════════════════════════════════════
  // What a shelf-stable formulation actually looks like
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'stable-target-aw',
    name: 'Стабильный ганаш — попадание в 0.70–0.78',
    caption:
      'Меньше сливок, плюс инвертный сахар, сироп DE 60 и сорбит. a_w ≈ 0.767 — внутри отраслевого целевого диапазона для длительного хранения. Заодно видно честное предупреждение о полиолах.',
    demonstrates: [
      'Целевой диапазон 0.70–0.78 достигается не «меньше воды», а комбинацией: понижение воды плюс переход на сахара с низкой молярной массой.',
      'Водная фаза выходит на 77.6 % растворённых сухих веществ — заметно выше порога 65 °Brix из обзора по ганашу.',
      'Приложение при этом ПОНИЖАЕТ уверенность и предупреждает: выше 60 % концентрации константы Норриша для сорбита теряют точность (Baeza et al. 2010). Реальная a_w, вероятно, ещё ниже расчётной.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.767 и зелёный статус барьера по активности воды' },
      { page: 'stability', what: 'Предупреждение о полиолах выше 60 % и уверенность «Низкая» — модель не скрывает, что вышла за проверенный диапазон' },
      { page: 'stability', what: 'Патогены заблокированы, но осмофильные дрожжи и ксерофильные плесени — нет' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 120 },
      { ingredientName: 'sugar inverted', weightGrams: 60 },
      { ingredientName: 'sugar glucose 60DE', weightGrams: 50 },
      { ingredientName: 'sugar sorbitol', weightGrams: 40 },
      { ingredientName: 'butter fresh', weightGrams: 40 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true, thermalTreatment: true },
    compareWith: ['dark-classic-2-1'],
    expected: { waterActivityMin: 0.74, waterActivityMax: 0.79 },
  },

  // ══════════════════════════════════════════════════════════════════════
  // Failure modes
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'cream-heavy-unstable',
    name: 'Сливочный ганаш — что бывает при избытке сливок',
    caption:
      'Пропорция перевёрнута: сливок больше, чем шоколада. a_w ≈ 0.97 — растёт практически всё, включая Salmonella и Listeria. Пример того, как выглядит рецептура вне зоны стабильности.',
    demonstrates: [
      'Водная фаза разбавляется до 34 % растворённых сухих веществ — осмотического барьера нет вовсе.',
      'При a_w 0.97 сняты ограничения по всем организмам из базы, а не только по дрожжам и плесеням.',
      'Такой продукт возможен, но это охлаждённое изделие с коротким сроком, а не конфета для полки.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.97 и полный список организмов без барьеров' },
      { page: 'stability', what: 'Концентрация водной фазы около 34 % — барьер отсутствует' },
      { page: 'stability', what: 'Сравните список «Заблокированные организмы»: он пуст' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 300 },
      { ingredientName: 'cream 35%', weightGrams: 400 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
    ],
    conditions: { storageTemperatureC: 4, packagingSealed: true, thermalTreatment: true },
    compareWith: ['dark-classic-2-1', 'stable-target-aw'],
    expected: { waterActivityMin: 0.955, waterActivityMax: 0.985 },
  },
  {
    id: 'oversugared-crystallising',
    name: 'Пересахаренный ганаш — засахаривание',
    caption:
      'Много шоколада, мало сливок. Сахарозы 308 г при пределе растворимости около 204 г: треть сахара кристаллическая. Она НЕ понижает a_w и даёт песчанистость.',
    demonstrates: [
      'Кристаллический сахар на активность воды не влияет — понижает её только растворённый. Композиционный расчёт без учёта растворимости здесь дал бы заметно заниженный результат.',
      'Модель отсекает избыток, исключает его из мольного баланса и прямо предупреждает о риске засахаривания.',
      'Это самая распространённая скрытая ошибка расчёта a_w в кондитерских системах.',
    ],
    observations: [
      { page: 'stability', what: 'Оранжевое предупреждение «Сахароза превышает растворимость при 20 °C»' },
      { page: 'stability', what: 'В строке «Сахароза» рядом с растворённой массой указано «+103.7 г не раств.»' },
      { page: 'stability', what: 'Концентрация водной фазы упирается в 67.1 % — предел растворимости сахарозы при 20 °C' },
    ],
    items: [
      { ingredientName: 'callebaut 811', weightGrams: 700 },
      { ingredientName: 'cream 35%', weightGrams: 150 },
      { ingredientName: 'butter fresh', weightGrams: 40 },
    ],
    conditions: { storageTemperatureC: 20, chocolateShell: true, packagingSealed: true },
    expected: {
      waterActivityMin: 0.83,
      waterActivityMax: 0.87,
      warningCodes: ['sucrose_supersaturated'],
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // pH, preservatives and the fruit case
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'fruit-filling-acid',
    name: 'Фруктовая начинка — где консервант работает',
    caption:
      'Малиновое пюре, pH 3.6. a_w ≈ 0.92 — высокая, но сорбат при таком pH недиссоциирован на 94 % и действительно работает. Сравните с ганашем, где он бесполезен.',
    demonstrates: [
      'Барьерная технология в действии: слабая a_w компенсируется кислотностью и консервантом.',
      'При pH 3.6 доля активной (недиссоциированной) сорбиновой кислоты около 94 % — это расчёт по Гендерсону–Хассельбальху, а не оценка.',
      'ОДНАКО: на Zygosaccharomyces rouxii, главный организм порчи сладких начинок, pH в диапазоне 2.5–4.0 практически не действует. Кислотность защищает от бактерий, но не от осмофильных дрожжей.',
    ],
    observations: [
      { page: 'stability', what: 'Барьер «Консерванты» — зелёный, с указанием доли активной формы' },
      { page: 'stability', what: 'Барьер «Кислотность» — зелёный, но с оговоркой про Z. rouxii' },
      { page: 'stability', what: 'Профиль сахаров пюре определён по названию с достоверностью 50 % — соотношение глюкоза/фруктоза/сахароза сильно зависит от плода' },
    ],
    items: [
      { ingredientName: 'fruit purée малина', weightGrams: 300 },
      { ingredientName: 'sugar inverted', weightGrams: 100 },
      { ingredientName: 'sugar glucose 60DE', weightGrams: 80 },
      { ingredientName: 'Valrhona Ivoire', weightGrams: 200 },
    ],
    conditions: {
      storageTemperatureC: 12,
      measuredPH: 3.6,
      hasPreservative: true,
      chocolateShell: true,
      packagingSealed: true,
    },
    compareWith: ['dark-classic-2-1'],
    expected: { waterActivityMin: 0.905, waterActivityMax: 0.94 },
  },

  // ══════════════════════════════════════════════════════════════════════
  // Variants worth having on hand
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'milk-chocolate-ganache',
    name: 'Молочный ганаш',
    caption:
      'Молочный шоколад плюс инвертный сахар. a_w ≈ 0.887. Видно, как молочные сухие вещества уходят в нерастворимую часть, а не в водную фазу.',
    demonstrates: [
      'Молочные сухие обезжиренные примерно наполовину состоят из лактозы, но по умолчанию она НЕ добавляется в мольный баланс: из исходной базы не следует однозначно, учтена ли она уже в колонке «сахара». Задвоение хуже недоучёта.',
      'Решение задокументировано и переключается одним параметром, когда состав базы будет уточнён.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.887, чуть ниже классического тёмного за счёт инвертного сахара' },
      { page: 'stability', what: 'Лактоза в водной фазе только из сливок — доля молочных сухих в мольный баланс не входит' },
    ],
    items: [
      { ingredientName: 'callebaut 823', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 220 },
      { ingredientName: 'sugar inverted', weightGrams: 40 },
      { ingredientName: 'butter fresh', weightGrams: 50 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true, thermalTreatment: true },
    expected: { waterActivityMin: 0.875, waterActivityMax: 0.9 },
  },
  {
    id: 'white-chocolate-sorbitol',
    name: 'Белый ганаш с сорбитом',
    caption:
      'Белый шоколад, мало сливок, сорбит как влагоудерживающий агент. a_w ≈ 0.850 — ровно на регуляторном пороге FDA. Пограничный случай, который стоит увидеть.',
    demonstrates: [
      'a_w 0.850 — это в точности порог, ниже которого FDA считает продукт не требующим холода по соображениям БЕЗОПАСНОСТИ.',
      'Порча при этом никуда не девается: осмофильные дрожжи растут от 0.60, ксерофильные плесени от 0.61. Безопасно ≠ не испортится.',
      'Сорбит вдвое менее сладок сахарозы, но понижает a_w сильнее на грамм — поэтому его используют, когда нужна сохранность без роста сладости.',
    ],
    observations: [
      { page: 'stability', what: 'a_w ≈ 0.850 — граница; посмотрите, как классифицируется S. aureus' },
      { page: 'stability', what: 'Патогены на грани, а организмы порчи по-прежнему без барьеров' },
      { page: 'stability', what: 'Предупреждение о полиолах: сорбит выше проверенного диапазона концентраций' },
    ],
    items: [
      { ingredientName: 'Valrhona Ivoire', weightGrams: 500 },
      { ingredientName: 'cream 35%', weightGrams: 180 },
      { ingredientName: 'sugar sorbitol', weightGrams: 30 },
      { ingredientName: 'butter fresh', weightGrams: 40 },
    ],
    conditions: { storageTemperatureC: 18, chocolateShell: true, packagingSealed: true },
    expected: { waterActivityMin: 0.835, waterActivityMax: 0.865 },
  },
] as const;

export function getExampleRecipe(id: string): ExampleRecipe | null {
  return EXAMPLE_RECIPES.find((r) => r.id === id) ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Resolution against the installed ingredient database
// ──────────────────────────────────────────────────────────────────────────

export interface ResolvedExample {
  example: ExampleRecipe;
  items: { ingredient: Ingredient; weightGrams: number }[];
  /** Names the installed database does not contain. */
  missingIngredientNames: string[];
  /** True only when every line resolved — a partial example misleads. */
  complete: boolean;
}

/**
 * Resolves an example against the loaded catalogue.
 *
 * Matching is case-insensitive and whitespace-trimmed, because the imported
 * names come from a spreadsheet and carry inconsistent casing.
 */
export function resolveExample(
  example: ExampleRecipe,
  ingredients: readonly Ingredient[],
): ResolvedExample {
  const index = new Map(ingredients.map((i) => [i.name.trim().toLowerCase(), i]));

  const items: ResolvedExample['items'] = [];
  const missingIngredientNames: string[] = [];

  for (const item of example.items) {
    const found = index.get(item.ingredientName.trim().toLowerCase());
    if (found) items.push({ ingredient: found, weightGrams: item.weightGrams });
    else missingIngredientNames.push(item.ingredientName);
  }

  return {
    example,
    items,
    missingIngredientNames,
    complete: missingIngredientNames.length === 0,
  };
}

export function resolveAllExamples(ingredients: readonly Ingredient[]): ResolvedExample[] {
  return EXAMPLE_RECIPES.map((e) => resolveExample(e, ingredients));
}
