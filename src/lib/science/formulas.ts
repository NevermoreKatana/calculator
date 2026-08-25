/**
 * Scientific formula registry (spec §34).
 *
 * Every equation the engine can apply is described here, INCLUDING the ones
 * that were evaluated and rejected. Keeping the rejects is deliberate: spec §37
 * requires the app to explain why a known model is not used, and spec §48
 * requires unsupported models to be labelled rather than deleted and forgotten.
 *
 * `implementationStatus` distinguishes "we implement this" from "we researched
 * this". A formula can be scientifically excellent and still be `not_applicable`
 * for ganache.
 */

import type { EvidenceStatus } from './confidence';

export type ImplementationStatus =
  | 'implemented'
  | 'implemented_as_crosscheck'
  | 'available_needs_data'
  | 'researched_not_applicable'
  | 'planned';

export const IMPLEMENTATION_STATUS_LABELS: Record<ImplementationStatus, string> = {
  implemented: 'Реализована и используется',
  implemented_as_crosscheck: 'Реализована как перекрёстная проверка',
  available_needs_data: 'Реализуема, но не хватает входных данных',
  researched_not_applicable: 'Изучена, для этого класса продуктов не применима',
  planned: 'Запланирована',
};

export interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit: string;
}

export interface ScientificFormula {
  id: string;
  name: string;
  nameRu: string;
  /** The equation, written in the sign convention this project uses. */
  equation: string;
  variables: FormulaVariable[];
  sourceIds: string[];

  /** The food domain the formula was created for. */
  domain: string;
  /** What it is legitimate to use it for here. */
  applicability: string;
  /** Applicability specifically to ganache — spec §37 demands this column. */
  ganacheApplicability: string;
  assumptions: string[];
  limitations: string[];
  /** Documented validity ranges: moisture, temperature, concentration. */
  validityRange: string;
  /** Accuracy as reported by the source, or as measured by our own validation. */
  accuracy: string;

  status: EvidenceStatus;
  implementationStatus: ImplementationStatus;
  /** Where in the codebase it lives, when implemented. */
  implementationPath?: string;
}

export const SCIENTIFIC_FORMULAS: readonly ScientificFormula[] = [
  // ══════════════════════════════════════════════════════════════════════
  // Water activity — implemented
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'norrish-multi-solute',
    name: 'Norrish equation, multi-solute form',
    nameRu: 'Уравнение Норриша, мультисолютная форма',
    equation: 'a_w = X_w · exp(−Σ_i K_i · X_i²)',
    variables: [
      { symbol: 'a_w', meaning: 'активность воды', unit: 'безразмерная, 0–1' },
      { symbol: 'X_w', meaning: 'мольная доля воды в водной фазе', unit: 'безразмерная' },
      { symbol: 'X_i', meaning: 'мольная доля растворённого вещества i', unit: 'безразмерная' },
      { symbol: 'K_i', meaning: 'константа Норриша вещества i', unit: 'безразмерная' },
    ],
    sourceIds: ['norrish-1966', 'fao-y4358e-ch4', 'baeza-2010-norrish', 'chirife-1980-1982'],
    domain:
      'Кондитерские сиропы (именно для них Норриш вывел уравнение в 1966 г.), продукты промежуточной влажности, фруктово-сахарные системы.',
    applicability:
      'Расчёт a_w водной фазы по составу растворённых неэлектролитов, когда известны их массы и молярные массы.',
    ganacheApplicability:
      'ПРИМЕНИМА к водной фазе ганаша, и это лучший из доступных вариантов: происхождение уравнения — кондитерские сиропы, а водная фаза ганаша является именно концентрированным сахарным сиропом. НЕ применима к продукту целиком: жир и какао-частицы нужно исключить из мольного баланса.',
    assumptions: [
      'Растворённые вещества взаимодействуют с водой, но не друг с другом (аддитивность членов K_i·X_i²).',
      'Все учтённые сахара действительно растворены (проверяется отдельно через растворимость).',
      'Вода целиком доступна как растворитель; вода, связанная белками и полисахаридами, не выделяется.',
      'Электролиты отсутствуют или незначительны.',
    ],
    limitations: [
      '«Общепринятые» константы K получены преимущественно по данным при a_w > 0.85 (Baeza et al. 2010).',
      'Для сорбита и глицерина выше ≈60 % масс. константы теряют точность.',
      'Не описывает связывание воды белками молока и какао-частицами.',
      'Не учитывает температуру: K приведены для 20–25 °C.',
    ],
    validityRange:
      'Водная фаза до ≈90 % растворённых сухих веществ для сахарозы; для полиолов надёжно до ≈60 %. Температура 20–25 °C.',
    accuracy:
      'Наша реализация воспроизводит опубликованную таблицу a_w растворов сахарозы (BCCDC 1997) с максимальным отклонением 0.0085 в диапазоне 0–67 % масс. Baeza et al. сообщают для сахарозы CV = 0.75 % до 90 %.',
    status: 'validated',
    implementationStatus: 'implemented',
    implementationPath: 'src/lib/science/water-activity/equations.ts → norrishMultiSoluteWaterActivity',
  },
  {
    id: 'ross-multiplicative',
    name: 'Ross equation',
    nameRu: 'Уравнение Росса',
    equation: 'a_w = Π_i a_w,i,  где a_w,i — активность воды вещества i в одиночку во всей воде',
    variables: [
      { symbol: 'a_w', meaning: 'активность воды смеси', unit: 'безразмерная' },
      { symbol: 'a_w,i', meaning: 'активность воды бинарного раствора вещества i', unit: 'безразмерная' },
    ],
    sourceIds: ['ross-1975', 'fao-y4358e-ch4'],
    domain: 'Продукты промежуточной влажности со смесью растворённых веществ.',
    applicability: 'Быстрая оценка a_w многокомпонентной системы без данных о взаимодействии.',
    ganacheApplicability:
      'Применима как ВТОРОЕ МНЕНИЕ. Точность ±0.01 подтверждена для разбавленных и умеренных смесей; водная фаза ганаша концентрирована, поэтому Росс здесь систематически занижает a_w. Расхождение с Норришем используется как индикатор неопределённости, а не как ответ.',
    assumptions: ['Растворённые вещества не взаимодействуют между собой.'],
    limitations: [
      'Для концентрированных смесей систематически завышает понижение a_w.',
      'Caurie (1985) опубликовал скорректированную форму именно из-за этого.',
    ],
    validityRange: 'Разбавленные и умеренные растворы; для концентрированных — только как оценка.',
    accuracy:
      '±0.01 для 118 из 120 смесей в исходной валидации Росса. В нашей реализации расхождение с Норришем на реальных ганашах составляет 0.000–0.011.',
    status: 'well_supported',
    implementationStatus: 'implemented_as_crosscheck',
    implementationPath: 'src/lib/science/water-activity/equations.ts → rossWaterActivity',
  },
  {
    id: 'raoult-ideal',
    name: "Raoult's law (ideal solution)",
    nameRu: 'Закон Рауля (идеальный раствор)',
    equation: 'a_w = X_w = n_w / (n_w + Σ n_s)',
    variables: [
      { symbol: 'n_w', meaning: 'моли воды', unit: 'моль' },
      { symbol: 'n_s', meaning: 'моли растворённого вещества', unit: 'моль' },
    ],
    sourceIds: ['genie-alimentaire-aw', 'sereno-2001-aw-review'],
    domain: 'Идеальные разбавленные растворы.',
    applicability: 'Базовая линия, относительно которой видна величина неидеальности.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМА как ответ. Для концентрированной водной фазы ганаша Рауль систематически ЗАВЫШАЕТ a_w, потому что игнорирует взаимодействие сахар–вода. Показывается рядом с Норришем, чтобы разница была видна пользователю.',
    assumptions: ['Раствор идеален; коэффициент активности воды равен 1.'],
    limitations: ['Ошибка растёт с концентрацией; в кондитерских сиропах она велика.'],
    validityRange: 'Разбавленные растворы, a_w > 0.98.',
    accuracy: 'Для 67 % раствора сахарозы даёт ≈0.905 против измеренных ≈0.86 — ошибка около +0.045.',
    status: 'approximate',
    implementationStatus: 'implemented_as_crosscheck',
    implementationPath: 'src/lib/science/water-activity/equations.ts → raoultWaterActivity',
  },
  {
    id: 'de-to-molar-mass',
    name: 'Dextrose equivalent → number-average molar mass',
    nameRu: 'Декстрозный эквивалент → среднечисловая молярная масса',
    equation: 'M_n = 100 · M_glucose / DE = 18015.6 / DE',
    variables: [
      { symbol: 'M_n', meaning: 'среднечисловая молярная масса сухих веществ сиропа', unit: 'г/моль' },
      { symbol: 'DE', meaning: 'декстрозный эквивалент', unit: '% редуцирующих веществ на сухое вещество' },
    ],
    sourceIds: ['de-molecular-weight', 'money-born-1951'],
    domain: 'Крахмальные гидролизаты: глюкозные сиропы, мальтодекстрины.',
    applicability:
      'Приведение глюкозного сиропа к «псевдо-сахару» с определённой молярной массой, чтобы его можно было подставить в уравнение Норриша.',
    ganacheApplicability:
      'ПРИМЕНИМА и необходима: без неё глюкозный сироп невозможно включить в мольный баланс. Именно эту идею Money & Born (1951) назвали «эквивалентной молекулярной массой».',
    assumptions: [
      'Каждая полимерная цепь несёт ровно один редуцирующий конец.',
      'Среднечисловой массы достаточно, чтобы описать осмотическое поведение смеси.',
    ],
    limitations: [
      'M_n — среднее, а не распределение. Два сиропа с одинаковым DE, но разным распределением по DP, дадут одинаковый расчёт a_w и разное поведение при кристаллизации.',
      'Константа Норриша для сиропа не опубликована; принята константа глюкозы (консервативно).',
    ],
    validityRange: 'DE от 5 до 100.',
    accuracy: 'Соотношение точное по определению DE; неопределённость вносит выбор K.',
    status: 'well_supported',
    implementationStatus: 'implemented',
    implementationPath: 'src/lib/science/sugars.ts → molarMassOfSpecies',
  },
  {
    id: 'aw-erh',
    name: 'Water activity ↔ equilibrium relative humidity',
    nameRu: 'Активность воды ↔ равновесная относительная влажность',
    equation: 'ERH (%) = a_w × 100',
    variables: [
      { symbol: 'ERH', meaning: 'равновесная относительная влажность', unit: '%' },
      { symbol: 'a_w', meaning: 'активность воды', unit: 'безразмерная' },
    ],
    sourceIds: ['genie-alimentaire-aw', 'grover-1947', 'sereno-2001-aw-review'],
    domain: 'Все пищевые продукты.',
    applicability: 'Перевод между двумя способами выражать одну и ту же величину.',
    ganacheApplicability:
      'ПРИМЕНИМА, но с оговоркой, которую важно не потерять: равенство выполняется В РАВНОВЕСИИ продукта с непосредственно окружающим воздухом при одинаковой температуре. Оно НЕ означает, что влажность склада равна a_w продукта; их выравнивание — это и есть миграция влаги, которая продукт изменяет.',
    assumptions: ['Термодинамическое равновесие; равномерная температура.'],
    limitations: [
      'Неприменимо при градиенте температуры: холодная поверхность конденсирует влагу при той же a_w.',
      'Не описывает скорость достижения равновесия.',
    ],
    validityRange: 'Весь диапазон a_w в равновесии.',
    accuracy: 'Тождество по определению.',
    status: 'validated',
    implementationStatus: 'implemented',
    implementationPath: 'src/lib/science/water-activity/equations.ts → waterActivityToERH',
  },
  {
    id: 'henderson-hasselbalch-preservative',
    name: 'Undissociated weak-acid fraction (Henderson–Hasselbalch)',
    nameRu: 'Доля недиссоциированной кислоты (Гендерсон–Хассельбальх)',
    equation: 'f = 1 / (1 + 10^(pH − pKa))',
    variables: [
      { symbol: 'f', meaning: 'доля недиссоциированной кислоты', unit: 'безразмерная, 0–1' },
      { symbol: 'pH', meaning: 'pH продукта', unit: 'безразмерная' },
      { symbol: 'pKa', meaning: 'константа диссоциации кислоты', unit: 'безразмерная' },
    ],
    sourceIds: ['sorbic-acid-pka'],
    domain: 'Слабокислотные консерванты: сорбиновая, бензойная, пропионовая кислоты.',
    applicability:
      'Расчёт доли консерванта, находящейся в противомикробно активной форме, при заданном pH.',
    ganacheApplicability:
      'ПРИМЕНИМА, если pH ИЗМЕРЕН. Практический вывод для ганаша существенный: pH ганаша обычно 6–7, где сорбат недиссоциирован лишь на 1–5 %, то есть почти неактивен. Сорбат имеет смысл во фруктовых начинках (pH 3–4), а не в молочно-шоколадном ганаше.',
    assumptions: ['Консервант полностью растворён в водной фазе.'],
    limitations: [
      'Даёт активную ДОЛЮ, а не эффективность: минимальная подавляющая концентрация зависит от организма и матрицы.',
      'Разрешённые дозировки регулируются законодательством и в приложении не приводятся.',
    ],
    validityRange: 'pH 2–8.',
    accuracy: 'Точное термодинамическое соотношение для разбавленного водного раствора.',
    status: 'validated',
    implementationStatus: 'implemented',
    implementationPath: 'src/lib/science/water-activity/equations.ts → undissociatedFraction',
  },

  // ══════════════════════════════════════════════════════════════════════
  // Researched and NOT applied
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'gab-sorption',
    name: 'GAB (Guggenheim–Anderson–de Boer) sorption isotherm',
    nameRu: 'Изотерма сорбции GAB',
    equation: 'm = (m₀ · C · K · a_w) / [(1 − K·a_w)(1 − K·a_w + C·K·a_w)]',
    variables: [
      { symbol: 'm', meaning: 'равновесное влагосодержание', unit: 'г воды / г сухого вещества' },
      { symbol: 'm₀', meaning: 'влагосодержание монослоя', unit: 'г воды / г сухого вещества' },
      { symbol: 'C, K', meaning: 'энергетические константы модели', unit: 'безразмерные' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Сухие и полусухие продукты: порошки, сухари, крахмалы, сухофрукты. a_w 0.05–0.90.',
    applicability:
      'Связывает влагосодержание материала с a_w — но только для материала, чьи константы m₀, C, K ИЗМЕРЕНЫ.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМА к ганашу в текущем виде, и это принципиально, а не из осторожности. Изотермы сорбции описывают адсорбцию воды на СУХОЙ МАТРИЦЕ. Ганаш — не сухая матрица: это концентрированный раствор с диспергированным жиром, где вода является растворителем, а не адсорбатом. Кроме того m₀, C и K нельзя вычислить из рецепта — их определяют экспериментально для каждого материала. Модель остаётся релевантной для СУХИХ компонентов (какао-порошок, сухое молоко) и для миграции влаги через оболочку.',
    assumptions: ['Существует монослой адсорбированной воды.', 'Многослойная сорбция имеет свою энергию.'],
    limitations: [
      'Требует не менее трёх экспериментально подобранных констант на каждый материал.',
      'Обычно ограничена диапазоном a_w 0.05–0.90.',
    ],
    validityRange: 'a_w 0.05–0.90 для материалов с измеренными константами.',
    accuracy: 'Для подходящих материалов — очень высокая; для ганаша не определена.',
    status: 'not_recommended',
    implementationStatus: 'researched_not_applicable',
  },
  {
    id: 'bet-sorption',
    name: 'BET (Brunauer–Emmett–Teller) isotherm',
    nameRu: 'Изотерма сорбции BET',
    equation: 'm = (m₀ · C · a_w) / [(1 − a_w)(1 − a_w + C·a_w)]',
    variables: [
      { symbol: 'm₀', meaning: 'влагосодержание монослоя', unit: 'г воды / г сухого вещества' },
      { symbol: 'C', meaning: 'энергетическая константа', unit: 'безразмерная' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Сухие продукты, узкий диапазон a_w.',
    applicability: 'Определение монослоя — точки максимальной химической стабильности сухого продукта.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМА. Диапазон BET — a_w 0.05–0.45, что вдвое ниже любой реальной a_w ганаша (0.70–0.90).',
    assumptions: ['Однородная поверхность адсорбции.'],
    limitations: ['Диапазон a_w 0.05–0.45.'],
    validityRange: 'a_w 0.05–0.45.',
    accuracy: 'Неприменимо к данному классу продуктов.',
    status: 'not_recommended',
    implementationStatus: 'researched_not_applicable',
  },
  {
    id: 'henderson-oswin-halsey-smith',
    name: 'Henderson / Oswin / Halsey / Smith / Peleg isotherms',
    nameRu: 'Изотермы Хендерсона / Освина / Холси / Смита / Пелега',
    equation: 'Различные эмпирические двух- и трёхпараметрические формы',
    variables: [
      { symbol: '—', meaning: 'параметры подбираются под конкретный материал', unit: '—' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Зерно, сухофрукты, порошки.',
    applicability: 'Эмпирическое описание изотермы сорбции измеренного материала.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМЫ. Это чисто эмпирические подгонки без физического смысла параметров; без измеренной изотермы конкретного ганаша подставлять в них нечего. Использовать их «потому что они известны» — ровно та ошибка, которую запрещает ТЗ §10.',
    assumptions: ['Параметры получены подгонкой по измеренным данным.'],
    limitations: ['Параметры не выводятся из состава и не переносятся между продуктами.'],
    validityRange: 'Только для материала, на котором выполнена подгонка.',
    accuracy: 'Не определена для ганаша.',
    status: 'not_recommended',
    implementationStatus: 'researched_not_applicable',
  },
  {
    id: 'grover-sucrose-equivalent',
    name: 'Grover sucrose-equivalent method',
    nameRu: 'Метод сахарозного эквивалента Гровера',
    equation: 'E_s = Σ (масса компонента × коэффициент компонента) / масса воды',
    variables: [
      { symbol: 'E_s', meaning: 'сахарозный эквивалент', unit: 'г эквивалента сахарозы на г воды' },
    ],
    sourceIds: ['grover-1947'],
    domain: 'Карамель, помадка, кондитерские изделия 1940-х годов.',
    applicability: 'Быстрый цеховой расчёт давления пара из состава.',
    ganacheApplicability:
      'НЕ ИСПОЛЬЗУЕТСЯ как расчётный метод, но концептуально важна: французская профессиональная практика «équivalent saccharose» (г сахара на г воды) — это тот же приём. Он подтверждает, что отраслевая интуиция считает именно КОНЦЕНТРАЦИЮ ВОДНОЙ ФАЗЫ, что совпадает с нашей моделью. Однако коэффициенты Гровера опубликованы для карамели и помадки и на жировую эмульсию не валидировались, а уравнение Норриша даёт то же самое на явной физической основе.',
    assumptions: ['Каждый компонент эквивалентен некоторому количеству сахарозы.'],
    limitations: [
      'Коэффициенты эмпирические и относятся к изделиям без жировой фазы.',
      'Не различает сахара по молярной массе явно.',
    ],
    validityRange: 'Карамель и помадка, состав 1940-х годов.',
    accuracy: 'Не проверялась на ганаше.',
    status: 'empirical',
    implementationStatus: 'researched_not_applicable',
  },
  {
    id: 'arrhenius',
    name: 'Arrhenius equation',
    nameRu: 'Уравнение Аррениуса',
    equation: 'k = A · exp(−E_a / (R·T))',
    variables: [
      { symbol: 'k', meaning: 'константа скорости порчи', unit: 'зависит от порядка реакции' },
      { symbol: 'A', meaning: 'предэкспоненциальный множитель', unit: 'те же, что у k' },
      { symbol: 'E_a', meaning: 'энергия активации', unit: 'Дж/моль' },
      { symbol: 'R', meaning: 'универсальная газовая постоянная', unit: '8.314 Дж/(моль·К)' },
      { symbol: 'T', meaning: 'абсолютная температура', unit: 'К' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Химическая порча: окисление жиров, потемнение, потеря витаминов.',
    applicability: 'Пересчёт скорости порчи между температурами, когда E_a ОПРЕДЕЛЕНА ЭКСПЕРИМЕНТАЛЬНО.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМА без калибровки, и вымышленное E_a здесь недопустимо. Три отдельные причины: (1) E_a специфична для конкретной реакции и конкретного продукта, её нельзя взять из литературы по другому изделию; (2) аррениусовская модель ломается там, где происходит фазовый переход или меняется a_w — а в ганаше при хранении a_w меняется (исследование ВНИИЗ прямо это показывает); (3) для ганаша ограничивающий фактор чаще микробиологический, а рост микроорганизмов не подчиняется Аррениусу. Заложена как будущий модуль на случай появления калибровочных данных.',
    assumptions: ['Один доминирующий механизм порчи во всём диапазоне температур.'],
    limitations: [
      'Требует экспериментального определения E_a для конкретного продукта.',
      'Нарушается при фазовых переходах, изменении a_w, стеклованиии, смене механизма.',
      'Не описывает микробиологическую порчу.',
    ],
    validityRange: 'Только при экспериментально подтверждённом E_a и неизменном механизме.',
    accuracy: 'Не определена: E_a для ганаша не опубликована.',
    status: 'uncertain',
    implementationStatus: 'available_needs_data',
  },
  {
    id: 'q10',
    name: 'Q10 temperature coefficient',
    nameRu: 'Температурный коэффициент Q10',
    equation: 'Q10 = k(T + 10) / k(T);  срок(T + 10) = срок(T) / Q10',
    variables: [
      { symbol: 'Q10', meaning: 'во сколько раз ускоряется порча при +10 °C', unit: 'безразмерная' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Ускоренные испытания срока годности.',
    applicability: 'Упрощённый пересчёт срока между температурами при ИЗМЕРЕННОМ Q10.',
    ganacheApplicability:
      'НЕ ПРИМЕНИМА без измерения. Для пищевых продуктов Q10 обычно лежит в диапазоне 2–3, но подставить произвольное значение из этого диапазона — значит получить разброс срока в полтора раза и выдать его за расчёт. Q10 для ганаша не опубликован.',
    assumptions: ['Постоянное отношение скоростей на каждые 10 °C.'],
    limitations: [
      'Q10 продукто-специфичен и требует испытаний минимум при двух температурах.',
      'Не применим при смене механизма порчи.',
    ],
    validityRange: 'Узкий диапазон температур вокруг точки измерения.',
    accuracy: 'Не определена для ганаша.',
    status: 'uncertain',
    implementationStatus: 'available_needs_data',
  },
  {
    id: 'gordon-taylor',
    name: 'Gordon–Taylor equation (glass transition of a mixture)',
    nameRu: 'Уравнение Гордона–Тейлора (температура стеклования смеси)',
    equation: 'T_g = (w₁·T_g1 + k·w₂·T_g2) / (w₁ + k·w₂)',
    variables: [
      { symbol: 'T_g', meaning: 'температура стеклования смеси', unit: '°C или К' },
      { symbol: 'w₁, w₂', meaning: 'массовые доли компонентов', unit: 'безразмерные' },
      { symbol: 'k', meaning: 'эмпирическая константа пары', unit: 'безразмерная' },
    ],
    sourceIds: ['sereno-2001-aw-review'],
    domain: 'Аморфные сахарные системы, порошки, сухие изделия.',
    applicability: 'Прогноз T_g смеси сахар–вода; вода является пластификатором и резко снижает T_g.',
    ganacheApplicability:
      'НЕ РЕЛЕВАНТНА для устойчивости ганаша при обычном хранении. Причина конкретна: T_g водной фазы ганаша при 17–20 % воды лежит глубоко ниже −30 °C, то есть при любой температуре хранения система заведомо находится в резиноподобном, а не стеклообразном состоянии. Стеклование определяет липкость и слёживаемость СУХИХ кондитерских изделий, а не стабильность ганаша. Может стать релевантной для замороженных изделий и для пралине.',
    assumptions: ['Аддитивность свободного объёма компонентов.'],
    limitations: ['Константа k определяется экспериментально для каждой пары компонентов.'],
    validityRange: 'Аморфные системы; для многокомпонентных смесей точность падает.',
    accuracy: 'Не применялась в этом проекте.',
    status: 'not_recommended',
    implementationStatus: 'researched_not_applicable',
  },
  {
    id: 'gamma-concept',
    name: 'Gamma concept (multiplicative hurdle model)',
    nameRu: 'Гамма-концепция (мультипликативная модель барьеров)',
    equation: 'μ = μ_opt · γ(T) · γ(pH) · γ(a_w) · γ(прочие барьеры)',
    variables: [
      { symbol: 'μ', meaning: 'удельная скорость роста', unit: '1/ч' },
      { symbol: 'μ_opt', meaning: 'скорость роста в оптимальных условиях', unit: '1/ч' },
      { symbol: 'γ(x)', meaning: 'коэффициент подавления фактором x, 0–1', unit: 'безразмерная' },
    ],
    sourceIds: ['zwietering-1996-gamma', 'leistner-hurdle'],
    domain: 'Прогностическая микробиология.',
    applicability:
      'Научная формализация hurdle technology: независимые барьеры перемножаются, поэтому несколько слабых барьеров дают сильную суммарную защиту.',
    ganacheApplicability:
      'ПРИМЕНИМА КАЧЕСТВЕННО, но не количественно. Структура модели верна и используется в приложении, чтобы показать вклад каждого барьера. Численно инстанцировать её нельзя: кардинальные параметры (T_min, pH_min, a_w,min, μ_opt) для организмов порчи ганаша в жировой матрице не опубликованы, а брать их из модельной среды означало бы выдать чужие условия за наши. Приложение показывает СТРУКТУРУ барьеров и статус каждого, но не выдаёт μ в числах.',
    assumptions: ['Факторы действуют независимо и перемножаются.'],
    limitations: [
      'Гамма-гипотеза нарушается при сильных комбинированных стрессах (синергия и антагонизм).',
      'Кардинальные параметры для ганаша отсутствуют.',
    ],
    validityRange: 'Умеренные уровни отдельных стрессов, при наличии кардинальных параметров.',
    accuracy: 'Количественно не инстанцирована в этом проекте.',
    status: 'experimental',
    implementationStatus: 'available_needs_data',
  },
  {
    id: 'shelf-life-water-sugar',
    name: 'shelfLife = f(water %, sugar %)',
    nameRu: 'Срок годности как функция воды и сахара',
    equation: '— (формулы не существует)',
    variables: [],
    sourceIds: ['lapcikova-2024-ganache'],
    domain: '—',
    applicability: '—',
    ganacheApplicability:
      'ТАКОЙ ФОРМУЛЫ НЕ СУЩЕСТВУЕТ, и это установленный результат поиска, а не пробел в нём. Рецензируемый обзор по ганашу 2024 г. не приводит ни одной модели прогнозирования срока годности. Вода и сахар влияют на срок ЧЕРЕЗ a_w и состав сахаров, но одно и то же «20 % воды, 30 % сахара» даёт разную a_w при разном составе сахаров и разный срок при разной упаковке, температуре, гигиене и оболочке. Эмпирические контрольные точки пользователя сохранены как наблюдения и используются только внутри наблюдённого диапазона.',
    assumptions: [],
    limitations: ['Формула отсутствует в литературе.'],
    validityRange: '—',
    accuracy: '—',
    status: 'not_recommended',
    implementationStatus: 'researched_not_applicable',
  },
] as const;

const FORMULA_INDEX = new Map(SCIENTIFIC_FORMULAS.map((f) => [f.id, f]));

export function getFormula(id: string): ScientificFormula | null {
  return FORMULA_INDEX.get(id) ?? null;
}

export function requireFormula(id: string): ScientificFormula {
  const formula = FORMULA_INDEX.get(id);
  if (!formula) throw new Error(`Unknown scientific formula id: ${id}`);
  return formula;
}

export function formulasByStatus(status: ImplementationStatus): ScientificFormula[] {
  return SCIENTIFIC_FORMULAS.filter((f) => f.implementationStatus === status);
}
