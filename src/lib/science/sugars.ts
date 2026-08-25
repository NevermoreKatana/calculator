/**
 * Sugar speciation (spec §11).
 *
 * The premise of this module is that "30 % sugar" is not a physico-chemical
 * quantity. Per gram, different sugars depress water activity by very
 * different amounts, because the depression depends on MOLES (and on the
 * Norrish interaction constant), not on mass:
 *
 *   1 g sucrose      → 1/342.3 mol = 0.00292 mol, K = 6.47
 *   1 g invert sugar → 1/180.2 mol = 0.00555 mol, K = 2.25
 *
 * Invert sugar puts ~1.9× more particles into the water phase per gram. Even
 * with its lower K it is the stronger a_w depressant per gram — which is
 * exactly why confectioners add it, and exactly what a single "sugar %" column
 * cannot express.
 *
 * The imported Excel database has one aggregate "сахара" column, so this
 * module supplies a SPECIATION LAYER: a per-ingredient breakdown of that
 * aggregate into named species. Profiles come from reference composition data,
 * not from guesses, and every profile records its own confidence.
 */

import { MOLAR_MASS, NORRISH_CONSTANTS, GLUCOSE_SYRUP_NORRISH_K, DEXTROSE_EQUIVALENT_NUMERATOR } from './constants';
import type { EvidenceStatus } from './confidence';

/**
 * Species tracked by the water-activity model.
 *
 * `glucoseSyrupSolids` is not a molecule but a pseudo-species: a mixture whose
 * effective molar mass is derived from its DE (see molarMassOfSpecies).
 */
export const SUGAR_SPECIES = [
  'sucrose',
  'glucose',
  'fructose',
  'lactose',
  'maltose',
  'sorbitol',
  'glycerol',
  'glucoseSyrupSolids',
] as const;

export type SugarSpecies = (typeof SUGAR_SPECIES)[number];

export const SUGAR_SPECIES_LABELS: Record<SugarSpecies, string> = {
  sucrose: 'Сахароза',
  glucose: 'Глюкоза (декстроза)',
  fructose: 'Фруктоза',
  lactose: 'Лактоза',
  maltose: 'Мальтоза',
  sorbitol: 'Сорбит',
  glycerol: 'Глицерин',
  glucoseSyrupSolids: 'Сухие вещества глюкозного сиропа',
};

/**
 * Fractions of an ingredient's TOTAL SUGAR mass assigned to each species.
 * Must sum to 1 (validated by validateSugarProfile).
 */
export type SugarSpeciesFractions = Partial<Record<SugarSpecies, number>>;

export interface SugarProfile {
  fractions: SugarSpeciesFractions;
  /**
   * Dextrose equivalent, required when `glucoseSyrupSolids` is present and
   * ignored otherwise.
   */
  dextroseEquivalent?: number;
  status: EvidenceStatus;
  sourceIds: string[];
  note: string;
}

/**
 * Effective molar mass of a species, g/mol.
 *
 * For glucose syrup solids this is derived from DE rather than looked up:
 *   M_n = 18015.6 / DE
 * A DE 40 syrup gives M_n ≈ 450 g/mol; DE 60 gives ≈ 300 g/mol. Lower DE means
 * longer chains, fewer moles per gram, and therefore LESS a_w depression per
 * gram — the physically correct direction, and the reason the app must know
 * the DE rather than treating all "glucose syrup" alike.
 */
export function molarMassOfSpecies(species: SugarSpecies, dextroseEquivalent?: number): number {
  if (species !== 'glucoseSyrupSolids') {
    return MOLAR_MASS[species];
  }
  if (
    typeof dextroseEquivalent !== 'number' ||
    !Number.isFinite(dextroseEquivalent) ||
    dextroseEquivalent <= 0 ||
    dextroseEquivalent > 100
  ) {
    throw new Error(
      `glucoseSyrupSolids requires a dextrose equivalent in (0, 100]; received ${String(dextroseEquivalent)}`,
    );
  }
  return DEXTROSE_EQUIVALENT_NUMERATOR.value / dextroseEquivalent;
}

/** Norrish K for a species, in the a_w = X_w·exp(−K·X_s²) convention. */
export function norrishKOfSpecies(species: SugarSpecies): number {
  if (species === 'glucoseSyrupSolids') return GLUCOSE_SYRUP_NORRISH_K.value;
  return NORRISH_CONSTANTS[species].k;
}

export interface SugarProfileValidation {
  valid: boolean;
  sum: number;
  problems: string[];
}

/** Fractions must sum to 1 within this tolerance. */
const PROFILE_SUM_TOLERANCE = 1e-6;

export function validateSugarProfile(profile: SugarProfile): SugarProfileValidation {
  const problems: string[] = [];
  let sum = 0;

  for (const [species, fraction] of Object.entries(profile.fractions)) {
    if (typeof fraction !== 'number' || !Number.isFinite(fraction)) {
      problems.push(`Доля вида «${species}» не является конечным числом.`);
      continue;
    }
    if (fraction < 0) problems.push(`Доля вида «${species}» отрицательна.`);
    sum += fraction;
  }

  if (Math.abs(sum - 1) > PROFILE_SUM_TOLERANCE) {
    problems.push(`Сумма долей = ${sum.toFixed(6)}, должна быть 1.`);
  }

  if (profile.fractions.glucoseSyrupSolids && profile.fractions.glucoseSyrupSolids > 0) {
    const de = profile.dextroseEquivalent;
    if (typeof de !== 'number' || !Number.isFinite(de) || de <= 0 || de > 100) {
      problems.push('Профиль содержит сухие вещества глюкозного сиропа, но DE не задан или вне (0, 100].');
    }
  }

  return { valid: problems.length === 0, sum, problems };
}

// ──────────────────────────────────────────────────────────────────────────
// Reference profiles
// ──────────────────────────────────────────────────────────────────────────

/**
 * Named reference profiles.
 *
 * Each profile answers: "of the sugar mass in this ingredient, what fraction
 * is each species?" — NOT "how much sugar does the ingredient contain". The
 * latter already comes from the imported composition database.
 */
export const SUGAR_PROFILES = {
  /** Crystalline sucrose, and the sugar in chocolate, which is added as sucrose. */
  pureSucrose: {
    fractions: { sucrose: 1 },
    status: 'validated' as EvidenceStatus,
    sourceIds: ['usda-fdc'],
    note: 'Сахар-песок и сахар, внесённый в шоколад, — сахароза.',
  },

  /** Dextrose monohydrate / anhydrous dextrose sold as "sugar dextrose". */
  pureDextrose: {
    fractions: { glucose: 1 },
    status: 'validated' as EvidenceStatus,
    sourceIds: ['usda-fdc'],
    note: 'Декстроза — чистая глюкоза.',
  },

  /**
   * Invert sugar: sucrose hydrolysed to equal moles of glucose and fructose.
   * The mass split is 50/50 because the two products are isomers.
   */
  invertSugar: {
    fractions: { glucose: 0.5, fructose: 0.5 },
    status: 'validated' as EvidenceStatus,
    sourceIds: ['usda-fdc', 'money-born-1951'],
    note:
      'Полная инверсия даёт равные МОЛЯРНЫЕ количества глюкозы и фруктозы, а так как это изомеры — и равные массовые. Товарный инвертный сироп обычно инвертирован не полностью; остаточную сахарозу этот профиль не учитывает, что слегка ЗАВЫШАЕТ понижение a_w.',
  },

  /** Glucose syrup, DE 40 — long chains, low sweetness, strong anti-crystallising. */
  glucoseSyrup40DE: {
    fractions: { glucoseSyrupSolids: 1 },
    dextroseEquivalent: 40,
    status: 'approximate' as EvidenceStatus,
    sourceIds: ['de-molecular-weight', 'money-born-1951'],
    note: 'M_n ≈ 450 г/моль. Псевдо-компонент со средней молярной массой из DE.',
  },

  /** Glucose syrup, DE 60 — shorter chains, more monosaccharide, lowers a_w more. */
  glucoseSyrup60DE: {
    fractions: { glucoseSyrupSolids: 1 },
    dextroseEquivalent: 60,
    status: 'approximate' as EvidenceStatus,
    sourceIds: ['de-molecular-weight', 'money-born-1951'],
    note: 'M_n ≈ 300 г/моль. Понижает a_w заметно сильнее сиропа DE 40 при равной массе.',
  },

  pureSorbitol: {
    fractions: { sorbitol: 1 },
    status: 'well_supported' as EvidenceStatus,
    sourceIds: ['fao-y4358e-ch4'],
    note:
      'Сорбит применяется как влагоудерживающий агент. Выше ≈60 % масс. в водной фазе константа Норриша для сорбита теряет точность (Baeza et al. 2010).',
  },

  /**
   * Dairy sugar is lactose. Cream 35 % fat carries ≈3 % lactose of its own
   * mass; whatever the composition table records as "sugar" for a dairy
   * ingredient is lactose.
   */
  dairyLactose: {
    fractions: { lactose: 1 },
    status: 'well_supported' as EvidenceStatus,
    sourceIds: ['usda-fdc'],
    note:
      'Сахар молочных продуктов — лактоза. ВАЖНО: растворимость лактозы ≈20 г/100 г воды при 25 °C, поэтому в концентрированной водной фазе ганаша часть лактозы кристаллична и не понижает a_w. Это учитывается в aqueous-phase.ts.',
  },

  /**
   * Typical fruit: roughly equal glucose and fructose with a smaller sucrose
   * share. Berries sit near this; stone fruit carries more sucrose.
   */
  fruitTypical: {
    fractions: { glucose: 0.35, fructose: 0.4, sucrose: 0.25 },
    status: 'approximate' as EvidenceStatus,
    sourceIds: ['usda-fdc', 'ciqual-anses'],
    note:
      'Усреднённый профиль. Реальное соотношение сильно зависит от вида и зрелости плода: у цитрусовых сахароза доминирует (глюкоза:фруктоза:сахароза ≈ 1:1:2), у ягод преобладают моносахариды. Профиль помечен как приближённый и подлежит замене на данные конкретного пюре.',
  },

  /** Honey: fructose-dominant invert-type profile. */
  honey: {
    fractions: { fructose: 0.5, glucose: 0.44, sucrose: 0.06 },
    status: 'approximate' as EvidenceStatus,
    sourceIds: ['usda-fdc'],
    note: 'Усреднённый состав мёда; варьирует по ботаническому происхождению.',
  },
} as const satisfies Record<string, SugarProfile>;

export type SugarProfileId = keyof typeof SUGAR_PROFILES;

/**
 * Grams of each species contributed by an ingredient line.
 *
 * @param sugarGrams total sugar mass of the line, in grams
 */
export function speciateSugar(
  sugarGrams: number,
  profile: SugarProfile,
): { species: SugarSpecies; grams: number; molarMass: number; norrishK: number }[] {
  if (!Number.isFinite(sugarGrams) || sugarGrams <= 0) return [];

  const out: { species: SugarSpecies; grams: number; molarMass: number; norrishK: number }[] = [];
  for (const species of SUGAR_SPECIES) {
    const fraction = profile.fractions[species];
    if (typeof fraction !== 'number' || fraction <= 0) continue;
    out.push({
      species,
      grams: sugarGrams * fraction,
      molarMass: molarMassOfSpecies(species, profile.dextroseEquivalent),
      norrishK: norrishKOfSpecies(species),
    });
  }
  return out;
}

/**
 * Moles of a_w-active particles per gram of a species.
 *
 * Exposed because it is the single number that explains why sugar composition
 * matters, and the UI shows it to make the point concrete.
 */
export function molesPerGram(species: SugarSpecies, dextroseEquivalent?: number): number {
  return 1 / molarMassOfSpecies(species, dextroseEquivalent);
}
