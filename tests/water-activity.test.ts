import { describe, expect, it } from 'vitest';
import { classifyWaterActivity } from '@/lib/water-activity/classify';
import {
  FutureScientificAwModel,
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

  it('FutureScientificAwModel computes nothing and lists what it would need', () => {
    const result = FutureScientificAwModel.calculate(emptyInput);
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

describe('a_w is never derived from water percentage (spec §8)', () => {
  it('a 17.5 % water recipe does not yield a_w = 0.825 or any other number', () => {
    const puree = makeIngredient('Пюре', { sugarPercentage: 35, waterPercentage: 17.5 });
    const calc = calculateRecipe({ items: [item(puree, 1000)] });
    expect(calc.percentages.waterPercentage).toBeCloseTo(17.5, 10);

    const aw = calculateWaterActivity(calc);
    expect(aw.result.available).toBe(false);
    expect(aw.result.value).toBeNull();
    expect(aw.classification).toBeNull();
  });

  it('two recipes with identical water but different composition both return "no data"', () => {
    const a = calculateRecipe({
      items: [item(makeIngredient('A', { sugarPercentage: 50, waterPercentage: 20 }), 500)],
    });
    const b = calculateRecipe({
      items: [item(makeIngredient('B', { fatPercentage: 50, waterPercentage: 20 }), 500)],
    });
    expect(calculateWaterActivity(a).result.value).toBeNull();
    expect(calculateWaterActivity(b).result.value).toBeNull();
  });
});
