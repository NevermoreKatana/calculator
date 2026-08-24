/**
 * Empirical shelf-life reference points (spec §10, §11).
 *
 * These are the three control values supplied by the user. They are EMPIRICAL
 * OBSERVATIONS for a particular product and process — not a physical law, not a
 * guaranteed shelf life, and not a formula (spec §12). They are stored verbatim
 * so the estimator can only ever report what was actually observed, or refuse.
 *
 * Point 3 carries a sugar RANGE because the source records "30/32 %".
 * Points 2 and 3 carry a day RANGE because the source records "58/63" and "38/44".
 */

export interface ShelfLifeReferencePoint {
  id: string;
  waterPercentage: number;
  /** Lower bound of the observed sugar level, in percent of total mass. */
  sugarPercentageMin: number;
  /** Upper bound; equals the minimum when the source gives a single value. */
  sugarPercentageMax: number;
  shelfLifeDaysMin: number;
  shelfLifeDaysMax: number;
  /** Single headline figure, when the source states one. */
  shelfLifeDaysTarget?: number;
  source: string;
  notes?: string;
}

const SOURCE = 'Эмпирические контрольные значения, предоставленные пользователем';

export const SHELF_LIFE_REFERENCE_POINTS: readonly ShelfLifeReferencePoint[] = [
  {
    id: 'ref-1',
    waterPercentage: 17.5,
    sugarPercentageMin: 35,
    sugarPercentageMax: 35,
    shelfLifeDaysMin: 90,
    shelfLifeDaysMax: 90,
    shelfLifeDaysTarget: 90,
    source: SOURCE,
    notes: 'Источник указывает одно значение: 90 дней.',
  },
  {
    id: 'ref-2',
    waterPercentage: 18.6,
    sugarPercentageMin: 32,
    sugarPercentageMax: 32,
    shelfLifeDaysMin: 58,
    shelfLifeDaysMax: 63,
    source: SOURCE,
    notes: 'Источник указывает диапазон: 58/63 дня.',
  },
  {
    id: 'ref-3',
    waterPercentage: 20,
    sugarPercentageMin: 30,
    sugarPercentageMax: 32,
    shelfLifeDaysMin: 38,
    shelfLifeDaysMax: 44,
    source: SOURCE,
    notes: 'Источник указывает диапазоны: сахара 30/32 %, срок 38/44 дня.',
  },
] as const;

/** Points ordered by water content — the axis the interpolation runs along. */
export const REFERENCE_POINTS_BY_WATER: readonly ShelfLifeReferencePoint[] = [
  ...SHELF_LIFE_REFERENCE_POINTS,
].sort((a, b) => a.waterPercentage - b.waterPercentage);

/**
 * The envelope the empirical data actually covers. Outside this range the
 * estimator refuses rather than extrapolating (spec §13 step 10).
 */
export const REFERENCE_ENVELOPE = {
  waterMin: REFERENCE_POINTS_BY_WATER[0].waterPercentage,
  waterMax: REFERENCE_POINTS_BY_WATER[REFERENCE_POINTS_BY_WATER.length - 1].waterPercentage,
  sugarMin: Math.min(...SHELF_LIFE_REFERENCE_POINTS.map((p) => p.sugarPercentageMin)),
  sugarMax: Math.max(...SHELF_LIFE_REFERENCE_POINTS.map((p) => p.sugarPercentageMax)),
} as const;

/** Mandatory disclaimer, shown wherever an estimate appears (spec §25). */
export const SHELF_LIFE_DISCLAIMER = {
  headline: 'Теоретическая оценка не является гарантированным сроком годности.',
  factorsIntro: 'Фактический срок зависит от:',
  factors: [
    'технологии приготовления',
    'температуры',
    'упаковки',
    'герметичности',
    'pH',
    'санитарных условий',
    'активности воды',
    'состава продукта',
    'условий хранения',
    'типа шоколадной оболочки',
    'миграции влаги',
    'других факторов',
  ],
  conclusion:
    'Для подтверждения фактического срока необходимы реальные испытания стабильности и микробиологические исследования.',
} as const;
