import { describe, expect, it } from 'vitest';
import {
  norrishWaterActivity,
  norrishMultiSoluteWaterActivity,
  rossWaterActivity,
  raoultWaterActivity,
  sucroseSolutionWaterActivity,
  waterActivityToERH,
  erhToWaterActivity,
  undissociatedFraction,
} from '@/lib/science/water-activity/equations';
import {
  MOLAR_MASS,
  NORRISH_CONSTANTS,
  SORBIC_ACID_PKA,
  DEXTROSE_EQUIVALENT_NUMERATOR,
} from '@/lib/science/constants';
import {
  molarMassOfSpecies,
  norrishKOfSpecies,
  speciateSugar,
  validateSugarProfile,
  SUGAR_PROFILES,
  SUGAR_SPECIES,
} from '@/lib/science/sugars';
import { buildAqueousPhase, sucroseSolubilityPercent } from '@/lib/science/aqueous-phase';
import { calculateCompositionWaterActivity } from '@/lib/science/water-activity/composition-model';
import {
  MICROBIAL_GROWTH_THRESHOLDS,
  assessGrowthRisk,
  lowestPathogenGrowthAw,
  lowestRelevantGrowthAw,
} from '@/lib/science/microbiology';
import { analyseHurdles } from '@/lib/science/hurdles';
import { SCIENTIFIC_SOURCES, getSource, requireSources } from '@/lib/science/sources';
import { SCIENTIFIC_FORMULAS, requireFormula } from '@/lib/science/formulas';
import { PARAMETER_CAPABILITIES } from '@/lib/science/parameter-capabilities';
import { resolveSugarProfile } from '@/lib/science/ingredient-sugar-profiles';
import { formatUncertain } from '@/lib/science/confidence';

// ══════════════════════════════════════════════════════════════════════════
// §40 — validation against published values
// ══════════════════════════════════════════════════════════════════════════

describe('§40 validation: Norrish vs the published BCCDC sucrose table', () => {
  /**
   * BC Centre for Disease Control, Food Safety Bulletin 03/97, "Water Activity
   * of Sucrose and NaCl Solutions", citing Principles of Food Science Part II
   * p. 250. Grams of sucrose per 100 g of water.
   *
   * The 20 g row is EXCLUDED from the accuracy assertion: the bulletin prints
   * a_w = 0.998 there, while its own formula a = 1/(1 + 0.27n) yields 0.984.
   * The row is internally inconsistent with the rest of the table, i.e. a
   * typo in the source. It is asserted separately below so the finding does
   * not quietly disappear.
   */
  const published: { sucroseGrams: number; aw: number }[] = [
    { sucroseGrams: 40, aw: 0.969 },
    { sucroseGrams: 60, aw: 0.955 },
    { sucroseGrams: 80, aw: 0.941 },
    { sucroseGrams: 100, aw: 0.927 },
    { sucroseGrams: 120, aw: 0.913 },
    { sucroseGrams: 140, aw: 0.9 },
    { sucroseGrams: 160, aw: 0.888 },
    { sucroseGrams: 180, aw: 0.876 },
    { sucroseGrams: 200, aw: 0.86 },
  ];

  it.each(published)(
    'reproduces a_w for $sucroseGrams g sucrose / 100 g water within 0.01',
    ({ sucroseGrams, aw }) => {
      const computed = sucroseSolutionWaterActivity(sucroseGrams, 100);
      expect(Math.abs(computed - aw)).toBeLessThanOrEqual(0.01);
    },
  );

  it('never deviates by more than 0.0086 across the whole published range', () => {
    const deviations = published.map(({ sucroseGrams, aw }) =>
      Math.abs(sucroseSolutionWaterActivity(sucroseGrams, 100) - aw),
    );
    // Measured worst case: 0.00853, at 80 g sucrose / 100 g water.
    expect(Math.max(...deviations)).toBeLessThanOrEqual(0.0086);
  });

  it('documents the typo found in the published table (20 g row)', () => {
    // The bulletin's own formula, evaluated at its own stated inputs.
    const n = 20 / 342;
    const bulletinFormula = 1 / (1 + 0.27 * n);
    expect(bulletinFormula).toBeCloseTo(0.984, 3);
    // The printed value disagrees with it by more than a rounding step.
    expect(Math.abs(0.998 - bulletinFormula)).toBeGreaterThan(0.01);
    // Norrish sides with the formula, not with the printed value.
    expect(Math.abs(sucroseSolutionWaterActivity(20, 100) - bulletinFormula)).toBeLessThan(0.006);
  });

  it('pure water has a_w = 1', () => {
    expect(sucroseSolutionWaterActivity(0, 100)).toBeCloseTo(1, 12);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Equation behaviour and sign convention
// ══════════════════════════════════════════════════════════════════════════

describe('water activity equations', () => {
  const waterMoles = 100 / MOLAR_MASS.water;

  it('uses the exp(−K·X²) convention: a_w never exceeds 1 for positive K', () => {
    for (const species of SUGAR_SPECIES) {
      if (species === 'glucoseSyrupSolids') continue;
      const k = norrishKOfSpecies(species);
      expect(k).toBeGreaterThan(0);
      for (const grams of [10, 50, 100, 200, 400]) {
        const aw = norrishWaterActivity(waterMoles, grams / molarMassOfSpecies(species), k);
        expect(aw).toBeGreaterThan(0);
        expect(aw).toBeLessThanOrEqual(1);
      }
    }
  });

  it('Raoult over-estimates a_w relative to Norrish for the same solution', () => {
    const solutes = [{ moles: 200 / MOLAR_MASS.sucrose, norrishK: NORRISH_CONSTANTS.sucrose.k }];
    const raoult = raoultWaterActivity(waterMoles, solutes);
    const norrish = norrishMultiSoluteWaterActivity(waterMoles, solutes);
    expect(raoult).toBeGreaterThan(norrish);
  });

  it('Ross and multi-solute Norrish agree to within 0.02 on a mixed sugar phase', () => {
    const solutes = [
      { moles: 100 / MOLAR_MASS.sucrose, norrishK: NORRISH_CONSTANTS.sucrose.k },
      { moles: 50 / MOLAR_MASS.glucose, norrishK: NORRISH_CONSTANTS.glucose.k },
      { moles: 50 / MOLAR_MASS.fructose, norrishK: NORRISH_CONSTANTS.fructose.k },
    ];
    const ross = rossWaterActivity(waterMoles, solutes);
    const norrish = norrishMultiSoluteWaterActivity(waterMoles, solutes);
    expect(Math.abs(ross - norrish)).toBeLessThan(0.02);
  });

  it('single-solute Norrish is the multi-solute form with one term', () => {
    const single = norrishWaterActivity(waterMoles, 0.5, 6.47);
    const multi = norrishMultiSoluteWaterActivity(waterMoles, [{ moles: 0.5, norrishK: 6.47 }]);
    expect(single).toBeCloseTo(multi, 12);
  });

  it('adding solute always lowers a_w (monotonicity)', () => {
    let previous = 1.1;
    for (const grams of [0, 25, 50, 100, 200, 300]) {
      const aw = sucroseSolutionWaterActivity(grams, 100);
      expect(aw).toBeLessThan(previous);
      previous = aw;
    }
  });

  it('returns NaN rather than a wrong number when there is nothing to divide by', () => {
    expect(Number.isNaN(norrishWaterActivity(0, 0, 6.47))).toBe(true);
    expect(Number.isNaN(raoultWaterActivity(0, []))).toBe(true);
    expect(Number.isNaN(rossWaterActivity(0, [{ moles: 1, norrishK: 6.47 }]))).toBe(true);
  });

  it('ERH round-trips', () => {
    expect(waterActivityToERH(0.82)).toBeCloseTo(82, 10);
    expect(erhToWaterActivity(82)).toBeCloseTo(0.82, 10);
  });
});

describe('Henderson–Hasselbalch preservative fraction', () => {
  it('is 50 % exactly at pH = pKa', () => {
    expect(undissociatedFraction(SORBIC_ACID_PKA.value, SORBIC_ACID_PKA.value)).toBeCloseTo(0.5, 12);
  });

  it('matches published behaviour: ~85 % at pH 4, ~5 % at pH 6', () => {
    expect(undissociatedFraction(4.0, 4.76)).toBeCloseTo(0.852, 2);
    expect(undissociatedFraction(6.0, 4.76)).toBeCloseTo(0.054, 2);
  });

  it('falls monotonically as pH rises', () => {
    let previous = 1.1;
    for (const pH of [3, 4, 5, 6, 7, 8]) {
      const f = undissociatedFraction(pH, SORBIC_ACID_PKA.value);
      expect(f).toBeLessThan(previous);
      previous = f;
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// §11 — sugar speciation
// ══════════════════════════════════════════════════════════════════════════

describe('§11 sugar speciation', () => {
  it('every reference profile has fractions summing to 1', () => {
    for (const [id, profile] of Object.entries(SUGAR_PROFILES)) {
      const validation = validateSugarProfile(profile);
      expect(validation.problems, `profile ${id}: ${validation.problems.join('; ')}`).toEqual([]);
      expect(validation.valid).toBe(true);
    }
  });

  it('derives glucose syrup molar mass from DE, not from a lookup', () => {
    expect(molarMassOfSpecies('glucoseSyrupSolids', 40)).toBeCloseTo(18015.6 / 40, 6);
    expect(molarMassOfSpecies('glucoseSyrupSolids', 60)).toBeCloseTo(18015.6 / 60, 6);
    // Higher DE → shorter chains → lower molar mass → more moles per gram.
    expect(molarMassOfSpecies('glucoseSyrupSolids', 60)).toBeLessThan(
      molarMassOfSpecies('glucoseSyrupSolids', 40),
    );
  });

  it('DE numerator is derived from the glucose molar mass, not hard-coded', () => {
    expect(DEXTROSE_EQUIVALENT_NUMERATOR.value).toBeCloseTo(100 * MOLAR_MASS.glucose, 10);
  });

  it('rejects a glucose syrup profile with a missing or impossible DE', () => {
    expect(() => molarMassOfSpecies('glucoseSyrupSolids')).toThrow();
    expect(() => molarMassOfSpecies('glucoseSyrupSolids', 0)).toThrow();
    expect(() => molarMassOfSpecies('glucoseSyrupSolids', 150)).toThrow();
  });

  it('invert sugar yields ~1.9× the moles of sucrose per gram', () => {
    const sucroseMoles = speciateSugar(100, SUGAR_PROFILES.pureSucrose).reduce(
      (s, p) => s + p.grams / p.molarMass,
      0,
    );
    const invertMoles = speciateSugar(100, SUGAR_PROFILES.invertSugar).reduce(
      (s, p) => s + p.grams / p.molarMass,
      0,
    );
    expect(invertMoles / sucroseMoles).toBeCloseTo(MOLAR_MASS.sucrose / MOLAR_MASS.glucose, 6);
    expect(invertMoles / sucroseMoles).toBeGreaterThan(1.8);
  });

  it('speciation conserves mass', () => {
    for (const profile of Object.values(SUGAR_PROFILES)) {
      const parts = speciateSugar(250, profile);
      const total = parts.reduce((s, p) => s + p.grams, 0);
      expect(total).toBeCloseTo(250, 9);
    }
  });

  it('returns nothing for zero or negative sugar', () => {
    expect(speciateSugar(0, SUGAR_PROFILES.pureSucrose)).toEqual([]);
    expect(speciateSugar(-5, SUGAR_PROFILES.pureSucrose)).toEqual([]);
  });
});

describe('ingredient → sugar profile resolution', () => {
  const cases: { name: string; category: 'sugar' | 'dairy' | 'chocolate' | 'fruit' | 'other'; expected: string | null }[] = [
    { name: 'sugar inverted', category: 'sugar', expected: 'invertSugar' },
    { name: 'sugar glucose 40DE', category: 'sugar', expected: 'glucoseSyrup40DE' },
    { name: 'sugar glucose 60DE', category: 'sugar', expected: 'glucoseSyrup60DE' },
    { name: 'sugar sorbitol', category: 'sugar', expected: 'pureSorbitol' },
    { name: 'sugar dextrose', category: 'sugar', expected: 'pureDextrose' },
    { name: 'cream 35%', category: 'dairy', expected: 'dairyLactose' },
    { name: 'callebaut 811', category: 'chocolate', expected: 'pureSucrose' },
    { name: 'fruit puree манго', category: 'fruit', expected: 'fruitTypical' },
    { name: 'lecithin soya', category: 'other', expected: null },
  ];

  it.each(cases)('resolves "$name" to $expected', ({ name, category, expected }) => {
    const resolved = resolveSugarProfile({ id: 'x', name, category });
    expect(resolved.profileId).toBe(expected);
  });

  it('prefers the more specific DE rule over the bare "glucose" rule', () => {
    expect(resolveSugarProfile({ id: 'x', name: 'sugar glucose 60DE', category: 'sugar' }).profileId).toBe(
      'glucoseSyrup60DE',
    );
  });

  it('an explicit override beats every pattern', () => {
    const resolved = resolveSugarProfile(
      { id: 'ing-1', name: 'sugar inverted', category: 'sugar' },
      [{ ingredientId: 'ing-1', profileId: 'pureSorbitol' }],
    );
    expect(resolved.profileId).toBe('pureSorbitol');
    expect(resolved.method).toBe('explicit_override');
  });

  it('returns null rather than defaulting to sucrose when nothing matches', () => {
    const resolved = resolveSugarProfile({ id: 'x', name: 'lecithin soya', category: 'other' });
    expect(resolved.profile).toBeNull();
    expect(resolved.method).toBe('unresolved');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Aqueous phase
// ══════════════════════════════════════════════════════════════════════════

describe('aqueous phase model', () => {
  it('excludes fat from the mole balance', () => {
    const withoutFat = buildAqueousPhase([
      { waterGrams: 20, sugarGrams: 30, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 0 },
    ]);
    const withFat = buildAqueousPhase([
      { waterGrams: 20, sugarGrams: 30, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 400 },
    ]);
    // Adding 400 g of fat must not change the water phase at all.
    expect(withFat.waterMoleFraction).toBeCloseTo(withoutFat.waterMoleFraction, 12);
    expect(withFat.dissolvedSolidsPercent).toBeCloseTo(withoutFat.dissolvedSolidsPercent, 12);
    expect(withFat.nonSoluteSolidsGrams).toBeCloseTo(400, 9);
  });

  it('caps sucrose at its solubility and flags the excess', () => {
    const phase = buildAqueousPhase(
      [{ waterGrams: 10, sugarGrams: 90, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 0 }],
      { temperatureCelsius: 20 },
    );
    const sucrose = phase.solutes.find((s) => s.species === 'sucrose');
    expect(sucrose?.undissolvedGrams).toBeGreaterThan(0);
    expect(phase.warnings.some((w) => w.code === 'sucrose_supersaturated')).toBe(true);
    // The dissolved part sits at the saturation concentration.
    expect(phase.dissolvedSolidsPercent).toBeCloseTo(sucroseSolubilityPercent(20), 6);
  });

  it('caps lactose at its much lower solubility', () => {
    const phase = buildAqueousPhase([
      { waterGrams: 10, sugarGrams: 10, sugarProfile: SUGAR_PROFILES.dairyLactose, nonSoluteSolidsGrams: 0 },
    ]);
    const lactose = phase.solutes.find((s) => s.species === 'lactose');
    expect(lactose?.undissolvedGrams).toBeGreaterThan(0);
    expect(phase.warnings.some((w) => w.code === 'lactose_supersaturated')).toBe(true);
  });

  it('sucrose solubility rises with temperature and is clamped outside the table', () => {
    expect(sucroseSolubilityPercent(20)).toBeCloseTo(67.1, 6);
    expect(sucroseSolubilityPercent(30)).toBeGreaterThan(sucroseSolubilityPercent(20));
    expect(sucroseSolubilityPercent(-40)).toBeCloseTo(64.4, 6);
    expect(sucroseSolubilityPercent(500)).toBeCloseTo(72.3, 6);
  });

  it('counts unspeciated sugar as mass but keeps it out of the mole balance', () => {
    const phase = buildAqueousPhase([
      { waterGrams: 20, sugarGrams: 30, sugarProfile: null, nonSoluteSolidsGrams: 0 },
    ]);
    expect(phase.soluteMoles).toBe(0);
    expect(phase.nonSoluteSolidsGrams).toBeCloseTo(30, 9);
    expect(phase.warnings.some((w) => w.code === 'unspeciated_sugar')).toBe(true);
  });

  it('reports no water rather than dividing by zero', () => {
    const phase = buildAqueousPhase([
      { waterGrams: 0, sugarGrams: 50, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 10 },
    ]);
    expect(phase.warnings.some((w) => w.code === 'no_water')).toBe(true);
    expect(Number.isFinite(phase.waterMoleFraction)).toBe(true);
  });

  it('treats NaCl as two osmotically active particles', () => {
    const phase = buildAqueousPhase([
      { waterGrams: 100, sugarGrams: 0, sugarProfile: null, nonSoluteSolidsGrams: 0, sodiumChlorideGrams: 58.443 },
    ]);
    const salt = phase.solutes.find((s) => s.species === 'sodiumChloride');
    expect(salt?.moles).toBeCloseTo(2, 6);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Composition a_w model
// ══════════════════════════════════════════════════════════════════════════

describe('composition water-activity model', () => {
  const ganache = [
    { waterGrams: 17.5, sugarGrams: 35, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 47.5 },
  ];

  it('reproduces the hand-checked value for the 17.5 % / 35 % reference point', () => {
    const result = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    expect(result.available).toBe(true);
    expect(result.waterActivity).toBeCloseTo(0.853, 3);
  });

  it('always returns a band, never a bare point estimate', () => {
    const result = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    expect(result.low).toBeLessThan(result.waterActivity as number);
    expect(result.high).toBeGreaterThan(result.waterActivity as number);
    expect(result.low).toBeGreaterThanOrEqual(0);
    expect(result.high).toBeLessThanOrEqual(1);
  });

  it('widens the band and lowers confidence when speciation was guessed', () => {
    const good = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'explicit_override', confidence: 1, sugarGrams: 10 }],
    });
    const weak = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'category_default', confidence: 0.6, sugarGrams: 10 }],
    });
    const goodWidth = (good.high as number) - (good.low as number);
    const weakWidth = (weak.high as number) - (weak.low as number);
    expect(weakWidth).toBeGreaterThan(goodWidth);
  });

  it('drops to low confidence when any ingredient is unresolved', () => {
    const result = calculateCompositionWaterActivity({
      contributions: [
        ...ganache,
        { waterGrams: 5, sugarGrams: 10, sugarProfile: null, nonSoluteSolidsGrams: 0 },
      ],
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }, { method: 'unresolved', confidence: 0, sugarGrams: 10 }],
    });
    expect(result.confidence).toBe('low');
  });

  it('refuses when there is no water', () => {
    const result = calculateCompositionWaterActivity({
      contributions: [{ waterGrams: 0, sugarGrams: 10, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 5 }],
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    expect(result.available).toBe(false);
    expect(result.waterActivity).toBeNull();
    expect(result.confidence).toBe('none');
  });

  it('returns a_w = 1 for water with nothing dissolved in it', () => {
    const result = calculateCompositionWaterActivity({
      contributions: [{ waterGrams: 50, sugarGrams: 0, sugarProfile: null, nonSoluteSolidsGrams: 50 }],
      speciation: [],
    });
    expect(result.waterActivity).toBe(1);
  });

  it('carries formula and source provenance on every result', () => {
    const result = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    expect(result.provenance.formulaId).toBe('norrish-multi-solute');
    expect(result.provenance.sourceIds.length).toBeGreaterThan(0);
    expect(() => requireSources(result.provenance.sourceIds)).not.toThrow();
    expect(() => requireFormula(result.provenance.formulaId as string)).not.toThrow();
  });

  it('warns when polyols sit above their validated concentration range', () => {
    const result = calculateCompositionWaterActivity({
      contributions: [
        { waterGrams: 20, sugarGrams: 50, sugarProfile: SUGAR_PROFILES.pureSorbitol, nonSoluteSolidsGrams: 0 },
      ],
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    expect(result.warnings.join(' ')).toContain('полиол');
    expect(result.confidence).toBe('low');
  });

  it('produces only finite numbers in every field', () => {
    const result = calculateCompositionWaterActivity({
      contributions: ganache,
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    });
    for (const v of [result.waterActivity, result.low, result.high, result.crossChecks.norrish, result.crossChecks.ross, result.crossChecks.raoult]) {
      expect(Number.isFinite(v as number)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// §20 — do the empirical reference points line up with a_w?
// ══════════════════════════════════════════════════════════════════════════

describe('§20 empirical reference points explained through a_w', () => {
  const points = [
    { water: 17.5, sugar: 35, days: 90 },
    { water: 18.6, sugar: 32, days: 60 },
    { water: 20.0, sugar: 30, days: 41 },
  ];

  const awOf = (water: number, sugar: number) =>
    calculateCompositionWaterActivity({
      contributions: [
        { waterGrams: water, sugarGrams: sugar, sugarProfile: SUGAR_PROFILES.pureSucrose, nonSoluteSolidsGrams: 100 - water - sugar },
      ],
      speciation: [{ method: 'name_pattern', confidence: 0.9, sugarGrams: 10 }],
    }).waterActivity as number;

  it('a_w rises monotonically as the observed shelf life falls', () => {
    const aws = points.map((p) => awOf(p.water, p.sugar));
    expect(aws[0]).toBeLessThan(aws[1]);
    expect(aws[1]).toBeLessThan(aws[2]);
    // …and the days fall in the same order.
    expect(points[0].days).toBeGreaterThan(points[1].days);
    expect(points[1].days).toBeGreaterThan(points[2].days);
  });

  it('the longest-life point sits at the FDA safety threshold, the shortest above it', () => {
    expect(awOf(17.5, 35)).toBeLessThanOrEqual(0.86);
    expect(awOf(20, 30)).toBeGreaterThan(0.86);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Microbiology
// ══════════════════════════════════════════════════════════════════════════

describe('microbiology thresholds', () => {
  it('every threshold cites at least one registered source', () => {
    for (const t of MICROBIAL_GROWTH_THRESHOLDS) {
      expect(t.sourceIds.length, `${t.id} has no sources`).toBeGreaterThan(0);
      expect(() => requireSources(t.sourceIds), `${t.id}`).not.toThrow();
    }
  });

  it('every minimumAw lies inside its own reported disagreement range', () => {
    for (const t of MICROBIAL_GROWTH_THRESHOLDS) {
      expect(t.minimumAw, t.id).toBeGreaterThanOrEqual(t.minimumAwRange[0]);
      expect(t.minimumAw, t.id).toBeLessThanOrEqual(t.minimumAwRange[1]);
      expect(t.minimumAwRange[0], t.id).toBeLessThanOrEqual(t.minimumAwRange[1]);
    }
  });

  it('the lowest confectionery-relevant growth limit is 0.60 (osmophilic yeasts)', () => {
    // The single most extreme organism on record is Xeromyces bisporus at 0.61,
    // but the osmophilic-yeast GROUP entry is lower still at 0.60, and it is the
    // group figure that must drive a design target.
    expect(lowestRelevantGrowthAw(true)).toBeCloseTo(0.6, 6);
    const xeromyces = MICROBIAL_GROWTH_THRESHOLDS.find((t) => t.id === 'xeromyces-bisporus');
    expect(xeromyces?.minimumAw).toBeCloseTo(0.61, 6);
  });

  it('the lowest pathogen limit is S. aureus, below the FDA 0.85 threshold', () => {
    // 0.83 aerobic growth — the reason 0.85 is a threshold and not a guarantee.
    expect(lowestPathogenGrowthAw()).toBeCloseTo(0.83, 6);
  });

  it('at a_w 0.75 no pathogen can grow but xerophiles still can', () => {
    const risks = assessGrowthRisk({ waterActivity: 0.75, confectioneryOnly: true });
    const growing = risks.filter((r) => r.growthPossible);
    expect(growing.every((r) => r.threshold.hazard === 'spoilage')).toBe(true);
    expect(growing.map((r) => r.threshold.id)).toContain('zygosaccharomyces-rouxii');
  });

  it('at a_w 0.55 nothing grows at all', () => {
    const risks = assessGrowthRisk({ waterActivity: 0.55, confectioneryOnly: true });
    expect(risks.filter((r) => r.growthPossible)).toHaveLength(0);
  });

  it('pH is applied as a second barrier, not ignored', () => {
    const neutral = assessGrowthRisk({ waterActivity: 0.95, pH: 7 });
    const acidic = assessGrowthRisk({ waterActivity: 0.95, pH: 3.5 });
    const growingNeutral = neutral.filter((r) => r.growthPossible).length;
    const growingAcidic = acidic.filter((r) => r.growthPossible).length;
    expect(growingAcidic).toBeLessThan(growingNeutral);
  });

  it('flags halophiles as irrelevant to confectionery', () => {
    const halo = MICROBIAL_GROWTH_THRESHOLDS.find((t) => t.id === 'halophilic-bacteria');
    expect(halo?.relevantToConfectionery).toBe(false);
    const risks = assessGrowthRisk({ waterActivity: 0.8, confectioneryOnly: true });
    expect(risks.map((r) => r.threshold.id)).not.toContain('halophilic-bacteria');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Hurdles
// ══════════════════════════════════════════════════════════════════════════

describe('hurdle analysis', () => {
  it('reports everything unknown when nothing is supplied', () => {
    const analysis = analyseHurdles({ waterActivity: null, waterActivityMeasured: false });
    expect(analysis.unknownCount).toBeGreaterThan(analysis.effectiveCount);
    expect(analysis.summary).toContain('слишком мало');
  });

  it('calls sorbate ineffective at ganache pH', () => {
    const analysis = analyseHurdles({
      waterActivity: 0.82,
      waterActivityMeasured: true,
      measuredPH: 6.5,
      hasPreservative: true,
    });
    const preservative = analysis.hurdles.find((h) => h.id === 'preservative');
    expect(preservative?.state).toBe('absent');
    expect(preservative?.explanation).toContain('практически не работает');
  });

  it('calls sorbate effective in an acid fruit filling', () => {
    const analysis = analyseHurdles({
      waterActivity: 0.85,
      waterActivityMeasured: true,
      measuredPH: 3.6,
      hasPreservative: true,
    });
    expect(analysis.hurdles.find((h) => h.id === 'preservative')?.state).toBe('effective');
  });

  it('treats a_w below the universal growth limit as an effective barrier', () => {
    const analysis = analyseHurdles({ waterActivity: 0.55, waterActivityMeasured: true });
    expect(analysis.hurdles.find((h) => h.id === 'water_activity')?.state).toBe('effective');
  });

  it('treats a_w above 0.90 as an absent barrier', () => {
    const analysis = analyseHurdles({ waterActivity: 0.95, waterActivityMeasured: true });
    expect(analysis.hurdles.find((h) => h.id === 'water_activity')?.state).toBe('absent');
  });

  it('never claims the chocolate shell is a full barrier', () => {
    const analysis = analyseHurdles({
      waterActivity: 0.8,
      waterActivityMeasured: true,
      chocolateShell: true,
    });
    expect(analysis.hurdles.find((h) => h.id === 'fat_barrier')?.state).toBe('partial');
  });

  it('the state counts account for every hurdle, partial ones included', () => {
    const analysis = analyseHurdles({
      waterActivity: 0.88,
      waterActivityMeasured: false,
      storageTemperatureC: 18,
      packagingSealed: true,
      chocolateShell: true,
      thermalTreatment: true,
    });
    const total =
      analysis.effectiveCount + analysis.partialCount + analysis.absentCount + analysis.unknownCount;
    expect(total).toBe(analysis.hurdles.length);
    expect(analysis.summary).toContain(String(analysis.hurdles.length));
  });

  it('does not ask for a value that was already supplied', () => {
    // Regression: the "partial" branches used to keep the placeholder
    // recommendation, so a recipe with a stated 18 °C was still told to
    // "specify the storage temperature".
    const analysis = analyseHurdles({
      waterActivity: 0.88,
      waterActivityMeasured: false,
      storageTemperatureC: 18,
      measuredPH: 5.0,
    });
    const temperature = analysis.hurdles.find((h) => h.id === 'temperature');
    expect(temperature?.state).toBe('partial');
    expect(temperature?.valueLabel).toBe('18 °C');
    expect(temperature?.recommendation).toBeUndefined();

    const ph = analysis.hurdles.find((h) => h.id === 'ph');
    expect(ph?.state).toBe('partial');
    expect(ph?.recommendation).toBeUndefined();
  });

  it('still asks for the values that are genuinely missing', () => {
    const analysis = analyseHurdles({ waterActivity: null, waterActivityMeasured: false });
    expect(analysis.hurdles.find((h) => h.id === 'temperature')?.recommendation).toBeDefined();
    expect(analysis.hurdles.find((h) => h.id === 'ph')?.recommendation).toBeDefined();
  });

  it('always leaves hygiene as unknown, because it cannot be computed', () => {
    const analysis = analyseHurdles({
      waterActivity: 0.7,
      waterActivityMeasured: true,
      measuredPH: 4,
      storageTemperatureC: 4,
      packagingSealed: true,
      thermalTreatment: true,
    });
    expect(analysis.hurdles.find((h) => h.id === 'hygiene')?.state).toBe('unknown');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Registry integrity — §34, §35, §47, §54
// ══════════════════════════════════════════════════════════════════════════

describe('registry integrity', () => {
  it('source ids are unique', () => {
    const ids = SCIENTIFIC_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formula ids are unique', () => {
    const ids = SCIENTIFIC_FORMULAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every formula references only registered sources', () => {
    for (const f of SCIENTIFIC_FORMULAS) {
      expect(() => requireSources(f.sourceIds), `formula ${f.id}`).not.toThrow();
    }
  });

  it('every Norrish constant references only registered sources', () => {
    for (const [name, c] of Object.entries(NORRISH_CONSTANTS)) {
      expect(c.sourceIds.length, `${name} has no source`).toBeGreaterThan(0);
      expect(() => requireSources(c.sourceIds), name).not.toThrow();
    }
  });

  it('every capability referencing a formula points at a real one', () => {
    for (const c of PARAMETER_CAPABILITIES) {
      if (c.formulaId) expect(() => requireFormula(c.formulaId as string), c.id).not.toThrow();
    }
  });

  it('every formula states its applicability to ganache specifically (§37)', () => {
    for (const f of SCIENTIFIC_FORMULAS) {
      expect(f.ganacheApplicability.length, `formula ${f.id}`).toBeGreaterThan(30);
    }
  });

  it('requireSources throws on an unknown id rather than silently skipping it', () => {
    expect(() => requireSources(['does-not-exist'])).toThrow();
    expect(getSource('does-not-exist')).toBeNull();
  });

  it('every parameter marked "exact from recipe" needs no measurement', () => {
    for (const c of PARAMETER_CAPABILITIES) {
      if (c.kind === 'exact_from_recipe') {
        expect(c.fromRecipe, c.id).toBe(true);
        expect(c.requiresMeasurement, c.id).toBe(false);
        expect(c.requiresCalibration, c.id).toBe(false);
      }
    }
  });

  it('the validated shelf life is never claimed to be computable', () => {
    const validated = PARAMETER_CAPABILITIES.find((c) => c.id === 'shelf_life_validated');
    expect(validated?.fromRecipe).toBe(false);
    expect(validated?.confidence).toBe('none');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// §33 — uncertainty formatting
// ══════════════════════════════════════════════════════════════════════════

describe('§33 uncertainty presentation', () => {
  const provenance = {
    formulaId: null,
    sourceIds: [],
    status: 'approximate' as const,
    confidence: 'medium' as const,
    applicabilityNote: '',
    limitations: [],
    assumptions: [],
  };

  it('shows a point estimate with its band when the band is tight', () => {
    expect(formatUncertain({ value: 0.85, low: 0.84, high: 0.86, unit: 'a_w', provenance })).toBe(
      '0.85 (0.84–0.86)',
    );
  });

  it('suppresses the point estimate when the band is wide', () => {
    expect(formatUncertain({ value: 50, low: 20, high: 80, unit: 'дней', provenance }, 0)).toBe('20–80');
  });

  it('renders an em dash rather than NaN when there is no value', () => {
    expect(formatUncertain({ value: null, low: null, high: null, unit: 'a_w', provenance })).toBe('—');
  });
});
