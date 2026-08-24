import { describe, expect, it } from 'vitest';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { calculateSugarWaterRatio } from '@/lib/calculator/calculateSugars';
import { formatRatio, safeDivide } from '@/lib/calculator/numeric';
import { item, makeIngredient } from './helpers';

/** A clean 1000 g recipe whose components sum to exactly 100 % per ingredient. */
function thousandGramRecipe() {
  const chocolate = makeIngredient('Шоколад 70 %', {
    category: 'chocolate',
    sugarPercentage: 29,
    cocoaButterPercentage: 42,
    cocoaSolidsPercentage: 29,
  });
  const cream = makeIngredient('Сливки 33 %', {
    category: 'dairy',
    fatPercentage: 33,
    milkSolidsPercentage: 6,
    waterPercentage: 61,
  });
  const sugar = makeIngredient('Сахар', { category: 'sugar', sugarPercentage: 100, sweetness: 100 });
  const water = makeIngredient('Вода', { category: 'other', waterPercentage: 100 });

  return {
    items: [item(chocolate, 500), item(cream, 300), item(sugar, 100), item(water, 100)],
  };
}

describe('calculateRecipe — base arithmetic (spec §7)', () => {
  const result = calculateRecipe(thousandGramRecipe());

  it('sums to the expected total weight', () => {
    expect(result.totals.totalWeightGrams).toBe(1000);
    expect(result.totals.itemCount).toBe(4);
  });

  it('computes ingredient percentages as weight / total × 100', () => {
    expect(result.contributions[0].percentage).toBeCloseTo(50, 10);
    expect(result.contributions[1].percentage).toBeCloseTo(30, 10);
    expect(result.contributions[2].percentage).toBeCloseTo(10, 10);
    expect(result.contributions[3].percentage).toBeCloseTo(10, 10);
  });

  it('percentages of all ingredients sum to 100', () => {
    const sum = result.contributions.reduce((a, c) => a + c.percentage, 0);
    expect(sum).toBeCloseTo(100, 10);
  });

  it('computes water: 300×0.61 + 100×1.00 = 283 g', () => {
    expect(result.totals.waterGrams).toBeCloseTo(283, 10);
    expect(result.percentages.waterPercentage).toBeCloseTo(28.3, 10);
  });

  it('computes sugars: 500×0.29 + 100×1.00 = 245 g', () => {
    expect(result.totals.sugarGrams).toBeCloseTo(245, 10);
    expect(result.percentages.sugarPercentage).toBeCloseTo(24.5, 10);
  });

  it('computes dry matter as total − water', () => {
    expect(result.totals.dryMatterGrams).toBeCloseTo(717, 10);
    expect(result.percentages.dryMatterPercentage).toBeCloseTo(71.7, 10);
  });

  it('water % + dry matter % = 100 %', () => {
    expect(result.percentages.waterPercentage + result.percentages.dryMatterPercentage).toBeCloseTo(
      100,
      10,
    );
  });

  it('computes total fat as non-cocoa-butter fat + cocoa butter (Excel D36)', () => {
    // cream 300×0.33 = 99 ; cocoa butter 500×0.42 = 210
    expect(result.totals.fatGrams).toBeCloseTo(99, 10);
    expect(result.totals.cocoaButterGrams).toBeCloseTo(210, 10);
    expect(result.totals.totalFatGrams).toBeCloseTo(309, 10);
    expect(result.percentages.totalFatPercentage).toBeCloseTo(30.9, 10);
  });

  it('computes cocoa solids and milk solids separately', () => {
    expect(result.totals.cocoaSolidsGrams).toBeCloseTo(145, 10); // 500×0.29
    expect(result.totals.milkSolidsGrams).toBeCloseTo(18, 10); // 300×0.06
  });

  it('reports full data completeness when every ingredient sums to 100 %', () => {
    expect(result.totals.unaccountedGrams).toBeCloseTo(0, 8);
    expect(result.analysis.dataCompletenessPercentage).toBeCloseTo(100, 8);
    expect(result.analysis.incompleteIngredients).toHaveLength(0);
  });
});

describe('sugar / water ratio (spec §17)', () => {
  it('350 g sugar over 175 g water is 2.00', () => {
    expect(calculateSugarWaterRatio(350, 175)).toBeCloseTo(2, 10);
    expect(formatRatio(calculateSugarWaterRatio(350, 175))).toBe('2.00 : 1');
  });

  it('returns null — never Infinity — for an anhydrous recipe (spec §44)', () => {
    const sugarOnly = makeIngredient('Сахар', { sugarPercentage: 100 });
    const result = calculateRecipe({ items: [item(sugarOnly, 500)] });
    expect(result.totals.waterGrams).toBe(0);
    expect(result.analysis.sugarWaterRatio).toBeNull();
    expect(formatRatio(result.analysis.sugarWaterRatio)).toBe('—');
  });
});

describe('scaling (spec §38)', () => {
  it('scales 1000 g to 2500 g with factor 2.5 and preserves percentages', () => {
    const base = calculateRecipe(thousandGramRecipe());
    const scaled = calculateRecipe({ ...thousandGramRecipe(), targetTotalWeightGrams: 2500 });

    expect(scaled.scaling.scaleFactor).toBeCloseTo(2.5, 10);
    expect(scaled.totals.totalWeightGrams).toBeCloseTo(2500, 8);
    expect(scaled.contributions[0].weightGrams).toBeCloseTo(1250, 8);

    for (let i = 0; i < base.contributions.length; i += 1) {
      expect(scaled.contributions[i].percentage).toBeCloseTo(base.contributions[i].percentage, 10);
    }
    expect(scaled.percentages.waterPercentage).toBeCloseTo(base.percentages.waterPercentage, 10);
    expect(scaled.percentages.sugarPercentage).toBeCloseTo(base.percentages.sugarPercentage, 10);
  });

  it('scales absolute grams linearly', () => {
    const scaled = calculateRecipe({ ...thousandGramRecipe(), targetTotalWeightGrams: 2500 });
    expect(scaled.totals.waterGrams).toBeCloseTo(283 * 2.5, 8);
    expect(scaled.totals.sugarGrams).toBeCloseTo(245 * 2.5, 8);
  });
});

describe('piece-based sizing (spec §37)', () => {
  it('50 pieces × 18 g resolves to a 900 g batch', () => {
    const result = calculateRecipe({ ...thousandGramRecipe(), pieceCount: 50, pieceWeightGrams: 18 });
    expect(result.scaling.targetTotalWeightGrams).toBe(900);
    expect(result.scaling.scaleFactor).toBeCloseTo(0.9, 10);
    expect(result.totals.totalWeightGrams).toBeCloseTo(900, 8);
  });

  it('piece sizing takes precedence over an explicit target weight', () => {
    const result = calculateRecipe({
      ...thousandGramRecipe(),
      targetTotalWeightGrams: 5000,
      pieceCount: 50,
      pieceWeightGrams: 18,
    });
    expect(result.totals.totalWeightGrams).toBeCloseTo(900, 8);
  });

  it('ignores an incomplete piece specification', () => {
    const result = calculateRecipe({ ...thousandGramRecipe(), pieceCount: 50 });
    expect(result.scaling.scaleFactor).toBe(1);
    expect(result.totals.totalWeightGrams).toBe(1000);
  });
});

describe('degenerate inputs never produce NaN / Infinity (spec §44)', () => {
  it('handles an empty recipe', () => {
    const result = calculateRecipe({ items: [] });
    expect(result.totals.totalWeightGrams).toBe(0);
    expect(result.percentages.waterPercentage).toBe(0);
    expect(result.analysis.sugarWaterRatio).toBeNull();
    expect(result.warnings.map((w) => w.code)).toContain('empty_recipe');
  });

  it('handles all-zero weights', () => {
    const sugar = makeIngredient('Сахар', { sugarPercentage: 100 });
    const result = calculateRecipe({ items: [item(sugar, 0)] });
    expect(Number.isFinite(result.percentages.sugarPercentage)).toBe(true);
    expect(result.percentages.sugarPercentage).toBe(0);
    expect(result.warnings.map((w) => w.code)).toContain('zero_total_weight');
  });

  it('clamps negative weights to zero and warns', () => {
    const sugar = makeIngredient('Сахар', { sugarPercentage: 100 });
    const result = calculateRecipe({ items: [item(sugar, -50), item(sugar, 100)] });
    expect(result.totals.totalWeightGrams).toBe(100);
    expect(result.warnings.map((w) => w.code)).toContain('negative_weight');
  });

  it('every numeric field of the result is finite for a degenerate recipe', () => {
    const result = calculateRecipe({ items: [], targetTotalWeightGrams: 500 });
    const walk = (value: unknown): void => {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(result);
  });

  it('safeDivide returns null rather than Infinity', () => {
    expect(safeDivide(1, 0)).toBeNull();
    expect(safeDivide(0, 0)).toBeNull();
    expect(safeDivide(Number.NaN, 1)).toBeNull();
  });
});

describe('incomplete ingredient data is surfaced, not hidden', () => {
  it('reports unaccounted mass instead of normalising it away', () => {
    // 79 % water and nothing else declared — a real row from the Database.
    const alco = makeIngredient('Alco lichi', { category: 'alcohol', waterPercentage: 79 });
    const result = calculateRecipe({ items: [item(alco, 100)] });

    expect(result.totals.waterGrams).toBeCloseTo(79, 10);
    expect(result.totals.unaccountedGrams).toBeCloseTo(21, 10);
    expect(result.percentages.unaccountedPercentage).toBeCloseTo(21, 10);
    // dry matter is still total − water, per the spec definition
    expect(result.totals.dryMatterGrams).toBeCloseTo(21, 10);
    // but none of it is described by a declared solid component
    expect(result.totals.accountedSolidsGrams).toBeCloseTo(0, 10);
    expect(result.warnings.map((w) => w.code)).toContain('incomplete_ingredient_data');
  });

  it('flags ingredients whose components exceed 100 %', () => {
    const bad = makeIngredient('fruit puree кокс capfruit', {
      sugarPercentage: 22,
      fatPercentage: 24.6,
      otherSolidsPercentage: 27,
      waterPercentage: 50.7,
    });
    const result = calculateRecipe({ items: [item(bad, 100)] });
    expect(result.warnings.map((w) => w.code)).toContain('component_sum_exceeds_100');
    expect(result.totals.unaccountedGrams).toBeLessThan(0);
  });
});

describe('cost (Excel calculator!M31)', () => {
  it('computes batch cost and cost per kg', () => {
    const priced = makeIngredient('Сливки 33 %', { waterPercentage: 61, pricePerKg: 100 });
    const free = makeIngredient('Вода', { waterPercentage: 100 });
    const result = calculateRecipe({ items: [item(priced, 500), item(free, 500)] });
    expect(result.totals.totalCost).toBeCloseTo(50, 10); // 500 g × 100/kg
    expect(result.totals.costPerKg).toBeCloseTo(50, 10); // per 1000 g of batch
  });

  it('returns null cost when no ingredient is priced', () => {
    const free = makeIngredient('Вода', { waterPercentage: 100 });
    const result = calculateRecipe({ items: [item(free, 500)] });
    expect(result.totals.totalCost).toBeNull();
    expect(result.totals.costPerKg).toBeNull();
  });
});
