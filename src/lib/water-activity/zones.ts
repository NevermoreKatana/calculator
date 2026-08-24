/**
 * Microbiological zones on the water-activity scale (spec §19).
 *
 * Transcribed from the reference chart supplied by the user. The ranges are
 * reproduced as given, INCLUDING the deliberate overlap between
 * "0.80–0.87 — большинство плесеней" and "> 0.86 — Staphylococcus aureus"
 * (spec §20). They are not forced into mutually exclusive buckets, because on
 * the source chart they genuinely describe two different biological facts about
 * the same stretch of the scale.
 *
 * Boundary semantics are stated explicitly per zone rather than assumed, so a
 * value landing exactly on a boundary has one defined answer.
 *
 * KNOWN GAP IN THE SOURCE DATA: the chart lists "0.87–0.90" and then "0.91–0.95",
 * leaving 0.90 < a_w < 0.91 covered only by the open-ended "> 0.86" band. This
 * gap is preserved rather than closed by interpolation — see
 * docs/calculation-model.md §"Water activity zones".
 */

export type MicrobialRiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'severe';

export interface WaterActivityZone {
  id: string;
  /** Lower bound; `null` means unbounded below. */
  min: number | null;
  /** Upper bound; `null` means unbounded above. */
  max: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
  label: string;
  description: string;
  riskLevel: MicrobialRiskLevel;
  /** Verbatim range as printed on the source chart. */
  sourceRange: string;
}

export const WATER_ACTIVITY_ZONES: readonly WaterActivityZone[] = [
  {
    id: 'no_growth',
    min: null,
    max: 0.6,
    minInclusive: false,
    maxInclusive: false,
    label: 'Нет роста',
    description: 'Рост микроорганизмов не ожидается.',
    riskLevel: 'none',
    sourceRange: 'a_w < 0.60',
  },
  {
    id: 'osmophilic_yeasts',
    min: 0.6,
    max: 0.65,
    minInclusive: true,
    maxInclusive: false,
    label: 'Осмофильные дрожжи',
    description: 'Возможен рост осмофильных дрожжей.',
    riskLevel: 'low',
    sourceRange: '0.60–0.65',
  },
  {
    id: 'xerophilic_molds',
    min: 0.65,
    max: 0.75,
    minInclusive: true,
    maxInclusive: false,
    label: 'Ксерофильные плесени',
    description: 'Возможен рост ксерофильных плесеней.',
    riskLevel: 'low',
    sourceRange: '0.65–0.75',
  },
  {
    id: 'halophilic_bacteria',
    min: 0.75,
    max: 0.8,
    minInclusive: true,
    maxInclusive: false,
    label: 'Большинство галофильных бактерий',
    description: 'Возможен рост большинства галофильных бактерий.',
    riskLevel: 'moderate',
    sourceRange: '0.75–0.80',
  },
  {
    id: 'most_molds',
    min: 0.8,
    max: 0.87,
    minInclusive: true,
    maxInclusive: false,
    label: 'Большинство плесеней',
    description: 'Большинство плесеней. Рост патогенных бактерий не ожидается.',
    riskLevel: 'moderate',
    sourceRange: '0.80–0.87',
  },
  {
    id: 'staphylococcus_aureus_possible',
    min: 0.86,
    max: null,
    // Inclusive at 0.86. The source chart prints "> 0.86", but the worked
    // example in the specification places a_w = 0.86 in this zone, and for a
    // food-safety RISK FLAG the conservative reading is to trigger AT the
    // stated threshold rather than to declare 0.86 safe. Contrast with
    // `most_bacteria` below, whose threshold stays strict because 0.95 is the
    // explicit closing endpoint of the preceding 0.91–0.95 band.
    minInclusive: true,
    maxInclusive: false,
    label: 'Возможен рост Staphylococcus aureus',
    description:
      'Выше 0.86 возможен рост Staphylococcus aureus. Зона намеренно перекрывается с диапазоном 0.80–0.87.',
    riskLevel: 'high',
    sourceRange: '> 0.86',
  },
  {
    id: 'yeasts_and_mycotoxin_molds',
    min: 0.87,
    max: 0.9,
    minInclusive: true,
    maxInclusive: true,
    label: 'Большинство дрожжей, плесени, продуцирующие микотоксины',
    description: 'Большинство дрожжей и плесени, продуцирующие микотоксины.',
    riskLevel: 'high',
    sourceRange: '0.87–0.90',
  },
  {
    id: 'broad_bacterial_growth_risk',
    min: 0.91,
    max: 0.95,
    minInclusive: true,
    maxInclusive: true,
    label: 'Кокки, лактобациллы, Salmonella',
    description:
      'Большинство кокков, лактобацилл, некоторые плесени, Salmonella. Молочнокислые бактерии — основная флора порчи.',
    riskLevel: 'severe',
    sourceRange: '0.91–0.95',
  },
  {
    id: 'most_bacteria',
    min: 0.95,
    max: null,
    minInclusive: false,
    maxInclusive: false,
    label: 'Большинство бактерий',
    description:
      'Большинство бактерий, некоторые дрожжи; патогенные и портящие организмы.',
    riskLevel: 'severe',
    sourceRange: '> 0.95',
  },
] as const;

/** Domain of the a_w axis on the chart (spec §18). */
export const WATER_ACTIVITY_AXIS = { min: 0.4, max: 1.0 } as const;

export function zoneContains(zone: WaterActivityZone, aw: number): boolean {
  if (!Number.isFinite(aw)) return false;
  if (zone.min !== null) {
    if (zone.minInclusive ? aw < zone.min : aw <= zone.min) return false;
  }
  if (zone.max !== null) {
    if (zone.maxInclusive ? aw > zone.max : aw >= zone.max) return false;
  }
  return true;
}
