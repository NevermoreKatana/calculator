import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EXAMPLE_RECIPES,
  resolveExample,
  getExampleRecipe,
  type ExampleRecipe,
} from '@/lib/examples/example-recipes';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { analyseRecipeScience } from '@/lib/calculator/calculateWaterActivity';
import { analyseHurdles } from '@/lib/science';
import type { Ingredient, IngredientCategory } from '@/lib/calculator/types';

/**
 * These tests are what makes the examples' captions trustworthy.
 *
 * Each example claims something ("a_w ≈ 0.891", "sucrose crystallises here").
 * Every claim is re-derived from the real engine against the real ingredient
 * database, so a caption cannot quietly go stale when a constant or a model
 * changes — this file fails first.
 */

// The examples must work against the catalogue the app actually ships.
const raw: unknown = JSON.parse(readFileSync('data/ingredients.json', 'utf8'));
const rows = (Array.isArray(raw) ? raw : (raw as { ingredients: unknown[] }).ingredients) as Record<
  string,
  never
>[];

const CATALOGUE: Ingredient[] = rows.map((r, i) => ({
  id: `ing-${i}`,
  name: r.name as unknown as string,
  category: r.category as unknown as IngredientCategory,
  brand: null,
  sugarPercentage: Number(r.sugarPercentage ?? 0),
  fatPercentage: Number(r.fatPercentage ?? 0),
  cocoaButterPercentage: Number(r.cocoaButterPercentage ?? 0),
  milkSolidsPercentage: Number(r.milkSolidsPercentage ?? 0),
  cocoaSolidsPercentage: Number(r.cocoaSolidsPercentage ?? 0),
  otherSolidsPercentage: Number(r.otherSolidsPercentage ?? 0),
  waterPercentage: Number(r.waterPercentage ?? 0),
  sweetness: Number(r.sweetness ?? 0),
  pricePerKg: null,
  source: null,
  sourceUrl: null,
  isCustom: false,
}));

/** Runs one example end-to-end, exactly as the app would. */
function runExample(example: ExampleRecipe) {
  const resolved = resolveExample(example, CATALOGUE);
  const items = resolved.items.map((item, i) => ({
    id: `item-${i}`,
    ingredient: item.ingredient,
    weightGrams: item.weightGrams,
  }));
  const calculation = calculateRecipe({ name: example.name, items });
  const ingredientsById = new Map(items.map((i) => [i.ingredient.id, i.ingredient]));
  const { waterActivity, adapted } = analyseRecipeScience(calculation, {
    ingredientsById,
    temperatureCelsius: example.conditions?.storageTemperatureC ?? 20,
  });
  return { resolved, calculation, waterActivity, adapted };
}

describe('example recipes resolve against the shipped ingredient database', () => {
  it('has unique ids and names', () => {
    const ids = EXAMPLE_RECIPES.map((e) => e.id);
    const names = EXAMPLE_RECIPES.map((e) => e.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(EXAMPLE_RECIPES.map((e) => ({ id: e.id, name: e.name })))(
    'every ingredient of "$name" exists in the catalogue',
    ({ id }) => {
      const example = getExampleRecipe(id) as ExampleRecipe;
      const resolved = resolveExample(example, CATALOGUE);
      expect(resolved.missingIngredientNames).toEqual([]);
      expect(resolved.complete).toBe(true);
      expect(resolved.items).toHaveLength(example.items.length);
    },
  );

  it('reports missing ingredients instead of silently dropping them', () => {
    const example = EXAMPLE_RECIPES[0];
    const resolved = resolveExample(example, []);
    expect(resolved.complete).toBe(false);
    expect(resolved.missingIngredientNames.length).toBe(example.items.length);
    expect(resolved.items).toEqual([]);
  });

  it('matches ingredient names case-insensitively', () => {
    const shouty = CATALOGUE.map((i) => ({ ...i, name: i.name.toUpperCase() }));
    expect(resolveExample(EXAMPLE_RECIPES[0], shouty).complete).toBe(true);
  });
});

describe('every caption is backed by what the engine actually computes', () => {
  it.each(EXAMPLE_RECIPES.map((e) => ({ id: e.id, name: e.name })))(
    '"$name" lands inside its declared a_w envelope',
    ({ id }) => {
      const example = getExampleRecipe(id) as ExampleRecipe;
      const { waterActivity } = runExample(example);

      expect(waterActivity.result.available).toBe(true);
      const aw = waterActivity.result.value as number;
      expect(aw).toBeGreaterThanOrEqual(example.expected.waterActivityMin);
      expect(aw).toBeLessThanOrEqual(example.expected.waterActivityMax);
    },
  );

  it.each(
    EXAMPLE_RECIPES.filter((e) => e.expected.warningCodes?.length).map((e) => ({
      id: e.id,
      name: e.name,
    })),
  )('"$name" raises the warnings its caption promises', ({ id }) => {
    const example = getExampleRecipe(id) as ExampleRecipe;
    const { waterActivity } = runExample(example);
    const codes = waterActivity.result.detail?.aqueousPhase.warnings.map((w) => w.code) ?? [];
    for (const expected of example.expected.warningCodes ?? []) {
      expect(codes, `${id} should warn ${expected}`).toContain(expected);
    }
  });

  it.each(
    EXAMPLE_RECIPES.filter((e) => e.expected.absentWarningCodes?.length).map((e) => ({
      id: e.id,
      name: e.name,
    })),
  )('"$name" does not raise warnings its caption denies', ({ id }) => {
    const example = getExampleRecipe(id) as ExampleRecipe;
    const { waterActivity } = runExample(example);
    const codes = waterActivity.result.detail?.aqueousPhase.warnings.map((w) => w.code) ?? [];
    for (const absent of example.expected.absentWarningCodes ?? []) {
      expect(codes, `${id} should NOT warn ${absent}`).not.toContain(absent);
    }
  });

  it('every example resolves all of its sugars to a species', () => {
    for (const example of EXAMPLE_RECIPES) {
      const { adapted } = runExample(example);
      expect(adapted.unresolvedIngredients, example.id).toEqual([]);
    }
  });

  it('compareWith only points at examples that exist', () => {
    for (const example of EXAMPLE_RECIPES) {
      for (const other of example.compareWith ?? []) {
        expect(getExampleRecipe(other), `${example.id} → ${other}`).not.toBeNull();
        expect(other).not.toBe(example.id);
      }
    }
  });
});

describe('the sugar-species comparison actually demonstrates §11', () => {
  const awOf = (id: string) => runExample(getExampleRecipe(id) as ExampleRecipe).waterActivity.result.value as number;

  it('orders DE 40 > DE 60 > invert sugar, at identical added mass', () => {
    const de40 = awOf('sugar-species-de40');
    const de60 = awOf('sugar-species-de60');
    const invert = awOf('sugar-species-invert');

    // Fewer, larger molecules depress a_w least. This is the whole point.
    expect(de40).toBeGreaterThan(de60);
    expect(de60).toBeGreaterThan(invert);
  });

  it('holds added mass and water constant across the three, so species is the only variable', () => {
    const runs = ['sugar-species-de40', 'sugar-species-de60', 'sugar-species-invert'].map((id) =>
      runExample(getExampleRecipe(id) as ExampleRecipe),
    );
    const totals = runs.map((r) => r.calculation.totals.totalWeightGrams);
    const waters = runs.map((r) => r.calculation.percentages.waterPercentage);

    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(0.001);
    // The three syrups differ by 1 pp of water in the source data (18 vs 19 %),
    // so the recipe's water differs by a hair; anything larger would mean the
    // comparison is not controlled.
    expect(Math.max(...waters) - Math.min(...waters)).toBeLessThan(0.2);
  });

  it('the spread between the extremes is large enough to matter', () => {
    expect(awOf('sugar-species-de40') - awOf('sugar-species-invert')).toBeGreaterThan(0.008);
  });
});

describe('examples demonstrate the hurdle behaviour their captions claim', () => {
  const hurdlesOf = (id: string) => {
    const example = getExampleRecipe(id) as ExampleRecipe;
    const { waterActivity, calculation } = runExample(example);
    const phase = waterActivity.result.detail?.aqueousPhase;
    return analyseHurdles({
      waterActivity: waterActivity.result.value,
      waterActivityMeasured: waterActivity.result.source === 'measured',
      measuredPH: example.conditions?.measuredPH ?? null,
      storageTemperatureC: example.conditions?.storageTemperatureC ?? null,
      dissolvedSolidsPercent: phase?.dissolvedSolidsPercent ?? null,
      hasPreservative: example.conditions?.hasPreservative ?? false,
      packagingSealed: example.conditions?.packagingSealed ?? null,
      chocolateShell: example.conditions?.chocolateShell ?? null,
      thermalTreatment: example.conditions?.thermalTreatment ?? null,
      fatPercentage: calculation.percentages.totalFatPercentage,
    });
  };

  it('the fruit filling shows a WORKING preservative barrier', () => {
    const h = hurdlesOf('fruit-filling-acid');
    expect(h.hurdles.find((x) => x.id === 'preservative')?.state).toBe('effective');
    expect(h.hurdles.find((x) => x.id === 'ph')?.state).toBe('effective');
  });

  it('the stable ganache shows a WORKING water-activity barrier', () => {
    expect(hurdlesOf('stable-target-aw').hurdles.find((x) => x.id === 'water_activity')?.state).toBe(
      'effective',
    );
  });

  it('the classic and cream-heavy ganaches show the a_w barrier failing', () => {
    expect(
      hurdlesOf('dark-classic-2-1').hurdles.find((x) => x.id === 'water_activity')?.state,
    ).toBe('absent');
    expect(
      hurdlesOf('cream-heavy-unstable').hurdles.find((x) => x.id === 'water_activity')?.state,
    ).toBe('absent');
  });

  it('the stable ganache clears the 65 °Brix mark and the classic one does not', () => {
    expect(
      hurdlesOf('stable-target-aw').hurdles.find((x) => x.id === 'sugar_concentration')?.state,
    ).toBe('effective');
    expect(
      hurdlesOf('dark-classic-2-1').hurdles.find((x) => x.id === 'sugar_concentration')?.state,
    ).not.toBe('effective');
  });
});
