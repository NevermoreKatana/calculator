/**
 * The aqueous phase of a ganache (spec §15).
 *
 * ── Why this module exists ────────────────────────────────────────────────
 * Water activity is a property of the WATER PHASE, not of the whole product.
 * A ganache is an oil-in-water emulsion (Lapčíková et al. 2024): cocoa butter,
 * milk fat and cocoa particles form a disperse phase that contains essentially
 * no water and dissolves essentially nothing. Putting fat into the mole balance
 * would dilute the solutes and predict an a_w that is too HIGH — a dangerous
 * error direction for a food-safety tool.
 *
 * So the model separates the recipe into:
 *   • water                       → solvent
 *   • dissolved solutes           → sugars, polyols, salt, ethanol, acids
 *   • non-solute solids           → fat, cocoa particles, protein, fibre
 *
 * and computes a_w from the first two only. The third group is not ignored —
 * it is reported, and its known second-order effect (water bound to protein
 * and polysaccharide) is stated as a limitation rather than silently modelled
 * with an invented coefficient.
 *
 * ── The saturation problem ────────────────────────────────────────────────
 * Crystalline sugar does not lower water activity; only DISSOLVED sugar does.
 * At 20 °C a saturated sucrose solution is 67.1 % by mass, and a well-made
 * ganache sits close to that. Sugar in excess of saturation is treated as
 * crystalline and excluded from the mole balance, with a warning — because a
 * recipe past saturation is also a recipe at risk of graining.
 *
 * Lactose matters here too: its solubility is only ~20 g/100 g water, so in a
 * concentrated ganache water phase most lactose is undissolved and contributes
 * far less to a_w depression than its mass suggests.
 */

import {
  MOLAR_MASS,
  SUCROSE_SOLUBILITY_PERCENT_BY_TEMPERATURE,
  DEFAULT_PRODUCT_TEMPERATURE,
} from './constants';
import {
  molarMassOfSpecies,
  norrishKOfSpecies,
  speciateSugar,
  type SugarSpecies,
  type SugarProfile,
} from './sugars';

/**
 * Lactose solubility, g per 100 g water at 25 °C.
 *
 * Lactose is by far the least soluble common food sugar. In a ganache water
 * phase already crowded with sucrose this limit is reached easily, and the
 * undissolved remainder is the classic cause of a sandy mouthfeel.
 */
export const LACTOSE_SOLUBILITY_G_PER_100G_WATER = {
  value: 21.6,
  unit: 'г лактозы на 100 г воды при 25 °C',
  sourceIds: ['usda-fdc', 'sucrose-solubility'],
  status: 'approximate' as const,
  note:
    'Растворимость лактозы сильно зависит от α/β-равновесия и температуры; 21.6 г/100 г — общепринятое значение для 25 °C. Используется как порог, ниже которого лактоза считается растворённой.',
};

/** One dissolved species in the water phase. */
export interface DissolvedSolute {
  species: SugarSpecies | 'ethanol' | 'sodiumChloride';
  label: string;
  /** Mass actually dissolved, g. */
  grams: number;
  /** Mass present but crystalline / undissolved, g. */
  undissolvedGrams: number;
  molarMass: number;
  moles: number;
  norrishK: number;
  /** Mole fraction over water + all dissolved solutes. */
  moleFraction: number;
}

export interface AqueousPhase {
  /** Water mass, g. */
  waterGrams: number;
  /** Total mass of dissolved solutes, g. */
  dissolvedSolutesGrams: number;
  /** Mass present but not dissolved (crystalline sugar), g. */
  undissolvedSolutesGrams: number;
  /** Mass of the water phase itself: water + dissolved solutes, g. */
  phaseMassGrams: number;
  /** Mass of everything that is neither water nor a dissolved solute, g. */
  nonSoluteSolidsGrams: number;

  waterMoles: number;
  soluteMoles: number;
  /** Mole fraction of water in the aqueous phase. */
  waterMoleFraction: number;

  /**
   * Dissolved solids as percent of the aqueous phase mass.
   *
   * This is a TRUE °Brix only for a pure sucrose solution — °Brix is defined
   * as g sucrose per 100 g solution. For a mixed-sugar water phase it is
   * "dissolved solids, % of water phase", which is what a refractometer
   * approximates. Named explicitly to avoid the confusion spec §12 warns about.
   */
  dissolvedSolidsPercent: number;

  solutes: DissolvedSolute[];
  temperatureCelsius: number;
  warnings: AqueousPhaseWarning[];
}

export interface AqueousPhaseWarning {
  code:
    | 'no_water'
    | 'sucrose_supersaturated'
    | 'lactose_supersaturated'
    | 'no_solutes'
    | 'unspeciated_sugar';
  message: string;
}

/** Linear interpolation of sucrose solubility at a given temperature. */
export function sucroseSolubilityPercent(temperatureCelsius: number): number {
  const table = SUCROSE_SOLUBILITY_PERCENT_BY_TEMPERATURE.value;
  const first = table[0];
  const last = table[table.length - 1];
  if (temperatureCelsius <= first.temperatureCelsius) return first.percentByMass;
  if (temperatureCelsius >= last.temperatureCelsius) return last.percentByMass;

  for (let i = 0; i < table.length - 1; i += 1) {
    const a = table[i];
    const b = table[i + 1];
    if (temperatureCelsius >= a.temperatureCelsius && temperatureCelsius <= b.temperatureCelsius) {
      const t = (temperatureCelsius - a.temperatureCelsius) / (b.temperatureCelsius - a.temperatureCelsius);
      return a.percentByMass + t * (b.percentByMass - a.percentByMass);
    }
  }
  return last.percentByMass;
}

/** One recipe line, already reduced to the quantities this model needs. */
export interface AqueousPhaseContribution {
  waterGrams: number;
  sugarGrams: number;
  /** null when the ingredient's sugar species could not be resolved. */
  sugarProfile: SugarProfile | null;
  /** Non-water, non-sugar mass: fat, cocoa solids, protein, fibre. */
  nonSoluteSolidsGrams: number;
  /** Ethanol mass, g — a real a_w depressant in alcohol-containing ganache. */
  ethanolGrams?: number;
  /** Salt mass, g. */
  sodiumChlorideGrams?: number;
}

export interface BuildAqueousPhaseOptions {
  temperatureCelsius?: number;
}

/**
 * Builds the aqueous phase from recipe contributions.
 *
 * Dimensional check (spec §39): all inputs are GRAMS, molar masses are g/mol,
 * so moles = g / (g/mol) is dimensionless-correct, and mole fractions are
 * ratios of moles. No percentages enter the mole balance.
 */
export function buildAqueousPhase(
  contributions: readonly AqueousPhaseContribution[],
  options: BuildAqueousPhaseOptions = {},
): AqueousPhase {
  const temperatureCelsius = options.temperatureCelsius ?? DEFAULT_PRODUCT_TEMPERATURE.value;
  const warnings: AqueousPhaseWarning[] = [];

  let waterGrams = 0;
  let nonSoluteSolidsGrams = 0;
  let ethanolGrams = 0;
  let sodiumChlorideGrams = 0;
  let unspeciatedSugarGrams = 0;

  // Accumulate sugar mass per species across all lines.
  const speciesGrams = new Map<SugarSpecies, number>();
  const speciesMolarMass = new Map<SugarSpecies, number>();

  for (const c of contributions) {
    waterGrams += Math.max(0, c.waterGrams);
    nonSoluteSolidsGrams += Math.max(0, c.nonSoluteSolidsGrams);
    ethanolGrams += Math.max(0, c.ethanolGrams ?? 0);
    sodiumChlorideGrams += Math.max(0, c.sodiumChlorideGrams ?? 0);

    if (c.sugarGrams <= 0) continue;

    if (!c.sugarProfile) {
      // Sugar of unknown species: counted as mass, excluded from the mole
      // balance, and surfaced as a confidence penalty rather than guessed at.
      unspeciatedSugarGrams += c.sugarGrams;
      nonSoluteSolidsGrams += c.sugarGrams;
      continue;
    }

    for (const part of speciateSugar(c.sugarGrams, c.sugarProfile)) {
      speciesGrams.set(part.species, (speciesGrams.get(part.species) ?? 0) + part.grams);
      speciesMolarMass.set(part.species, part.molarMass);
    }
  }

  if (unspeciatedSugarGrams > 0) {
    warnings.push({
      code: 'unspeciated_sugar',
      message: `${unspeciatedSugarGrams.toFixed(1)} г сахаров не удалось отнести к конкретному виду. Эта масса исключена из расчёта активности воды, поэтому оценка a_w занижена по своей осмотической силе и её уверенность понижена.`,
    });
  }

  if (waterGrams <= 0) {
    warnings.push({
      code: 'no_water',
      message: 'В рецепте нет воды: водная фаза отсутствует, активность воды не определена.',
    });
  }

  // ── Solubility limits ──────────────────────────────────────────────────
  // Applied to sucrose and lactose, the two species that realistically
  // saturate in a ganache water phase.
  const sucroseTotal = speciesGrams.get('sucrose') ?? 0;
  const lactoseTotal = speciesGrams.get('lactose') ?? 0;

  let sucroseUndissolved = 0;
  let lactoseUndissolved = 0;

  if (waterGrams > 0 && lactoseTotal > 0) {
    const maxLactose = (LACTOSE_SOLUBILITY_G_PER_100G_WATER.value / 100) * waterGrams;
    if (lactoseTotal > maxLactose) {
      lactoseUndissolved = lactoseTotal - maxLactose;
      warnings.push({
        code: 'lactose_supersaturated',
        message: `Лактоза превышает растворимость: ${lactoseTotal.toFixed(1)} г при пределе ≈${maxLactose.toFixed(1)} г на имеющуюся воду. Нерастворённые ${lactoseUndissolved.toFixed(1)} г не понижают a_w и могут дать песчанистость.`,
      });
    }
  }

  if (waterGrams > 0 && sucroseTotal > 0) {
    // Saturation is defined on the solution mass, so solve
    //   dissolved / (water + dissolved + other dissolved solutes) = s
    // Other dissolved sugars are included because they share the solvent.
    const s = sucroseSolubilityPercent(temperatureCelsius) / 100;
    let otherDissolved = 0;
    for (const [species, grams] of speciesGrams) {
      if (species === 'sucrose') continue;
      if (species === 'lactose') {
        otherDissolved += Math.max(0, grams - lactoseUndissolved);
        continue;
      }
      otherDissolved += grams;
    }
    otherDissolved += ethanolGrams + sodiumChlorideGrams;

    // dissolved = s·(water + otherDissolved + dissolved)  ⇒
    // dissolved·(1 − s) = s·(water + otherDissolved)
    const maxSucrose = (s * (waterGrams + otherDissolved)) / (1 - s);
    if (sucroseTotal > maxSucrose) {
      sucroseUndissolved = sucroseTotal - maxSucrose;
      warnings.push({
        code: 'sucrose_supersaturated',
        message: `Сахароза превышает растворимость при ${temperatureCelsius} °C: ${sucroseTotal.toFixed(1)} г при пределе ≈${maxSucrose.toFixed(1)} г. Избыток ${sucroseUndissolved.toFixed(1)} г считается кристаллическим, не понижает a_w и создаёт риск засахаривания.`,
      });
    }
  }

  // ── Build the dissolved-solute list ────────────────────────────────────
  const solutes: DissolvedSolute[] = [];

  for (const [species, totalGrams] of speciesGrams) {
    const undissolved =
      species === 'sucrose' ? sucroseUndissolved : species === 'lactose' ? lactoseUndissolved : 0;
    const dissolved = Math.max(0, totalGrams - undissolved);
    const molarMass = speciesMolarMass.get(species) ?? molarMassOfSpecies(species);
    if (dissolved <= 0 && undissolved <= 0) continue;
    solutes.push({
      species,
      label: species,
      grams: dissolved,
      undissolvedGrams: undissolved,
      molarMass,
      moles: dissolved / molarMass,
      norrishK: norrishKOfSpecies(species),
      moleFraction: 0,
    });
  }

  if (ethanolGrams > 0) {
    solutes.push({
      species: 'ethanol',
      label: 'ethanol',
      grams: ethanolGrams,
      undissolvedGrams: 0,
      molarMass: MOLAR_MASS.ethanol,
      moles: ethanolGrams / MOLAR_MASS.ethanol,
      // Ethanol is not a Norrish solute in the sugar sense; K = 0 makes it
      // contribute through Raoult dilution only. See 09-model-limitations.md.
      norrishK: 0,
      moleFraction: 0,
    });
  }

  if (sodiumChlorideGrams > 0) {
    solutes.push({
      species: 'sodiumChloride',
      label: 'sodiumChloride',
      grams: sodiumChlorideGrams,
      undissolvedGrams: 0,
      molarMass: MOLAR_MASS.sodiumChloride,
      // NaCl dissociates into two ions; the mole count that matters for
      // colligative depression is doubled.
      moles: (sodiumChlorideGrams / MOLAR_MASS.sodiumChloride) * 2,
      norrishK: 0,
      moleFraction: 0,
    });
  }

  const dissolvedSolutesGrams = solutes.reduce((sum, s) => sum + s.grams, 0);
  const undissolvedSolutesGrams = solutes.reduce((sum, s) => sum + s.undissolvedGrams, 0);
  const waterMoles = waterGrams / MOLAR_MASS.water;
  const soluteMoles = solutes.reduce((sum, s) => sum + s.moles, 0);
  const totalMoles = waterMoles + soluteMoles;

  for (const s of solutes) {
    s.moleFraction = totalMoles > 0 ? s.moles / totalMoles : 0;
  }

  if (solutes.length === 0 && waterGrams > 0) {
    warnings.push({
      code: 'no_solutes',
      message:
        'В водной фазе не обнаружено растворённых веществ. Активность воды приближается к 1.0 — продукт микробиологически нестабилен.',
    });
  }

  const phaseMassGrams = waterGrams + dissolvedSolutesGrams;

  return {
    waterGrams,
    dissolvedSolutesGrams,
    undissolvedSolutesGrams,
    phaseMassGrams,
    nonSoluteSolidsGrams: nonSoluteSolidsGrams + undissolvedSolutesGrams,
    waterMoles,
    soluteMoles,
    waterMoleFraction: totalMoles > 0 ? waterMoles / totalMoles : 0,
    dissolvedSolidsPercent: phaseMassGrams > 0 ? (dissolvedSolutesGrams / phaseMassGrams) * 100 : 0,
    solutes,
    temperatureCelsius,
    warnings,
  };
}
