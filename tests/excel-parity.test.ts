import { describe, expect, it } from 'vitest';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { item, makeIngredient } from './helpers';

/**
 * Parity with «формирование ганаша программа.xlsx».
 *
 * The workbook shipped with a saved recipe on the `calculator` sheet
 * (total 606.8 g). Every expected number below is the value Excel itself had
 * cached in the file, read out of xl/worksheets/sheet2.xml. If this suite
 * passes, the TypeScript engine reproduces the source model exactly for the
 * rows whose Excel formulas were intact.
 *
 * Excel column → component mapping (verified via calculator!D1:J1 VLOOKUP
 * indices into Database!$A:$J):
 *   F ← Database!B  сахара        G ← Database!C  жиры (кроме масла какао)
 *   H ← Database!D  масло какао   I ← Database!E  сухое молоко
 *   J ← Database!F  сухие какао   K ← Database!G  прочие сухие
 *   L ← Database!H  вода          N ← Database!J  сладость
 */

const EXCEL_TOTAL = 606.8;

// Ingredients exactly as stored in the Database sheet.
const creams33 = makeIngredient('Сливки 33%', {
  category: 'dairy',
  fatPercentage: 33,
  milkSolidsPercentage: 2.5,
  waterPercentage: 61.3,
  pricePerKg: 100,
});
const sorbitol = makeIngredient('sugar sorbitol', {
  category: 'sugar',
  sugarPercentage: 100,
  sweetness: 50,
});
const callebaut823 = makeIngredient('callebaut 823', {
  category: 'chocolate',
  sugarPercentage: 42,
  fatPercentage: 6,
  cocoaButterPercentage: 30,
  milkSolidsPercentage: 16.5,
  cocoaSolidsPercentage: 3,
  sweetness: 42,
});
const cherryPuree = makeIngredient('fruit puree вишня', {
  category: 'fruit',
  sugarPercentage: 21.1,
  waterPercentage: 73.1,
  sweetness: 21.1,
});
const butterFresh = makeIngredient('butter fresh', {
  category: 'dairy',
  fatPercentage: 82,
  milkSolidsPercentage: 2,
  waterPercentage: 16,
});
const invertSugar = makeIngredient('sugar inverted', {
  category: 'sugar',
  sugarPercentage: 82,
  waterPercentage: 18,
  sweetness: 127,
});

describe('per-line parity with the saved Excel recipe', () => {
  // Weight fraction of the 606.8 g batch, as Excel computed it in column E.
  const asFractionOfBatch = (grams: number) => grams / EXCEL_TOTAL;

  it('Сливки 33 %, 12 g — matches Excel F6:L6', () => {
    const result = calculateRecipe({ items: [item(creams33, 12)] });
    const c = result.contributions[0];
    expect(asFractionOfBatch(c.fatGrams)).toBeCloseTo(6.5260382333553069e-3, 12);
    expect(asFractionOfBatch(c.milkSolidsGrams)).toBeCloseTo(4.9439683586025051e-4, 12);
    expect(asFractionOfBatch(c.waterGrams)).toBeCloseTo(1.2122610415293342e-2, 12);
    expect(asFractionOfBatch(c.sugarGrams)).toBeCloseTo(0, 12);
  });

  it('callebaut 823, 350 g — matches Excel F10:J10', () => {
    const result = calculateRecipe({ items: [item(callebaut823, 350)] });
    const c = result.contributions[0];
    expect(asFractionOfBatch(c.sugarGrams)).toBeCloseTo(0.24225444957152276, 12);
    expect(asFractionOfBatch(c.fatGrams)).toBeCloseTo(3.4607778510217534e-2, 12);
    expect(asFractionOfBatch(c.cocoaButterGrams)).toBeCloseTo(0.17303889255108768, 12);
    expect(asFractionOfBatch(c.milkSolidsGrams)).toBeCloseTo(9.517139090309823e-2, 12);
    expect(asFractionOfBatch(c.cocoaSolidsGrams)).toBeCloseTo(1.7303889255108767e-2, 12);
  });

  it('fruit puree вишня, 170 g — matches Excel F11 and L11', () => {
    const result = calculateRecipe({ items: [item(cherryPuree, 170)] });
    const c = result.contributions[0];
    expect(asFractionOfBatch(c.sugarGrams)).toBeCloseTo(5.9113381674357285e-2, 12);
    expect(asFractionOfBatch(c.waterGrams)).toBeCloseTo(0.20479564930784444, 12);
  });

  it('butter fresh, 3 g — matches Excel G12, I12, L12', () => {
    const result = calculateRecipe({ items: [item(butterFresh, 3)] });
    const c = result.contributions[0];
    expect(asFractionOfBatch(c.fatGrams)).toBeCloseTo(4.0540540540540543e-3, 12);
    expect(asFractionOfBatch(c.milkSolidsGrams)).toBeCloseTo(9.8879367172050102e-5, 12);
    expect(asFractionOfBatch(c.waterGrams)).toBeCloseTo(7.9103493737640081e-4, 12);
  });

  it('sugar sorbitol, 33 g — matches Excel F9 and the sweetness column N9', () => {
    const result = calculateRecipe({ items: [item(sorbitol, 33)] });
    const c = result.contributions[0];
    expect(asFractionOfBatch(c.sugarGrams)).toBeCloseTo(5.4383651944627562e-2, 12);
    expect(asFractionOfBatch(c.sweetnessGrams)).toBeCloseTo(2.7191825972313781e-2, 12);
  });
});

describe('the repaired recipe (Excel #REF! rows wired to their own ingredient)', () => {
  /**
   * The workbook's rows 7 and 8 were broken: row 7 looked up `#REF!` and row 8
   * looked up row 7's name instead of its own, so 0.8 g of invert sugar and 3 g
   * of glucose contributed nothing or the wrong thing. Row 13 held 35 g against
   * an empty ingredient cell.
   *
   * This is the same recipe with row 7 wired correctly. The 3 g "glucose" line
   * is dropped because no such ingredient exists in the Database (it holds
   * `sugar glucose 40DE` / `60DE`), and the 35 g nameless line is dropped too —
   * both are recorded as unresolved in docs/calculation-model.md rather than
   * being guessed at.
   */
  const repaired = calculateRecipe({
    items: [
      item(creams33, 12),
      item(invertSugar, 0.8),
      item(sorbitol, 33),
      item(callebaut823, 350),
      item(cherryPuree, 170),
      item(butterFresh, 3),
    ],
  });

  it('totals 568.8 g', () => {
    expect(repaired.totals.totalWeightGrams).toBeCloseTo(568.8, 10);
  });

  it('water is 132.25 g ≈ 23.25 %', () => {
    // 12×0.613 + 0.8×0.18 + 170×0.731 + 3×0.16 = 132.25
    expect(repaired.totals.waterGrams).toBeCloseTo(132.25, 8);
    expect(repaired.percentages.waterPercentage).toBeCloseTo(23.2507, 3);
  });

  it('sugars are 216.526 g ≈ 38.07 %', () => {
    // 0.8×0.82 + 33×1 + 350×0.42 + 170×0.211 = 216.526
    expect(repaired.totals.sugarGrams).toBeCloseTo(216.526, 8);
    expect(repaired.percentages.sugarPercentage).toBeCloseTo(38.0672, 3);
  });

  it('dry matter is total − water', () => {
    expect(repaired.totals.dryMatterGrams).toBeCloseTo(568.8 - 132.25, 8);
    expect(
      repaired.percentages.waterPercentage + repaired.percentages.dryMatterPercentage,
    ).toBeCloseTo(100, 10);
  });

  it('total fat follows Excel D36 = G30 + H30', () => {
    // fats: 12×0.33 + 350×0.06 + 3×0.82 = 27.42 ; cocoa butter: 350×0.30 = 105
    expect(repaired.totals.fatGrams).toBeCloseTo(27.42, 8);
    expect(repaired.totals.cocoaButterGrams).toBeCloseTo(105, 8);
    expect(repaired.totals.totalFatGrams).toBeCloseTo(132.42, 8);
  });

  it('exposes the Database rows that do not sum to 100 %', () => {
    // Сливки 33% sums to 96.8 %, callebaut 823 to 97.5 %, вишня to 94.2 %.
    const names = repaired.analysis.incompleteIngredients.map((i) => i.name);
    expect(names).toContain('Сливки 33%');
    expect(names).toContain('callebaut 823');
    expect(names).toContain('fruit puree вишня');
    expect(repaired.totals.unaccountedGrams).toBeGreaterThan(0);
  });
});

describe('page-print scaling parity (Excel A2 = G31 / calculator!D30)', () => {
  it('reproduces the 400 g target scaling from the `page print` sheet', () => {
    const items = [
      item(creams33, 12),
      item(sorbitol, 33),
      item(callebaut823, 350),
      item(cherryPuree, 170),
      item(butterFresh, 3),
    ];
    const base = items.reduce((s, i) => s + i.weightGrams, 0); // 568 g
    const scaled = calculateRecipe({ items, targetTotalWeightGrams: 400 });

    expect(scaled.scaling.scaleFactor).toBeCloseTo(400 / base, 12);
    expect(scaled.totals.totalWeightGrams).toBeCloseTo(400, 8);
    // Excel G13 = A2 × D6 for Сливки 33 %
    expect(scaled.contributions[0].weightGrams).toBeCloseTo(12 * (400 / base), 8);
  });
});
