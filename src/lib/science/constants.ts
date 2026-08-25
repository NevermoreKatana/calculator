/**
 * Centralised scientific constants (spec §54).
 *
 * RULE: every constant in this file carries `sourceIds` pointing into
 * src/lib/science/sources.ts. `const MAGIC = 0.83` with no provenance is
 * forbidden anywhere in the project — this file is where the alternative
 * lives.
 *
 * UNITS (spec §39). Stated per constant, never implied:
 *   molarMass  g/mol
 *   mass       g
 *   percent    0..100 % of the stated basis
 *   fraction   0..1
 *   temperature °C unless the name ends in Kelvin
 */

import type { EvidenceStatus } from './confidence';

export interface ScientificConstant<T> {
  value: T;
  unit: string;
  sourceIds: string[];
  status: EvidenceStatus;
  note?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Molar masses
// ──────────────────────────────────────────────────────────────────────────

/**
 * Molar masses, g/mol. Standard atomic weights (IUPAC); these are physical
 * constants and need no food-science source.
 */
export const MOLAR_MASS = {
  water: 18.0153,
  /** Sucrose C12H22O11. */
  sucrose: 342.2965,
  /** Glucose (dextrose) C6H12O6. */
  glucose: 180.156,
  /** Fructose C6H12O6 — isomer of glucose, same molar mass. */
  fructose: 180.156,
  /** Lactose C12H22O11. */
  lactose: 342.2965,
  /** Maltose C12H22O11. */
  maltose: 342.2965,
  /** Sorbitol C6H14O6. */
  sorbitol: 182.172,
  /** Glycerol C3H8O3. */
  glycerol: 92.0938,
  /** Xylitol C5H12O5. */
  xylitol: 152.146,
  /** Maltitol C12H24O11. */
  maltitol: 344.313,
  /** Ethanol C2H5OH — relevant for alcohol-containing ganache. */
  ethanol: 46.0684,
  /** Sodium chloride, for the rare salted formulation. */
  sodiumChloride: 58.443,
  /** Citric acid (anhydrous) C6H8O7. */
  citricAcid: 192.123,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Norrish constants
// ──────────────────────────────────────────────────────────────────────────

/**
 * Norrish K constants for the equation a_w = X_w · exp(−K · X_s²).
 *
 * SIGN CONVENTION — this trips up half the literature. Two forms circulate:
 *     a_w = X_w · exp(−K · X_s²)   with K POSITIVE  (sucrose K = +6.47)
 *     a_w = X_w · exp(+K · X_s²)   with K NEGATIVE  (sucrose K = −6.47)
 * They are the same equation. This project uses the FIRST form throughout, so
 * every K stored here is positive. See docs/scientific-research/08-formulas.md.
 *
 * A LARGER K means the solute depresses a_w MORE per mole. Sucrose (6.47)
 * depresses water activity far more per mole than glucose (2.25) — but glucose
 * has half the molar mass, so per GRAM the ranking reverses. That inversion is
 * the whole reason spec §11 insists "30 % sugar" is not one parameter.
 */
export interface NorrishConstant {
  /** Dimensionless. */
  k: number;
  /** ± uncertainty as published, when the source gives one. */
  uncertainty: number | null;
  sourceIds: string[];
  status: EvidenceStatus;
  /** Concentration range over which the value is documented to work. */
  validatedRange: string;
  note?: string;
}

export const NORRISH_CONSTANTS = {
  sucrose: {
    k: 6.47,
    uncertainty: 0.06,
    sourceIds: ['fao-y4358e-ch4', 'baeza-2010-norrish', 'norrish-1966'],
    status: 'validated' as EvidenceStatus,
    validatedRange: 'до 90 % масс. сахарозы',
    note: 'Наиболее надёжная константа набора: Baeza et al. (2010) сообщают R² = 0.9982 и CV = 0.75 % вплоть до 90 % растворов.',
  },
  glucose: {
    k: 2.25,
    uncertainty: 0.04,
    sourceIds: ['fao-y4358e-ch4', 'chirife-1980-1982'],
    status: 'well_supported' as EvidenceStatus,
    validatedRange: 'преимущественно a_w > 0.85',
    note: 'Chirife публикует это значение со знаком «−» в форме exp(+K·X²); здесь приведено к нашему соглашению.',
  },
  fructose: {
    k: 2.25,
    uncertainty: 0.1,
    sourceIds: ['chirife-1980-1982', 'baeza-2010-norrish'],
    status: 'well_supported' as EvidenceStatus,
    validatedRange: 'преимущественно a_w > 0.85; Baeza et al. проверяли до 85 %',
    note:
      'ИСТОЧНИКИ РАСХОДЯТСЯ: Chirife et al. дают для фруктозы 2.15, Baeza et al. (2010) называют «общепринятым» 2.25, а по данным до 85 % получают 1.77. Разброс 1.77–2.25 заложен в неопределённость результата. Chirife отмечает, что фруктоза, глюкоза, манноза и галактоза понижают a_w практически одинаково, что оправдывает общее значение.',
  },
  lactose: {
    k: 10.2,
    uncertainty: null,
    sourceIds: ['fao-y4358e-ch4'],
    status: 'approximate' as EvidenceStatus,
    validatedRange: 'ограничен растворимостью лактозы (≈20 г/100 г воды при 25 °C)',
    note:
      'Лактоза плохо растворима, поэтому высококонцентрированные растворы недостижимы и K определён на узком диапазоне. В ганаше лактоза почти всегда близка к насыщению или кристаллична — см. AQUEOUS_PHASE_LIMITS.',
  },
  maltose: {
    k: 4.54,
    uncertainty: 0.02,
    sourceIds: ['fao-y4358e-ch4'],
    status: 'well_supported' as EvidenceStatus,
    validatedRange: 'умеренные и высокие концентрации',
  },
  sorbitol: {
    k: 1.65,
    uncertainty: 0.14,
    sourceIds: ['fao-y4358e-ch4', 'baeza-2010-norrish'],
    status: 'approximate' as EvidenceStatus,
    validatedRange: 'надёжно до ≈60 % масс.',
    note:
      'Baeza et al. (2010) прямо показывают, что при высоких концентрациях «общепринятое» 1.65 даёт плохое согласие (R² = 0.90, CV = 4.62 %); подгонка по всем данным даёт 0.35. Для сорбита выше 60 % результат помечается пониженной уверенностью.',
  },
  glycerol: {
    k: 1.16,
    uncertainty: 0.01,
    sourceIds: ['fao-y4358e-ch4', 'baeza-2010-norrish'],
    status: 'approximate' as EvidenceStatus,
    validatedRange: 'надёжно до ≈60 % масс.',
    note: 'При высоких концентрациях Baeza et al. получают 0.81 вместо 1.16.',
  },
  xylitol: {
    k: 1.66,
    uncertainty: null,
    sourceIds: ['baeza-2010-norrish'],
    status: 'well_supported' as EvidenceStatus,
    validatedRange: 'до 65 % масс.',
  },
  citricAcid: {
    k: 6.2,
    uncertainty: null,
    sourceIds: ['fao-y4358e-ch4'],
    status: 'approximate' as EvidenceStatus,
    validatedRange: 'диапазон, характерный для фруктовых систем',
    note:
      'Лимонная кислота — электролит; уравнение Норриша построено для неэлектролитов. Значение публикуется FAO для фруктовых сиропов, но физическая основа слабее, чем у сахаров.',
  },
} as const satisfies Record<string, NorrishConstant>;

export type NorrishSolute = keyof typeof NORRISH_CONSTANTS;

// ──────────────────────────────────────────────────────────────────────────
// Glucose syrup: DE → molar mass
// ──────────────────────────────────────────────────────────────────────────

/**
 * Numerator of DE = DEXTROSE_EQUIVALENT_NUMERATOR / M_n, in g/mol.
 *
 * Derivation, so the number is not magic: DE is defined as reducing sugars
 * expressed as dextrose, in percent of dry substance. Every glucose polymer
 * chain carries exactly one reducing end, so one mole of syrup solids of
 * number-average molar mass M_n carries one mole of reducing ends, which is
 * reported as one mole (180.156 g) of dextrose. Hence
 *     DE = 100 × 180.156 / M_n  =  18015.6 / M_n
 * The rounded 18016 is what the technological literature quotes.
 */
export const DEXTROSE_EQUIVALENT_NUMERATOR: ScientificConstant<number> = {
  value: 100 * MOLAR_MASS.glucose,
  unit: 'г/моль × %',
  sourceIds: ['de-molecular-weight', 'money-born-1951'],
  status: 'well_supported',
  note:
    'Money & Born (1951) ввели ту же идею как «эквивалентную молекулярную массу» сухих веществ глюкозного сиропа.',
};

/**
 * Norrish K assigned to glucose syrup solids.
 *
 * There is no published Norrish constant for "glucose syrup" — it is a
 * mixture whose composition varies with DE. Glucose (2.25) and maltose (4.54)
 * bracket the mixture, and mass-weighting between them by DE would be an
 * invented interpolation. Instead the syrup is treated as a single pseudo-
 * solute with the molar mass implied by its DE and the Norrish constant of
 * GLUCOSE, which is the conservative choice: it under-predicts the a_w
 * depression rather than over-predicting it, so the model does not flatter the
 * formulation's stability.
 */
export const GLUCOSE_SYRUP_NORRISH_K: ScientificConstant<number> = {
  value: NORRISH_CONSTANTS.glucose.k,
  unit: 'безразмерная',
  sourceIds: ['chirife-1980-1982', 'money-born-1951', 'de-molecular-weight'],
  status: 'approximate',
  note:
    'Консервативное допущение, а не измеренная константа. Сиропы с высокой долей мальтозы (K = 4.54) в действительности понижают a_w сильнее, чем даёт эта оценка.',
};

// ──────────────────────────────────────────────────────────────────────────
// Solubility limits
// ──────────────────────────────────────────────────────────────────────────

/**
 * Sucrose solubility, percent by mass of a saturated aqueous solution.
 *
 * Above this the excess sucrose is CRYSTALLINE, and crystalline sugar does not
 * lower water activity. Ignoring this is the single most common way a
 * composition-based a_w calculation goes silently wrong in confectionery.
 */
export const SUCROSE_SOLUBILITY_PERCENT_BY_TEMPERATURE: ScientificConstant<
  { temperatureCelsius: number; percentByMass: number }[]
> = {
  value: [
    { temperatureCelsius: 0, percentByMass: 64.4 },
    { temperatureCelsius: 10, percentByMass: 65.6 },
    { temperatureCelsius: 20, percentByMass: 67.1 },
    { temperatureCelsius: 25, percentByMass: 67.9 },
    { temperatureCelsius: 30, percentByMass: 68.7 },
    { temperatureCelsius: 40, percentByMass: 70.4 },
    { temperatureCelsius: 50, percentByMass: 72.3 },
  ],
  unit: '% масс. в насыщенном растворе',
  sourceIds: ['sucrose-solubility'],
  status: 'validated',
  note:
    'Другие сахара и полиолы (инвертный сахар, глюкозный сироп, сорбит) повышают суммарную растворимость смеси, поэтому этот порог применим к САХАРОЗЕ, а не к сумме сахаров.',
};

/** Reference temperature used when the user has not entered one. */
export const DEFAULT_PRODUCT_TEMPERATURE: ScientificConstant<number> = {
  value: 20,
  unit: '°C',
  sourceIds: ['lapcikova-2024-ganache'],
  status: 'approximate',
  note:
    'Комнатное хранение, к которому относятся отраслевые ориентиры a_w для ганаша. Пользователь может задать своё значение.',
};

/**
 * Aqueous-phase concentration above which the ganache review reports microbial
 * growth to be inhibited at ambient storage.
 */
export const BRIX_INHIBITION_THRESHOLD: ScientificConstant<number> = {
  value: 65,
  unit: '°Brix (растворённые сухие вещества водной фазы)',
  sourceIds: ['lapcikova-2024-ganache'],
  status: 'empirical',
  note:
    'Формулировка источника: «при содержании сахара выше 65 °Brix рост микроорганизмов в ганаше может быть подавлен при промежуточных значениях a_w (около 0.70–0.74) во время хранения при комнатной температуре». Это утверждение об УСЛОВИИ, а не порог безопасности.',
};

// ──────────────────────────────────────────────────────────────────────────
// Preservatives
// ──────────────────────────────────────────────────────────────────────────

/**
 * Sorbic acid dissociation constant.
 *
 * The antimicrobial agent is the UNDISSOCIATED acid, so efficacy collapses as
 * pH rises above the pKa. Undissociated fraction follows Henderson–Hasselbalch:
 *     f = 1 / (1 + 10^(pH − pKa))
 * This is a genuine physico-chemical relation, not a food-industry rule.
 */
export const SORBIC_ACID_PKA: ScientificConstant<number> = {
  value: 4.76,
  unit: 'безразмерная (pKa)',
  sourceIds: ['sorbic-acid-pka'],
  status: 'well_supported',
  note: 'В литературе встречаются 4.75 и 4.76; разница не влияет на выводы.',
};

/** Benzoic acid pKa, for completeness where benzoate is used. */
export const BENZOIC_ACID_PKA: ScientificConstant<number> = {
  value: 4.2,
  unit: 'безразмерная (pKa)',
  sourceIds: ['sorbic-acid-pka'],
  status: 'well_supported',
};

// ──────────────────────────────────────────────────────────────────────────
// Regulatory / safety thresholds
// ──────────────────────────────────────────────────────────────────────────

/**
 * a_w at or below which the FDA treats a food as not requiring refrigeration
 * for SAFETY (it may still spoil).
 */
export const FDA_SAFETY_AW_THRESHOLD: ScientificConstant<number> = {
  value: 0.85,
  unit: 'a_w',
  sourceIds: ['fda-food-code-ch3'],
  status: 'validated',
  note:
    'Порог БЕЗОПАСНОСТИ (рост патогенов), а не порог ПОРЧИ. Осмофильные дрожжи и ксерофильные плесени растут значительно ниже 0.85.',
};

/** Below this no known microorganism grows. */
export const UNIVERSAL_GROWTH_LIMIT_AW: ScientificConstant<number> = {
  value: 0.6,
  unit: 'a_w',
  sourceIds: ['pitt-hocking-fungi', 'scott-1953-aw'],
  status: 'well_supported',
  note:
    'Абсолютный предел жизни близок к 0.605 (Xeromyces bisporus, 0.61). Ниже 0.60 рост не документирован ни для одного пищевого микроорганизма.',
};
