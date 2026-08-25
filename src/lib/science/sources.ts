/**
 * Registry of scientific sources (spec §35).
 *
 * Every scientific constant, formula and threshold used anywhere in the
 * calculation engine MUST reference an id from this registry. That is the
 * mechanism behind spec §60: the user can always ask "where did this number
 * come from?" and get a real answer.
 *
 * `confidence` describes the SOURCE, not the claim taken from it. A tier-S
 * journal can still be cited for a statement the authors themselves flag as
 * tentative; that nuance lives on the formula/threshold, not here.
 */

/** Source hierarchy of spec §8. */
export type SourceTier = 'S' | 'A' | 'B' | 'C';

export type SourceType =
  | 'peer_reviewed'
  | 'book'
  | 'standard'
  | 'government'
  | 'university'
  | 'industry'
  | 'other';

export type SourceLanguage = 'en' | 'ru' | 'fr' | 'multi';

export interface ScientificSource {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  language: SourceLanguage;
  publication: string;
  url: string | null;
  doi: string | null;
  sourceType: SourceType;
  tier: SourceTier;
  /** What this project actually takes from the source. */
  usedFor: string;
  /** Caveats that matter when relying on it. */
  caveats?: string;
}

export const SCIENTIFIC_SOURCES: readonly ScientificSource[] = [
  // ── Water activity: models and constants ────────────────────────────────
  {
    id: 'norrish-1966',
    title:
      'An equation for the activity coefficients and equilibrium relative humidities of water in confectionery syrups',
    authors: ['Norrish, R. S.'],
    year: 1966,
    language: 'en',
    publication: 'Journal of Food Technology 1(1), 25–39',
    url: 'https://academic.oup.com/ijfst/article/1/1/25/7906072',
    doi: '10.1111/j.1365-2621.1966.tb01027.x',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Первичный источник уравнения Норриша a_w = X_w · exp(−K · X_s²). Работа выполнена именно на кондитерских сиропах.',
  },
  {
    id: 'baeza-2010-norrish',
    title:
      "Evaluation of Norrish's equation for correlating the water activity of highly concentrated solutions of sugars, polyols and polyethylene glycols",
    authors: ['Baeza, R.', 'Pérez, A.', 'Sánchez, V.', 'Zamora, M. C.', 'Chirife, J.'],
    year: 2010,
    language: 'en',
    publication: 'Food and Bioprocess Technology 3(1), 87–92',
    url: 'https://repositorio.uca.edu.ar/bitstream/123456789/5462/1/evaluation-norrish-equation-correlating-water.pdf',
    doi: '10.1007/s11947-007-0052-8',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Проверка уравнения Норриша на высококонцентрированных растворах; «общепринятые» значения K и границы их применимости.',
    caveats:
      'Показывает, что «общепринятые» K получены по данным при a_w > 0.85. Для сахарозы K = 6.47 остаётся точным до 90 % (CV 0.75 %), для сорбита и глицерина при высоких концентрациях — нет.',
  },
  {
    id: 'fao-y4358e-ch4',
    title:
      'Extension of the intermediate moisture concept to high moisture products (Chapter 4)',
    authors: ['FAO'],
    year: 2003,
    language: 'en',
    publication:
      'FAO Agricultural Services Bulletin 149 — Handling and preservation of fruits and vegetables by combined methods',
    url: 'https://www.fao.org/4/y4358e/y4358e07.htm',
    doi: null,
    sourceType: 'government',
    tier: 'S',
    usedFor:
      'Таблица констант K уравнения Норриша (сахароза, мальтоза, глюкоза, лактоза, сорбит, глицерин, маннит, пропиленгликоль, лимонная кислота) и мультисолютное расширение a_w = X_w · exp(−Σ K_i X_i²).',
  },
  {
    id: 'chirife-1980-1982',
    title:
      'Studies on water activity prediction in non-electrolyte solutions (glucose, fructose, sucrose, polyols)',
    authors: ['Chirife, J.', 'Favetto, G.', 'Ferro Fontán, C.'],
    year: 1982,
    language: 'en',
    publication:
      'Journal of Food Science / Journal of Food Technology, серия работ 1980–1982',
    url: null,
    doi: null,
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Значения константы K для отдельных сахаров; наблюдение, что фруктоза, глюкоза, манноза и галактоза понижают a_w практически одинаково.',
    caveats:
      'В литературе встречаются оба знаковых соглашения (K = 6.47 при exp(−K·X²) и K = −6.47 при exp(+K·X²)). В проекте используется положительное K с exp(−K·X²).',
  },
  {
    id: 'money-born-1951',
    title: 'Equilibrium humidity of sugar solutions',
    authors: ['Money, R. W.', 'Born, R.'],
    year: 1951,
    language: 'en',
    publication: 'Journal of the Science of Food and Agriculture 2(4), 180–185',
    url: 'https://scijournals.onlinelibrary.wiley.com/doi/abs/10.1002/jsfa.2740020408',
    doi: '10.1002/jsfa.2740020408',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Концепция «эквивалентной молекулярной массы» сухих веществ глюкозного сиропа, позволяющая считать сироп как простой сахар. Применение к джемам, помадкам и карамели.',
  },
  {
    id: 'grover-1947',
    title: 'The keeping properties of confectionery as influenced by its water vapour pressure',
    authors: ['Grover, D. W.'],
    year: 1947,
    language: 'en',
    publication: 'Journal of the Society of Chemical Industry 66(7), 201–205',
    url: 'https://onlinelibrary.wiley.com/doi/abs/10.1002/jctb.5000660701',
    doi: '10.1002/jctb.5000660701',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Исторический метод «сахарозного эквивалента» для кондитерских изделий: расчёт давления пара из состава (сахароза, кондитерская глюкоза, инвертный сахар).',
    caveats:
      'Коэффициенты Гровера опубликованы в 1947 г. для карамели и помадки; на ганаш (жировая эмульсия) не валидировались.',
  },
  {
    id: 'ross-1975',
    title: 'Estimation of water activity in intermediate moisture foods',
    authors: ['Ross, K. D.'],
    year: 1975,
    language: 'en',
    publication: 'Food Technology 29(3), 26–34',
    url: null,
    doi: null,
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Мультипликативное правило a_w = Π a_w,i для смесей растворённых веществ.',
    caveats:
      'Точность ±0.01 подтверждена для разбавленных и умеренных смесей; для концентрированных растворов правило систематически завышает a_w, так как игнорирует взаимодействие растворённых веществ.',
  },
  {
    id: 'bccdc-1997-aw-tables',
    title: 'Water Activity of Sucrose and NaCl Solutions (Food Safety Bulletin, 03/97)',
    authors: ['BC Centre for Disease Control'],
    year: 1997,
    language: 'en',
    publication:
      'BCCDC Food Safety Bulletin; ссылается на Principles of Food Science Part II, Physical Principles of Food Preservation, p. 250, и USFDA Bad Bug Book',
    url: 'https://ucfoodsafety.ucdavis.edu/sites/g/files/dgvnsk7366/files/inline-files/133655.pdf',
    doi: null,
    sourceType: 'government',
    tier: 'S',
    usedFor:
      'Независимая опубликованная таблица a_w растворов сахарозы, использованная для численной валидации нашей реализации уравнения Норриша (spec §40).',
    caveats:
      'В строке «20 г сахарозы на 100 г воды» напечатано a_w = 0.998, тогда как собственная формула бюллетеня a = 1/(1 + 0.27n) даёт 0.984. Это опечатка источника; при валидации строка исключена. См. docs/scientific-research/08-formulas.md.',
  },
  {
    id: 'sereno-2001-aw-review',
    title: 'Water activity and its prediction: a review',
    authors: ['Sereno, A. M.', 'Hubinger, M. D.', 'Comesaña, J. F.', 'Correa, A.'],
    year: 2001,
    language: 'en',
    publication: 'International Journal of Food Properties 4(2), 235–244',
    url: 'https://www.tandfonline.com/doi/full/10.1081/JFP-100002187',
    doi: '10.1081/JFP-100002187',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor: 'Обзор моделей прогнозирования a_w и сводка «общепринятых» констант.',
  },

  // ── Ganache and chocolate ───────────────────────────────────────────────
  {
    id: 'lapcikova-2024-ganache',
    title:
      'Chocolate Ganaches: Formulation, Processing and Stability in View of the New Production Trends',
    authors: ['Lapčíková, B.', 'Lapčík, L.', 'Valenta, T.', 'Neuwirth, V.'],
    year: 2024,
    language: 'en',
    publication: 'Foods 13(16), 2543',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11353510',
    doi: '10.3390/foods13162543',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Единственный найденный рецензируемый обзор именно по ганашу: измеренные a_w, порог 65 °Brix, состав микрофлоры порчи, тип эмульсии, растрескивание оболочки, ориентиры срока годности.',
    caveats:
      'Обзор прямо констатирует отсутствие опубликованных математических моделей прогнозирования срока годности ганаша.',
  },
  {
    id: 'neuwirth-2024-ganache-processing',
    title:
      'Effect of technological processing and recipe formulation on the physico-chemical properties of ganaches and chocolate pralines',
    authors: ['Neuwirth, V.', 'Lapčíková, B.', 'Lapčík, L.'],
    year: 2024,
    language: 'en',
    publication: 'Journal of Food Engineering',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0260877424001900',
    doi: '10.1016/j.jfoodeng.2024.112110',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Влияние рецептуры и обработки на физико-химические свойства ганаша и пралине, включая a_w и текстуру.',
  },

  // ── Microbiology ────────────────────────────────────────────────────────
  {
    id: 'fda-food-code-ch3',
    title:
      'Factors that Influence Microbial Growth (Food Code, Annex 3 / Bacterial Pathogen Growth and Inactivation)',
    authors: ['U.S. Food and Drug Administration'],
    year: 2013,
    language: 'en',
    publication: 'FDA Food Code Annex 3; FSMA Preventive Controls guidance',
    url: 'https://www.fda.gov/media/80390/download',
    doi: null,
    sourceType: 'government',
    tier: 'S',
    usedFor:
      'Пределы роста патогенов по a_w, pH и температуре; регуляторный порог a_w ≤ 0.85 для продуктов, не требующих холодильного хранения по соображениям безопасности.',
  },
  {
    id: 'scott-1953-aw',
    title: 'Water relations of Staphylococcus aureus at 30 °C / Water relations of food spoilage microorganisms',
    authors: ['Scott, W. J.'],
    year: 1953,
    language: 'en',
    publication: 'Australian Journal of Biological Sciences 6, 549–564; Advances in Food Research 7, 83–127',
    url: null,
    doi: null,
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Основополагающая работа: рост микроорганизмов определяется активностью воды, а не влажностью. Источник концепции минимальной a_w.',
  },
  {
    id: 'icmsf-1996-microbial-ecology',
    title: 'Microorganisms in Foods 5: Characteristics of Microbial Pathogens',
    authors: ['ICMSF (International Commission on Microbiological Specifications for Foods)'],
    year: 1996,
    language: 'en',
    publication: 'Blackie Academic & Professional, London',
    url: null,
    doi: null,
    sourceType: 'book',
    tier: 'S',
    usedFor: 'Справочные пределы роста патогенов по a_w, pH и температуре.',
  },
  {
    id: 'pitt-hocking-fungi',
    title: 'Fungi and Food Spoilage (3rd ed.)',
    authors: ['Pitt, J. I.', 'Hocking, A. D.'],
    year: 2009,
    language: 'en',
    publication: 'Springer, New York',
    url: null,
    doi: null,
    sourceType: 'book',
    tier: 'S',
    usedFor:
      'Минимальные a_w для ксерофильных плесеней и осмофильных дрожжей; Xeromyces bisporus как абсолютный предел (0.61) и время до прорастания при этом пределе.',
  },
  {
    id: 'vermeulen-2012-zrouxii',
    title:
      'Screening of different stress factors and development of growth/no growth models for Zygosaccharomyces rouxii in modified Sabouraud medium, mimicking intermediate moisture foods (IMF)',
    authors: ['Vermeulen, A.', 'Devlieghere, F.', 'Ragaert, P.', 'Debevere, J.', 'et al.'],
    year: 2012,
    language: 'en',
    publication: 'Food Microbiology 32(2), 389–396',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0740002012001657',
    doi: '10.1016/j.fm.2012.08.005',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Модели «рост / отсутствие роста» для главного организма порчи сладких продуктов промежуточной влажности.',
  },
  {
    id: 'vanderveken-2014-zrouxii-imf',
    title:
      'Growth/no growth models for Zygosaccharomyces rouxii associated with acidic, sweet intermediate moisture food products',
    authors: ['Vermeulen, A.', 'Marvig, C. L.', 'Daelman, J.', 'Xhaferi, R.', 'Devlieghere, F.'],
    year: 2015,
    language: 'en',
    publication: 'International Journal of Food Microbiology 194, 39–47',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25306299/',
    doi: '10.1016/j.ijfoodmicro.2014.09.019',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Границы роста Z. rouxii по a_w, pH, этанолу и уксусной кислоте с ЯВНЫМ учётом времени (30/60/90 суток) — научное основание того, что «стабильность» осмысленна только применительно к сроку.',
    caveats:
      'Модель построена на модельной среде (modified Sabouraud), а не на ганаше; переносить количественно на жировую эмульсию нельзя без валидации.',
  },
  {
    id: 'zwietering-1996-gamma',
    title: 'Modelling of bacterial growth as a function of temperature / the gamma concept',
    authors: ['Zwietering, M. H.', 'Wijtzes, T.', 'de Wit, J. C.', 'van t Riet, K.'],
    year: 1996,
    language: 'en',
    publication: 'Journal of Food Protection / Applied and Environmental Microbiology',
    url: null,
    doi: null,
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor:
      'Гамма-концепция: независимые ингибирующие факторы перемножаются. Научная формализация hurdle technology.',
    caveats:
      'Гамма-гипотеза нарушается при сильных комбинированных стрессах (синергия/антагонизм). Кардинальные параметры для ганаша не опубликованы, поэтому в проекте гамма-концепция используется КАЧЕСТВЕННО.',
  },
  {
    id: 'leistner-hurdle',
    title: 'Basic aspects of food preservation by hurdle technology',
    authors: ['Leistner, L.'],
    year: 2000,
    language: 'en',
    publication: 'International Journal of Food Microbiology 55(1–3), 181–186',
    url: null,
    doi: '10.1016/S0168-1605(00)00161-6',
    sourceType: 'peer_reviewed',
    tier: 'S',
    usedFor: 'Концепция барьеров (hurdle technology) и её применение к продуктам промежуточной влажности.',
  },

  // ── Preservatives ───────────────────────────────────────────────────────
  {
    id: 'sorbic-acid-pka',
    title: 'Sorbic acid / potassium sorbate: dissociation and antimicrobial activity',
    authors: ['Обобщение справочных данных по консервантам'],
    year: null,
    language: 'en',
    publication:
      'ScienceDirect Topics (Potassium Sorbate); Davidson, Sofos & Branen, Antimicrobials in Food (3rd ed.)',
    url: 'https://www.sciencedirect.com/topics/immunology-and-microbiology/potassium-sorbate',
    doi: null,
    sourceType: 'book',
    tier: 'A',
    usedFor:
      'pKa сорбиновой кислоты = 4.76; противомикробное действие связано с недиссоциированной формой, поэтому эффективность падает с ростом pH.',
    caveats:
      'Разрешённые дозировки различаются по странам и в проекте НЕ приводятся (spec §30).',
  },

  // ── Composition reference data ──────────────────────────────────────────
  {
    id: 'usda-fdc',
    title: 'FoodData Central',
    authors: ['U.S. Department of Agriculture, Agricultural Research Service'],
    year: 2024,
    language: 'en',
    publication: 'USDA FoodData Central (Foundation Foods, SR Legacy)',
    url: 'https://fdc.nal.usda.gov/api-guide',
    doi: null,
    sourceType: 'government',
    tier: 'S',
    usedFor:
      'Референсный состав молочных и фруктовых ингредиентов, включая лактозу сливок и профиль сахаров фруктов. Открытый REST API с ключом data.gov.',
    caveats:
      'FDC даёт нутриентную панель, а не технологические параметры: нет a_w, pH указывается редко, «сухие вещества какао» отсутствуют как понятие.',
  },
  {
    id: 'ciqual-anses',
    title: 'Table de composition nutritionnelle des aliments Ciqual',
    authors: ['ANSES (Agence nationale de sécurité sanitaire de l’alimentation)'],
    year: 2020,
    language: 'fr',
    publication: 'ANSES-Ciqual',
    url: 'https://ciqual.anses.fr/',
    doi: null,
    sourceType: 'government',
    tier: 'S',
    usedFor:
      'Французская государственная база состава продуктов; содержит воду, сахара и отдельные сахара для многих позиций.',
  },
  {
    id: 'openfoodfacts',
    title: 'Open Food Facts',
    authors: ['Open Food Facts contributors'],
    year: 2024,
    language: 'multi',
    publication: 'Открытая база данных продуктов питания (ODbL)',
    url: 'https://world.openfoodfacts.org/data',
    doi: null,
    sourceType: 'other',
    tier: 'C',
    usedFor:
      'Поиск коммерческих продуктов по штрихкоду. Уже подключён в проекте как вспомогательный источник.',
    caveats:
      'Данные вносятся пользователями и не проходят рецензирование. Панель питательной ценности не содержит воду, поэтому воду НЕЛЬЗЯ достроить вычитанием. Пригодно как подсказка, не как научный источник.',
  },
  {
    id: 'sucrose-solubility',
    title: 'Sucrose solubility',
    authors: ['Mathlouthi, M.', 'Reiser, P. (eds.)'],
    year: 1995,
    language: 'en',
    publication: 'Sucrose: Properties and Applications, Chapter 5, Springer',
    url: 'https://link.springer.com/chapter/10.1007/978-1-4615-2676-6_5',
    doi: '10.1007/978-1-4615-2676-6_5',
    sourceType: 'book',
    tier: 'S',
    usedFor:
      'Растворимость сахарозы как функция температуры (≈67.1 % масс. при 20 °C) — граница, за которой избыток сахарозы кристаллизуется и перестаёт понижать a_w.',
  },
  {
    id: 'de-molecular-weight',
    title: 'Dextrose equivalent and number-average molecular weight of glucose syrups',
    authors: ['Обобщение технологической литературы по крахмальным гидролизатам'],
    year: null,
    language: 'en',
    publication:
      'ScienceDirect Topics (Dextrose Equivalent); BeMiller & Whistler, Starch: Chemistry and Technology',
    url: 'https://www.sciencedirect.com/topics/biochemistry-genetics-and-molecular-biology/dextrose-equivalent',
    doi: null,
    sourceType: 'book',
    tier: 'A',
    usedFor:
      'Соотношение DE = 18016 / M_n, дающее среднечисловую молярную массу сухих веществ глюкозного сиропа из его DE.',
    caveats:
      'M_n описывает СРЕДНЕЕ, а не распределение. Два сиропа с одинаковым DE, но разным распределением по степени полимеризации, дадут одинаковый расчёт a_w и разное поведение при кристаллизации.',
  },

  // ── Russian sources ─────────────────────────────────────────────────────
  {
    id: 'vniiz-aw-fillings',
    title:
      'Влияние активности воды кондитерских кремов и начинок на сроки их хранения и микробиологические показатели',
    authors: ['ФГБНУ «ФНЦ пищевых систем им. В.М. Горбатова» / ВНИИЗ'],
    year: null,
    language: 'ru',
    publication: 'Научные публикации ВНИИЗ',
    url: 'https://vniiz.org/science/publication/article-173',
    doi: null,
    sourceType: 'university',
    tier: 'A',
    usedFor:
      'Российское исследование именно кондитерских кремов и начинок: измерение a_w гигрометром Rotronic HygroPalm, динамика a_w за 4 месяца хранения при 4–6 °C, состав развивающейся микрофлоры.',
    caveats:
      'Ключевое наблюдение для нашей модели: за время хранения a_w НЕ постоянна — во фруктово-ягодных начинках снижается, в кремах растёт. Одноразовый расчёт a_w описывает только момент изготовления.',
  },
  {
    id: 'gost-5900-2014',
    title: 'ГОСТ 5900-2014. Изделия кондитерские. Методы определения влаги и сухих веществ',
    authors: ['Межгосударственный совет по стандартизации, метрологии и сертификации'],
    year: 2014,
    language: 'ru',
    publication: 'Межгосударственный стандарт',
    url: 'http://docs.cntd.ru/document/1200119064',
    doi: null,
    sourceType: 'standard',
    tier: 'S',
    usedFor:
      'Нормативное определение влаги и сухих веществ кондитерских изделий — методическая основа того, что считать «сухими веществами» при лабораторной проверке рецептуры.',
    caveats:
      'Стандарт определяет ИЗМЕРЕНИЕ (высушивание до постоянной массы), а не расчёт из рецептуры. Расчётная сухая масса и измеренная по ГОСТ 5900 могут расходиться.',
  },
  {
    id: 'ru-dissertation-aw',
    title:
      'Теоретические и прикладные аспекты показателя «активность воды» в технологии продуктов питания',
    authors: ['Диссертационное исследование (dissercat)'],
    year: null,
    language: 'ru',
    publication: 'Диссертация, технология пищевых продуктов',
    url: 'https://www.dissercat.com/content/teoreticheskie-i-prikladnye-aspekty-pokazatelya-aktivnost-vody-v-tekhnologii-produktov-pitan',
    doi: null,
    sourceType: 'university',
    tier: 'A',
    usedFor:
      'Русскоязычная терминология и теоретическая база: свободная и связанная вода, изотермы сорбции, применение a_w в пищевой технологии.',
  },

  // ── French sources ──────────────────────────────────────────────────────
  {
    id: 'genie-alimentaire-aw',
    title: "L'activité de l'eau : aw",
    authors: ['Génie Alimentaire'],
    year: null,
    language: 'fr',
    publication: 'Ресурс по пищевой инженерии (образовательный)',
    url: 'https://genie-alimentaire.com/spip.php?article17=',
    doi: null,
    sourceType: 'university',
    tier: 'B',
    usedFor:
      'Французская терминология (eau libre / eau liée, isotherme de sorption), зоны изотермы сорбции, пороги роста микроорганизмов в французской традиции.',
    caveats:
      'Приводит закон Рауля в виде a_w = n1/(n1+n2) без поправки на неидеальность — для концентрированных кондитерских систем это завышает a_w.',
  },
  {
    id: 'fr-professional-ganache',
    title:
      'Профессиональная французская практика по ганашу: сукре инверти, сироп глюкозы, сроки хранения',
    authors: ['Профессиональные ресурсы chocolaterie / pâtisserie'],
    year: null,
    language: 'fr',
    publication:
      'formation-chocolatier.online, mae-innovation.com и аналогичные профессиональные ресурсы',
    url: 'https://formation-chocolatier.online/conservation-ganache-chocolat/',
    doi: null,
    sourceType: 'industry',
    tier: 'C',
    usedFor:
      'ГИПОТЕЗЫ и практические ориентиры: 8–10 % инвертного сахара или глюкозы, 10–15 % масла; «метод эквивалента сахарозы» (г сахара на г воды) как отраслевая практика.',
    caveats:
      'Уровень C по spec §8. Используется ТОЛЬКО как источник гипотез и терминов; ни одно число отсюда не попадает в расчётное ядро. Утверждения вида «до 6 месяцев» приводятся без методики и не проверяемы.',
  },
  {
    id: 'callebaut-aw-shelf-life',
    title: 'Shelf Life: Introduction to Water Activity',
    authors: ['Barry Callebaut / Chocolate Academy'],
    year: null,
    language: 'en',
    publication: 'Техническая документация производителя шоколада',
    url: 'https://www.callebaut.com/en/shelf-life-introduction-water-activity',
    doi: null,
    sourceType: 'industry',
    tier: 'B',
    usedFor:
      'Отраслевые целевые диапазоны a_w для начинок и связанные с ними ориентиры срока годности.',
    caveats:
      'Методология получения диапазонов не раскрыта. Уровень B: пригодно как ориентир отрасли, не как основание формулы.',
  },
] as const;

const SOURCE_INDEX = new Map(SCIENTIFIC_SOURCES.map((s) => [s.id, s]));

export type ScientificSourceId = (typeof SCIENTIFIC_SOURCES)[number]['id'];

export function getSource(id: string): ScientificSource | null {
  return SOURCE_INDEX.get(id) ?? null;
}

/**
 * Resolves a list of ids to sources, throwing on an unknown id.
 *
 * Deliberately strict: a dangling source reference means a constant has lost
 * its provenance, which is exactly the failure mode spec §54 forbids.
 */
export function requireSources(ids: readonly string[]): ScientificSource[] {
  return ids.map((id) => {
    const source = SOURCE_INDEX.get(id);
    if (!source) throw new Error(`Unknown scientific source id: ${id}`);
    return source;
  });
}

export function sourcesByTier(tier: SourceTier): ScientificSource[] {
  return SCIENTIFIC_SOURCES.filter((s) => s.tier === tier);
}

export function sourcesByLanguage(language: SourceLanguage): ScientificSource[] {
  return SCIENTIFIC_SOURCES.filter((s) => s.language === language);
}
