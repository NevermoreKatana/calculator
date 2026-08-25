/**
 * Microbiological growth limits (spec §18, §19).
 *
 * ── What changed relative to the transcribed chart ────────────────────────
 * The previous version of this application stored the bands copied off the
 * reference image supplied with the brief. Spec §18 asks for those values to be
 * treated as a PRELIMINARY dataset and checked against the literature. They
 * have been, and the check found real problems:
 *
 *   • The chart's "0.75–0.80 — большинство галофильных бактерий" band is not a
 *     confectionery-relevant statement at all. Halophiles are salt-adapted
 *     marine and fermented-fish organisms; nothing in a ganache selects for
 *     them. Retained for completeness, flagged as not applicable.
 *   • The chart has a gap: 0.90 < a_w < 0.91 belongs to no closed band.
 *   • The chart says nothing about the organisms that actually spoil ganache.
 *     The peer-reviewed ganache review (Lapčíková et al. 2024) names osmophilic
 *     yeasts and xerophilic moulds as the real agents, with Zygosaccharomyces
 *     rouxii the classic offender in sweet intermediate-moisture foods.
 *
 * So this module stores ORGANISM-LEVEL thresholds with sources and ranges,
 * exactly as spec §19 specifies, and the chart bands are derived from them for
 * display rather than being the primary data.
 *
 * ── Ranges, not points ────────────────────────────────────────────────────
 * Where sources disagree the disagreement is stored (spec §18: "если источники
 * дают диапазоны — хранить диапазоны"). `minimumAw` is the lowest a_w at which
 * growth has been reported; `minimumAwRange` records the spread across sources.
 */

import type { EvidenceStatus } from './confidence';

export type OrganismGroup =
  | 'pathogenic_bacteria'
  | 'spoilage_bacteria'
  | 'lactic_acid_bacteria'
  | 'yeasts'
  | 'osmophilic_yeasts'
  | 'molds'
  | 'xerophilic_molds'
  | 'halophilic_bacteria';

export const ORGANISM_GROUP_LABELS: Record<OrganismGroup, string> = {
  pathogenic_bacteria: 'Патогенные бактерии',
  spoilage_bacteria: 'Бактерии порчи',
  lactic_acid_bacteria: 'Молочнокислые бактерии',
  yeasts: 'Дрожжи',
  osmophilic_yeasts: 'Осмофильные дрожжи',
  molds: 'Плесени',
  xerophilic_molds: 'Ксерофильные плесени',
  halophilic_bacteria: 'Галофильные бактерии',
};

/** Whether the organism is a safety hazard or a quality (spoilage) problem. */
export type HazardKind = 'safety' | 'spoilage';

export interface MicrobialGrowthThreshold {
  id: string;
  /** Latin name, or a group name when the entry describes a group. */
  organism: string;
  organismRu: string;
  group: OrganismGroup;
  hazard: HazardKind;

  /** Lowest a_w at which growth is documented. */
  minimumAw: number;
  /** Spread across sources; equals [minimumAw, minimumAw] when they agree. */
  minimumAwRange: [number, number];
  /** a_w at which growth is fastest, when reported. */
  optimumAw: number | null;

  /** Minimum pH for growth, when reported. */
  minimumPH: number | null;
  /** pH range over which growth occurs. */
  pHRange: [number, number] | null;

  /** Temperature range for growth, °C. */
  temperatureRangeC: [number, number] | null;

  sourceIds: string[];
  status: EvidenceStatus;
  /** Whether this organism is a realistic concern in a ganache / chocolate filling. */
  relevantToConfectionery: boolean;
  note: string;
}

export const MICROBIAL_GROWTH_THRESHOLDS: readonly MicrobialGrowthThreshold[] = [
  // ── The organisms that actually spoil ganache ──────────────────────────
  {
    id: 'zygosaccharomyces-rouxii',
    organism: 'Zygosaccharomyces rouxii',
    organismRu: 'Zygosaccharomyces rouxii (осмофильные дрожжи)',
    group: 'osmophilic_yeasts',
    hazard: 'spoilage',
    minimumAw: 0.62,
    minimumAwRange: [0.62, 0.65],
    optimumAw: null,
    minimumPH: 1.8,
    pHRange: [1.8, 8.0],
    temperatureRangeC: [4, 40],
    sourceIds: ['pitt-hocking-fungi', 'vanderveken-2014-zrouxii-imf', 'vermeulen-2012-zrouxii', 'lapcikova-2024-ganache'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note:
      'Наиболее осмотолерантные дрожжи высокосахаристых продуктов и главный организм порчи сладких продуктов промежуточной влажности — то есть именно ганаша и начинок. Даёт газообразование, из-за которого трескается шоколадная оболочка. Влияние pH в диапазоне 2.5–4.0 практически отсутствует (Vermeulen et al.), поэтому подкисление ганаша против него не работает.',
  },
  {
    id: 'xeromyces-bisporus',
    organism: 'Xeromyces bisporus',
    organismRu: 'Xeromyces bisporus (крайне ксерофильная плесень)',
    group: 'xerophilic_molds',
    hazard: 'spoilage',
    minimumAw: 0.61,
    minimumAwRange: [0.605, 0.62],
    optimumAw: 0.88,
    minimumPH: null,
    pHRange: null,
    temperatureRangeC: [5, 42],
    sourceIds: ['pitt-hocking-fungi'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note:
      'Абсолютный известный предел роста среди пищевых микроорганизмов. КРИТИЧЕСКИ ВАЖНО: при a_w = 0.61 прорастание занимает около 120 суток. То есть «может расти» и «успеет вырасти за срок годности» — разные утверждения, и именно поэтому стабильность имеет смысл только применительно к конкретному сроку.',
  },
  {
    id: 'xerophilic-molds-general',
    organism: 'Eurotium spp., Aspergillus restrictus, Wallemia sebi',
    organismRu: 'Ксерофильные плесени (общая группа)',
    group: 'xerophilic_molds',
    hazard: 'spoilage',
    minimumAw: 0.65,
    minimumAwRange: [0.65, 0.71],
    optimumAw: 0.9,
    minimumPH: 2.0,
    pHRange: [2.0, 8.5],
    temperatureRangeC: [5, 40],
    sourceIds: ['pitt-hocking-fungi', 'lapcikova-2024-ganache'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note:
      'Практический предел роста обычных плесеней порчи — около 0.70; ниже растут только ксерофилы. Видимая плесень между начинкой и шоколадной оболочкой — характерный дефект.',
  },
  {
    id: 'osmophilic-yeasts-general',
    organism: 'Zygosaccharomyces spp., Schizosaccharomyces, Debaryomyces',
    organismRu: 'Осмофильные дрожжи (общая группа)',
    group: 'osmophilic_yeasts',
    hazard: 'spoilage',
    minimumAw: 0.6,
    minimumAwRange: [0.6, 0.65],
    optimumAw: null,
    minimumPH: 1.8,
    pHRange: [1.8, 8.0],
    temperatureRangeC: [4, 40],
    sourceIds: ['pitt-hocking-fungi', 'scott-1953-aw'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note: 'Порог 0.60 — общепринятая нижняя граница роста осмофильных дрожжей.',
  },
  {
    id: 'ordinary-yeasts',
    organism: 'Saccharomyces cerevisiae и обычные дрожжи',
    organismRu: 'Обычные (неосмофильные) дрожжи',
    group: 'yeasts',
    hazard: 'spoilage',
    minimumAw: 0.87,
    minimumAwRange: [0.85, 0.88],
    optimumAw: 0.99,
    minimumPH: 2.0,
    pHRange: [2.0, 8.5],
    temperatureRangeC: [0, 45],
    sourceIds: ['scott-1953-aw', 'icmsf-1996-microbial-ecology'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note: 'Ферментация с газообразованием; во влажном ганаше проявляется быстро.',
  },
  {
    id: 'ordinary-molds',
    organism: 'Penicillium, Aspergillus, Cladosporium',
    organismRu: 'Обычные плесени',
    group: 'molds',
    hazard: 'spoilage',
    minimumAw: 0.8,
    minimumAwRange: [0.78, 0.8],
    optimumAw: 0.98,
    minimumPH: 1.5,
    pHRange: [1.5, 9.0],
    temperatureRangeC: [-5, 40],
    sourceIds: ['scott-1953-aw', 'pitt-hocking-fungi'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note:
      'Некоторые виды продуцируют микотоксины; для токсинообразования обычно требуется более высокая a_w, чем для роста.',
  },

  // ── Pathogens: the safety question ─────────────────────────────────────
  {
    id: 'staphylococcus-aureus-aerobic',
    organism: 'Staphylococcus aureus (аэробные условия, рост)',
    organismRu: 'Staphylococcus aureus — рост',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.83,
    minimumAwRange: [0.83, 0.86],
    optimumAw: 0.98,
    minimumPH: 4.0,
    pHRange: [4.0, 10.0],
    temperatureRangeC: [7, 48],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology', 'scott-1953-aw'],
    status: 'validated',
    relevantToConfectionery: true,
    note:
      'Самый устойчивый к низкой a_w патоген и потому определяющий для безопасности. ВАЖНОЕ УТОЧНЕНИЕ, которого не было на исходном графике: 0.86 — предел роста в АНАЭРОБНЫХ условиях, тогда как в аэробных рост описан от 0.83. Внутри шоколадной оболочки условия ближе к аэробным на поверхности начинки. Порог FDA a_w ≤ 0.85 относится именно к этому организму.',
  },
  {
    id: 'staphylococcus-aureus-toxin',
    organism: 'Staphylococcus aureus (образование энтеротоксина)',
    organismRu: 'Staphylococcus aureus — образование токсина',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.87,
    minimumAwRange: [0.86, 0.9],
    optimumAw: 0.98,
    minimumPH: 4.5,
    pHRange: [4.5, 9.6],
    temperatureRangeC: [10, 46],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note:
      'Токсинообразование требует более высокой a_w, чем сам рост. Различие существенно: рост без токсина не создаёт немедленной опасности отравления, но токсин термостабилен и не разрушается при последующем нагреве.',
  },
  {
    id: 'salmonella',
    organism: 'Salmonella spp.',
    organismRu: 'Salmonella spp.',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.94,
    minimumAwRange: [0.92, 0.95],
    optimumAw: 0.99,
    minimumPH: 3.7,
    pHRange: [3.7, 9.5],
    temperatureRangeC: [5.2, 46.2],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology'],
    status: 'validated',
    relevantToConfectionery: true,
    note:
      'РОСТ требует a_w ≥ 0.94, но ВЫЖИВАНИЕ в шоколаде при низкой a_w исключительно длительное, а инфицирующая доза в жировой матрице очень мала. Поэтому Salmonella в шоколаде — вопрос гигиены сырья и производства, а не расчёта a_w. Наша модель не может его закрыть.',
  },
  {
    id: 'listeria-monocytogenes',
    organism: 'Listeria monocytogenes',
    organismRu: 'Listeria monocytogenes',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.92,
    minimumAwRange: [0.9, 0.93],
    optimumAw: 0.97,
    minimumPH: 4.4,
    pHRange: [4.4, 9.4],
    temperatureRangeC: [-0.4, 45],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology', 'lapcikova-2024-ganache'],
    status: 'validated',
    relevantToConfectionery: true,
    note: 'Растёт при холодильных температурах, поэтому охлаждение само по себе не является барьером.',
  },
  {
    id: 'bacillus-cereus',
    organism: 'Bacillus cereus',
    organismRu: 'Bacillus cereus',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.93,
    minimumAwRange: [0.92, 0.93],
    optimumAw: 0.98,
    minimumPH: 4.3,
    pHRange: [4.3, 9.3],
    temperatureRangeC: [4, 55],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology'],
    status: 'validated',
    relevantToConfectionery: true,
    note: 'Споровая форма переживает тепловую обработку сливок.',
  },
  {
    id: 'clostridium-botulinum-ab',
    organism: 'Clostridium botulinum types A, B (proteolytic)',
    organismRu: 'Clostridium botulinum типы A, B',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.935,
    minimumAwRange: [0.93, 0.94],
    optimumAw: 0.99,
    minimumPH: 4.6,
    pHRange: [4.6, 9.0],
    temperatureRangeC: [10, 48],
    sourceIds: ['fda-food-code-ch3', 'icmsf-1996-microbial-ecology'],
    status: 'validated',
    relevantToConfectionery: true,
    note:
      'Строгий анаэроб. В герметично упакованной начинке с высокой a_w и pH выше 4.6 теоретически возможен; в ганаше нормального состава a_w значительно ниже порога.',
  },
  {
    id: 'escherichia-coli-o157',
    organism: 'Escherichia coli O157:H7',
    organismRu: 'Escherichia coli O157:H7',
    group: 'pathogenic_bacteria',
    hazard: 'safety',
    minimumAw: 0.95,
    minimumAwRange: [0.95, 0.95],
    optimumAw: 0.99,
    minimumPH: 4.0,
    pHRange: [4.0, 9.0],
    temperatureRangeC: [6.5, 49.4],
    sourceIds: ['fda-food-code-ch3'],
    status: 'validated',
    relevantToConfectionery: true,
    note: 'Рост требует высокой a_w; как и Salmonella, значим прежде всего как вопрос выживания и гигиены.',
  },

  // ── Spoilage bacteria ──────────────────────────────────────────────────
  {
    id: 'lactic-acid-bacteria',
    organism: 'Lactobacillus, Leuconostoc',
    organismRu: 'Молочнокислые бактерии',
    group: 'lactic_acid_bacteria',
    hazard: 'spoilage',
    minimumAw: 0.9,
    minimumAwRange: [0.9, 0.94],
    optimumAw: 0.99,
    minimumPH: 3.2,
    pHRange: [3.2, 8.0],
    temperatureRangeC: [4, 45],
    sourceIds: ['icmsf-1996-microbial-ecology', 'scott-1953-aw'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note: 'Основная флора порчи молочных начинок: скисание, газообразование, ослизнение.',
  },
  {
    id: 'most-spoilage-bacteria',
    organism: 'Большинство бактерий порчи',
    organismRu: 'Большинство бактерий порчи',
    group: 'spoilage_bacteria',
    hazard: 'spoilage',
    minimumAw: 0.91,
    minimumAwRange: [0.9, 0.95],
    optimumAw: 0.99,
    minimumPH: 4.5,
    pHRange: [4.5, 9.0],
    temperatureRangeC: [0, 45],
    sourceIds: ['scott-1953-aw', 'icmsf-1996-microbial-ecology'],
    status: 'well_supported',
    relevantToConfectionery: true,
    note: 'Классический порог Скотта: большинство бактерий не растут ниже a_w ≈ 0.90.',
  },
  {
    id: 'halophilic-bacteria',
    organism: 'Галофильные бактерии',
    organismRu: 'Галофильные бактерии',
    group: 'halophilic_bacteria',
    hazard: 'spoilage',
    minimumAw: 0.75,
    minimumAwRange: [0.75, 0.75],
    optimumAw: null,
    minimumPH: null,
    pHRange: null,
    temperatureRangeC: null,
    sourceIds: ['scott-1953-aw'],
    status: 'well_supported',
    relevantToConfectionery: false,
    note:
      'Присутствует на исходном графике, но НЕ РЕЛЕВАНТЕН для кондитерских изделий: галофилы адаптированы к высоким концентрациям СОЛИ, а не сахара. В ганаше среда, понижающая a_w, — сахар, и она их не отбирает. Строка сохранена для полноты и помечена как неприменимая.',
  },
] as const;

/**
 * Organisms that could grow at a given a_w, optionally filtered by pH and
 * temperature.
 *
 * This answers "what COULD grow", not "what WILL grow" and certainly not "how
 * fast". A threshold crossed means the barrier is absent, not that spoilage is
 * imminent (see Xeromyces bisporus: 120 days to germinate at its own limit).
 */
export interface GrowthRiskQuery {
  waterActivity: number;
  pH?: number | null;
  temperatureCelsius?: number | null;
  /** When true, drop organisms flagged as irrelevant to confectionery. */
  confectioneryOnly?: boolean;
}

export interface GrowthRiskEntry {
  threshold: MicrobialGrowthThreshold;
  /** a_w permits growth. */
  awPermits: boolean;
  /** pH permits growth, or null when pH is unknown or the organism has no limit. */
  pHPermits: boolean | null;
  /** Temperature permits growth, or null when unknown. */
  temperaturePermits: boolean | null;
  /** Every known barrier is absent → growth is possible. */
  growthPossible: boolean;
  /** a_w lies inside the between-sources disagreement band. */
  withinSourceDisagreement: boolean;
}

export function assessGrowthRisk(query: GrowthRiskQuery): GrowthRiskEntry[] {
  const { waterActivity: aw, pH, temperatureCelsius: temp } = query;

  return MICROBIAL_GROWTH_THRESHOLDS.filter(
    (t) => !query.confectioneryOnly || t.relevantToConfectionery,
  ).map((threshold) => {
    const awPermits = Number.isFinite(aw) && aw >= threshold.minimumAw;

    const withinSourceDisagreement =
      Number.isFinite(aw) &&
      aw >= threshold.minimumAwRange[0] &&
      aw < threshold.minimumAwRange[1];

    let pHPermits: boolean | null = null;
    if (typeof pH === 'number' && Number.isFinite(pH) && threshold.pHRange) {
      pHPermits = pH >= threshold.pHRange[0] && pH <= threshold.pHRange[1];
    }

    let temperaturePermits: boolean | null = null;
    if (typeof temp === 'number' && Number.isFinite(temp) && threshold.temperatureRangeC) {
      temperaturePermits = temp >= threshold.temperatureRangeC[0] && temp <= threshold.temperatureRangeC[1];
    }

    const growthPossible = awPermits && pHPermits !== false && temperaturePermits !== false;

    return { threshold, awPermits, pHPermits, temperaturePermits, growthPossible, withinSourceDisagreement };
  });
}

/** The lowest a_w at which anything relevant can grow — the design target. */
export function lowestRelevantGrowthAw(confectioneryOnly = true): number {
  const relevant = MICROBIAL_GROWTH_THRESHOLDS.filter(
    (t) => !confectioneryOnly || t.relevantToConfectionery,
  );
  return Math.min(...relevant.map((t) => t.minimumAw));
}

/** Lowest a_w at which a SAFETY (pathogen) hazard becomes possible. */
export function lowestPathogenGrowthAw(): number {
  return Math.min(
    ...MICROBIAL_GROWTH_THRESHOLDS.filter((t) => t.hazard === 'safety').map((t) => t.minimumAw),
  );
}
