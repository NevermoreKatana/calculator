import { describe, expect, it } from 'vitest';
import { classifyWaterActivity } from '@/lib/water-activity/classify';
import {
  CompositionScientificAwModel,
  MeasuredAwModel,
  ReferenceAwModel,
  REFERENCE_AW_MEASUREMENTS,
} from '@/lib/water-activity/models';
import { resolveWaterActivity, waterActivitySourceLabel } from '@/lib/water-activity/resolve';
import { WATER_ACTIVITY_ZONES } from '@/lib/water-activity/zones';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { calculateWaterActivity } from '@/lib/calculator/calculateWaterActivity';
import { item, makeIngredient } from './helpers';

const emptyInput = {
  waterPercentage: 20,
  dryMatterPercentage: 80,
  sugarPercentage: 30,
  ingredients: [],
};

describe('zone classification (spec §43)', () => {
  const cases: { aw: number; expected: string }[] = [
    { aw: 0.5, expected: 'no_growth' },
    { aw: 0.62, expected: 'osmophilic_yeasts' },
    { aw: 0.7, expected: 'xerophilic_molds' },
    { aw: 0.77, expected: 'halophilic_bacteria' },
    { aw: 0.84, expected: 'most_molds' },
    { aw: 0.865, expected: 'staphylococcus_aureus_possible' },
    { aw: 0.89, expected: 'yeasts_and_mycotoxin_molds' },
    { aw: 0.93, expected: 'broad_bacterial_growth_risk' },
    { aw: 0.97, expected: 'most_bacteria' },
  ];

  for (const { aw, expected } of cases) {
    it(`a_w = ${aw} → ${expected}`, () => {
      const result = classifyWaterActivity(aw);
      expect(result).not.toBeNull();
      expect(result!.risks).toContain(expected);
      expect(result!.primaryZone?.id).toBe(expected);
    });
  }
});

describe('overlapping zones are preserved, not collapsed (spec §20)', () => {
  it('a_w = 0.865 raises BOTH the mould and the S. aureus flag', () => {
    const result = classifyWaterActivity(0.865)!;
    expect(result.risks).toContain('most_molds');
    expect(result.risks).toContain('staphylococcus_aureus_possible');
    expect(result.risks.length).toBe(2);
  });

  it('a_w = 0.93 keeps the open-ended S. aureus flag alongside the 0.91–0.95 band', () => {
    const result = classifyWaterActivity(0.93)!;
    expect(result.risks).toContain('staphylococcus_aureus_possible');
    expect(result.risks).toContain('broad_bacterial_growth_risk');
  });

  it('a_w = 0.86 exactly raises the S. aureus flag and is shown as that zone', () => {
    // The chart prints "> 0.86", but the specification's worked example (§21)
    // displays 0.86 as the S. aureus zone, and a risk flag should trigger at
    // its stated threshold rather than declare the boundary safe.
    const result = classifyWaterActivity(0.86)!;
    expect(result.risks).toContain('most_molds');
    expect(result.risks).toContain('staphylococcus_aureus_possible');
    expect(result.primaryZone?.id).toBe('staphylococcus_aureus_possible');
  });

  it('a_w = 0.95 stays in the 0.91–0.95 band, which closes on its endpoint', () => {
    const result = classifyWaterActivity(0.95)!;
    expect(result.risks).toContain('broad_bacterial_growth_risk');
    expect(result.risks).not.toContain('most_bacteria');
    expect(result.primaryZone?.id).toBe('broad_bacterial_growth_risk');
  });

  it('reports the most severe matching risk level', () => {
    expect(classifyWaterActivity(0.5)!.highestRiskLevel).toBe('none');
    expect(classifyWaterActivity(0.7)!.highestRiskLevel).toBe('low');
    expect(classifyWaterActivity(0.84)!.highestRiskLevel).toBe('moderate');
    expect(classifyWaterActivity(0.89)!.highestRiskLevel).toBe('high');
    expect(classifyWaterActivity(0.93)!.highestRiskLevel).toBe('severe');
  });
});

describe('zone boundaries are defined, not accidental', () => {
  it('0.60 belongs to the osmophilic band, not to "no growth"', () => {
    expect(classifyWaterActivity(0.5999)!.risks).toContain('no_growth');
    expect(classifyWaterActivity(0.6)!.risks).toContain('osmophilic_yeasts');
    expect(classifyWaterActivity(0.6)!.risks).not.toContain('no_growth');
  });

  it('every sequential boundary hands over to exactly one successor', () => {
    for (const aw of [0.65, 0.75, 0.8]) {
      const bounded = classifyWaterActivity(aw)!.zones.filter((z) => z.max !== null);
      expect(bounded.length).toBe(1);
    }
  });

  it('0.90 < a_w < 0.91 is the documented gap in the source chart', () => {
    const result = classifyWaterActivity(0.905)!;
    expect(result.risks).toEqual(['staphylococcus_aureus_possible']);
  });

  it('every zone declares its source range verbatim', () => {
    for (const zone of WATER_ACTIVITY_ZONES) {
      expect(zone.sourceRange.length).toBeGreaterThan(0);
    }
  });

  it('rejects non-finite input', () => {
    expect(classifyWaterActivity(Number.NaN)).toBeNull();
  });
});

describe('a_w models never invent a value (spec §8, §28)', () => {
  it('MeasuredAwModel returns the user reading', () => {
    const result = MeasuredAwModel.calculate({ ...emptyInput, measuredValue: 0.78 });
    expect(result.available).toBe(true);
    expect(result.value).toBe(0.78);
    expect(result.source).toBe('measured');
  });

  it('MeasuredAwModel rejects out-of-range readings', () => {
    for (const bad of [0, -0.5, 1.5, Number.NaN]) {
      expect(MeasuredAwModel.calculate({ ...emptyInput, measuredValue: bad }).available).toBe(false);
    }
  });

  it('ReferenceAwModel has no a_w measurements to match against', () => {
    expect(REFERENCE_AW_MEASUREMENTS).toHaveLength(0);
    const result = ReferenceAwModel.calculate(emptyInput);
    expect(result.available).toBe(false);
    expect(result.value).toBeNull();
    expect(result.missingData?.length).toBeGreaterThan(0);
  });

  it('the composition model refuses when sugar speciation was not supplied', () => {
    const result = CompositionScientificAwModel.calculate(emptyInput);
    expect(result.available).toBe(false);
    expect(result.value).toBeNull();
    expect(result.missingData?.join(' ')).toContain('сахаров');
  });

  it('the chain reports "not determined" when nothing can answer', () => {
    const resolved = resolveWaterActivity(emptyInput);
    expect(resolved.result.available).toBe(false);
    expect(resolved.result.value).toBeNull();
    expect(resolved.classification).toBeNull();
    expect(waterActivitySourceLabel(resolved.result)).toBe('Нет данных');
  });

  it('a measured value takes priority over every other model (spec §27)', () => {
    const resolved = resolveWaterActivity({ ...emptyInput, measuredValue: 0.86 });
    expect(resolved.result.source).toBe('measured');
    expect(resolved.result.value).toBe(0.86);
    expect(waterActivitySourceLabel(resolved.result)).toBe('Измеренное значение');
    expect(resolved.classification?.risks).toContain('most_molds');
  });
});

describe('a_w is never derived from water percentage alone (spec §8)', () => {
  it('water % and a_w stay distinct quantities: 17.5 % water is not a_w = 0.825', () => {
    const puree = makeIngredient('Пюре', {
      category: 'fruit',
      sugarPercentage: 35,
      waterPercentage: 17.5,
    });
    const calc = calculateRecipe({ items: [item(puree, 1000)] });
    expect(calc.percentages.waterPercentage).toBeCloseTo(17.5, 10);

    const aw = calculateWaterActivity(calc);
    // The model now computes — but from the AQUEOUS PHASE, not from water %.
    expect(aw.result.available).toBe(true);
    expect(aw.result.source).toBe('model');
    // Whatever it returns, it must not be the water fraction dressed up as a_w.
    expect(aw.result.value).not.toBeCloseTo(0.175, 3);
    expect(aw.result.value).not.toBeCloseTo(0.825, 3);
    // And it must carry an uncertainty band rather than a bare number (§33).
    expect(aw.result.detail?.low).toBeLessThan(aw.result.value as number);
    expect(aw.result.detail?.high).toBeGreaterThan(aw.result.value as number);
  });

  it('identical water % with different composition gives different a_w', () => {
    // Same 20 % water. One recipe's dry matter is sugar, the other's is fat.
    // Under a water-percentage model these would be identical; physically they
    // are not remotely, and the model must show that.
    const sugary = calculateRecipe({
      items: [
        item(makeIngredient('Сахароза', { category: 'sugar', sugarPercentage: 80, waterPercentage: 20 }), 500),
      ],
    });
    const fatty = calculateRecipe({
      items: [
        item(makeIngredient('Жир', { category: 'fat', fatPercentage: 80, waterPercentage: 20 }), 500),
      ],
    });

    const awSugary = calculateWaterActivity(sugary).result.value;
    const awFatty = calculateWaterActivity(fatty).result.value;

    expect(awSugary).not.toBeNull();
    expect(awFatty).not.toBeNull();
    // Fat dissolves nothing, so its water phase is pure water: a_w ≈ 1.
    expect(awFatty as number).toBeCloseTo(1, 3);
    // Sugar depresses a_w substantially.
    expect(awSugary as number).toBeLessThan(0.95);
    expect(Math.abs((awSugary as number) - (awFatty as number))).toBeGreaterThan(0.05);
  });

  it('identical sugar MASS with different sugar SPECIES gives different a_w (spec §11)', () => {
    // The central claim of spec §11, as an executable assertion.
    const build = (name: string, category: 'sugar') =>
      calculateRecipe({
        items: [
          item(makeIngredient(name, { category, sugarPercentage: 66.7, waterPercentage: 33.3 }), 300),
        ],
      });

    const sucrose = calculateWaterActivity(build('sugar sucrose', 'sugar')).result.value;
    const invert = calculateWaterActivity(build('sugar inverted', 'sugar')).result.value;
    const syrup40 = calculateWaterActivity(build('sugar glucose 40DE', 'sugar')).result.value;

    for (const v of [sucrose, invert, syrup40]) expect(v).not.toBeNull();

    // Invert sugar has ~half the molar mass of sucrose, so it puts far more
    // particles into the water phase and depresses a_w more, despite a lower K.
    expect(invert as number).toBeLessThan(sucrose as number);
    // DE 40 syrup has a HIGHER molar mass than sucrose (~450 vs 342 g/mol),
    // so per gram it depresses a_w least of the three.
    expect(syrup40 as number).toBeGreaterThan(sucrose as number);
  });

  it('a measured value still overrides the computed one (spec §51)', () => {
    const calc = calculateRecipe({
      items: [
        item(makeIngredient('Шоколад', { category: 'chocolate', sugarPercentage: 40, waterPercentage: 20, fatPercentage: 40 }), 500),
      ],
    });
    const computed = calculateWaterActivity(calc);
    const measured = calculateWaterActivity(calc, { measuredValue: 0.78 });

    expect(computed.result.source).toBe('model');
    expect(measured.result.source).toBe('measured');
    expect(measured.result.value).toBe(0.78);
    expect(measured.result.value).not.toBe(computed.result.value);
  });
});
