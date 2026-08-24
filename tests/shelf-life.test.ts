import { describe, expect, it } from 'vitest';
import { calculateShelfLifeEstimate } from '@/lib/shelf-life/estimate';
import { buildRecommendations } from '@/lib/shelf-life/recommendations';
import {
  REFERENCE_ENVELOPE,
  SHELF_LIFE_DISCLAIMER,
  SHELF_LIFE_REFERENCE_POINTS,
} from '@/lib/shelf-life/reference-points';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { calculateShelfLife } from '@/lib/calculator/calculateShelfLife';
import { item, makeIngredient } from './helpers';

const base = { dryMatterPercentage: 80, totalWeightGrams: 1000 };

describe('reference points reproduce the supplied empirical values (spec §42)', () => {
  it('17.5 % water + 35 % sugar → ≈ 90 days', () => {
    const e = calculateShelfLifeEstimate({
      ...base,
      waterPercentage: 17.5,
      sugarPercentage: 35,
      dryMatterPercentage: 82.5,
    });
    expect(e.available).toBe(true);
    expect(e.method).toBe('reference_point_match');
    expect(e.daysMin).toBe(90);
    expect(e.daysMax).toBe(90);
  });

  it('18.6 % water + 32 % sugar → 58–63 days', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 18.6, sugarPercentage: 32 });
    expect(e.available).toBe(true);
    expect(e.method).toBe('reference_point_match');
    expect(e.daysMin).toBe(58);
    expect(e.daysMax).toBe(63);
  });

  it('20 % water + 30 % sugar → 38–44 days', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 20, sugarPercentage: 30 });
    expect(e.available).toBe(true);
    expect(e.daysMin).toBe(38);
    expect(e.daysMax).toBe(44);
  });

  it('20 % water + 32 % sugar → 38–44 days (the sugar range in the source)', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 20, sugarPercentage: 32 });
    expect(e.available).toBe(true);
    expect(e.daysMin).toBe(38);
    expect(e.daysMax).toBe(44);
  });

  it('stores exactly the three supplied points', () => {
    expect(SHELF_LIFE_REFERENCE_POINTS).toHaveLength(3);
    expect(REFERENCE_ENVELOPE.waterMin).toBe(17.5);
    expect(REFERENCE_ENVELOPE.waterMax).toBe(20);
  });
});

describe('interpolation is explicit and bounded (spec §14)', () => {
  it('interpolates between point 1 and point 2 and says so', () => {
    // Midpoint by water: 18.05 %; sugar on the trajectory is 33.5 %.
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 18.05, sugarPercentage: 33.5 });
    expect(e.available).toBe(true);
    expect(e.method).toBe('linear_interpolation');
    expect(e.methodLabel).toBe('Интерполяция между эмпирическими контрольными точками');
    expect(e.basis).toHaveLength(2);
    // t = 0.5 → min 90→58 gives 74 ; max 90→63 gives 76.5
    expect(e.daysMin).toBeCloseTo(74, 6);
    expect(e.daysMax).toBeCloseTo(76.5, 6);
  });

  it('always returns min ≤ max', () => {
    for (let w = 17.5; w <= 20; w += 0.05) {
      const sugar = w <= 18.6 ? 35 - ((w - 17.5) / 1.1) * 3 : 32 - ((w - 18.6) / 1.4) * 1;
      const e = calculateShelfLifeEstimate({ ...base, waterPercentage: w, sugarPercentage: sugar });
      if (e.available) expect(e.daysMin!).toBeLessThanOrEqual(e.daysMax!);
    }
  });

  it('shelf life decreases monotonically as water rises along the trajectory', () => {
    const at = (w: number, s: number) =>
      calculateShelfLifeEstimate({ ...base, waterPercentage: w, sugarPercentage: s });
    const a = at(17.8, 34.2);
    const b = at(18.3, 32.8);
    expect(a.daysMax!).toBeGreaterThan(b.daysMax!);
  });

  it('refuses when sugar leaves the trajectory the two points describe', () => {
    // 18.05 % water sits between the points, but 12 % sugar is far off-path.
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 18.05, sugarPercentage: 12 });
    expect(e.available).toBe(false);
    expect(e.method).toBe('insufficient_data');
    expect(e.daysMin).toBeNull();
    expect(e.reason).toContain('Нет достаточной эмпирической информации');
  });
});

describe('no extrapolation outside the empirical envelope (spec §13)', () => {
  it('refuses below 17.5 % water', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 10, sugarPercentage: 35 });
    expect(e.available).toBe(false);
    expect(e.reason).toContain('ниже диапазона');
  });

  it('refuses above 20 % water', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 28, sugarPercentage: 30 });
    expect(e.available).toBe(false);
    expect(e.reason).toContain('выше диапазона');
  });

  it('refuses a zero-weight recipe', () => {
    const e = calculateShelfLifeEstimate({
      waterPercentage: 0,
      sugarPercentage: 0,
      dryMatterPercentage: 0,
      totalWeightGrams: 0,
    });
    expect(e.available).toBe(false);
  });

  it('never returns a number without a stated method', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 40, sugarPercentage: 5 });
    expect(e.daysMin).toBeNull();
    expect(e.daysMax).toBeNull();
    expect(e.methodLabel).toBe('Недостаточно данных для оценки');
  });
});

describe('a_w never influences the day count (spec §22)', () => {
  it('the same recipe yields the same days with and without a measured a_w', () => {
    const withAw = calculateShelfLifeEstimate({
      ...base,
      waterPercentage: 18.6,
      sugarPercentage: 32,
      waterActivity: 0.7,
    });
    const withoutAw = calculateShelfLifeEstimate({
      ...base,
      waterPercentage: 18.6,
      sugarPercentage: 32,
    });
    expect(withAw.daysMin).toBe(withoutAw.daysMin);
    expect(withAw.daysMax).toBe(withoutAw.daysMax);
  });

  it('a very low a_w does not unlock an estimate outside the envelope', () => {
    const e = calculateShelfLifeEstimate({
      ...base,
      waterPercentage: 5,
      sugarPercentage: 60,
      waterActivity: 0.45,
    });
    expect(e.available).toBe(false);
  });

  it('records a_w as display-only in the notes', () => {
    const e = calculateShelfLifeEstimate({
      ...base,
      waterPercentage: 18.6,
      sugarPercentage: 32,
      waterActivity: 0.82,
    });
    expect(e.notes.join(' ')).toContain('не влияет на расчёт срока');
  });
});

describe('the disclaimer travels with every estimate (spec §25, §49)', () => {
  it('is attached to a successful estimate', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 17.5, sugarPercentage: 35 });
    expect(e.disclaimer.headline).toBe(SHELF_LIFE_DISCLAIMER.headline);
    expect(e.disclaimer.factors.length).toBeGreaterThan(10);
  });

  it('is attached to a refusal too', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 50, sugarPercentage: 1 });
    expect(e.disclaimer.headline).toBe(SHELF_LIFE_DISCLAIMER.headline);
  });

  it('carries the qualitative dry-matter statement (spec §15)', () => {
    const e = calculateShelfLifeEstimate({ ...base, waterPercentage: 17.5, sugarPercentage: 35 });
    expect(e.notes.join(' ')).toContain('Чем выше доля сухих веществ');
  });
});

describe('end-to-end from a recipe', () => {
  it('drives the estimate from calculated composition', () => {
    // 175 g water + 350 g sugar + 475 g inert solids = 1000 g → 17.5 % / 35 %
    const water = makeIngredient('Вода', { waterPercentage: 100 });
    const sugar = makeIngredient('Сахар', { sugarPercentage: 100 });
    const solids = makeIngredient('Сухие вещества', { otherSolidsPercentage: 100 });

    const calc = calculateRecipe({
      items: [item(water, 175), item(sugar, 350), item(solids, 475)],
    });
    expect(calc.percentages.waterPercentage).toBeCloseTo(17.5, 10);
    expect(calc.percentages.sugarPercentage).toBeCloseTo(35, 10);
    expect(calc.percentages.dryMatterPercentage).toBeCloseTo(82.5, 10);

    const estimate = calculateShelfLife(calc);
    expect(estimate.available).toBe(true);
    expect(estimate.daysMin).toBe(90);
  });
});

describe('recommendations are hints, not promises (spec §36)', () => {
  const estimate = calculateShelfLifeEstimate({ ...base, waterPercentage: 25, sugarPercentage: 20 });

  it('flags high water without promising extra days', () => {
    const recs = buildRecommendations({
      waterPercentage: 25,
      sugarPercentage: 20,
      dryMatterPercentage: 75,
      sugarWaterRatio: 0.8,
      estimate,
    });
    const water = recs.find((r) => r.id === 'water-high');
    expect(water).toBeDefined();
    expect(water!.body).toContain('потенциально');
    for (const rec of recs) {
      expect(rec.body).not.toMatch(/гарантир/i);
      expect(rec.body).not.toMatch(/увеличит срок/i);
    }
  });

  it('explains an undefined sugar/water ratio instead of hiding it', () => {
    const recs = buildRecommendations({
      waterPercentage: 0,
      sugarPercentage: 40,
      dryMatterPercentage: 100,
      sugarWaterRatio: null,
      estimate,
    });
    expect(recs.some((r) => r.id === 'ratio-undefined')).toBe(true);
  });
});
