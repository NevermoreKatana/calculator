import type {
  CalculationWarning,
  IngredientContribution,
  RecipeAnalysis,
  RecipeCalculation,
  RecipeInput,
} from './types';
import { calculateIngredientContribution, componentSum } from './calculateIngredientContribution';
import { calculatePercentages } from './calculatePercentages';
import { calculateTotals } from './calculateTotals';
import { calculateSugarWaterRatio } from './calculateSugars';
import { finiteOrZero, safePercentage } from './numeric';
import { resolveScaling } from './scaling';

/** Below this the ingredient row is treated as materially incomplete. */
const COMPLETENESS_FLOOR = 99.5;
/** Above this the ingredient row over-declares its own mass. */
const COMPLETENESS_CEILING = 100.5;

/**
 * Single entry point for recipe arithmetic (spec §6: no calculation lives in a
 * React component). Pure and synchronous — given the same input it always
 * returns the same result, which is what makes the engine unit-testable.
 *
 * Pipeline:
 *   1. resolve scaling (piece count → target weight → factor)
 *   2. scale each line
 *   3. per-line component grams
 *   4. recipe totals
 *   5. percentages
 *   6. derived analysis (sugar/water ratio, data completeness)
 */
export function calculateRecipe(input: RecipeInput): RecipeCalculation {
  const warnings: CalculationWarning[] = [];
  const scaling = resolveScaling(input);

  if (input.items.length === 0) {
    warnings.push({
      code: 'empty_recipe',
      message: 'Рецепт пуст — добавьте хотя бы один ингредиент.',
    });
  }

  if (input.items.some((item) => finiteOrZero(item.weightGrams) < 0)) {
    warnings.push({
      code: 'negative_weight',
      message: 'Отрицательный вес ингредиента интерпретирован как 0 г.',
    });
  }

  if (scaling.targetTotalWeightGrams !== null && scaling.baseTotalWeightGrams === 0) {
    warnings.push({
      code: 'target_weight_ignored',
      message:
        'Целевой вес не применён: у рецепта нулевой исходный вес, коэффициент масштабирования не определён.',
      detail: 'Задайте вес хотя бы одного ингредиента, чтобы включить масштабирование.',
    });
  }

  // Scale first, so every downstream number describes the final batch.
  const scaledItems = input.items.map((item) => ({
    ...item,
    weightGrams: Math.max(0, finiteOrZero(item.weightGrams)) * scaling.scaleFactor,
  }));

  const totalWeightGrams = scaledItems.reduce((sum, item) => sum + item.weightGrams, 0);

  if (input.items.length > 0 && totalWeightGrams === 0) {
    warnings.push({
      code: 'zero_total_weight',
      message: 'Общий вес рецепта равен 0 г — проценты и производные показатели не определены.',
    });
  }

  const contributions: IngredientContribution[] = scaledItems.map((item) =>
    calculateIngredientContribution(item, totalWeightGrams),
  );

  const totals = calculateTotals(contributions, totalWeightGrams);
  const percentages = calculatePercentages(totals);

  const incompleteIngredients: RecipeAnalysis['incompleteIngredients'] = [];
  for (const item of input.items) {
    if (finiteOrZero(item.weightGrams) <= 0) continue;
    const sum = componentSum(item.ingredient);
    if (sum < COMPLETENESS_FLOOR || sum > COMPLETENESS_CEILING) {
      incompleteIngredients.push({
        ingredientId: item.ingredient.id,
        name: item.ingredient.name,
        componentSum: sum,
      });
    }
  }

  if (incompleteIngredients.some((i) => i.componentSum > COMPLETENESS_CEILING)) {
    warnings.push({
      code: 'component_sum_exceeds_100',
      message:
        'У одного или нескольких ингредиентов сумма компонентов превышает 100 % — данные источника противоречивы.',
      detail: incompleteIngredients
        .filter((i) => i.componentSum > COMPLETENESS_CEILING)
        .map((i) => `${i.name}: ${i.componentSum.toFixed(1)} %`)
        .join('; '),
    });
  } else if (incompleteIngredients.length > 0) {
    warnings.push({
      code: 'incomplete_ingredient_data',
      message:
        'Состав некоторых ингредиентов описан не полностью — часть массы отнесена к «не учтено».',
      detail: incompleteIngredients
        .map((i) => `${i.name}: ${i.componentSum.toFixed(1)} %`)
        .join('; '),
    });
  }

  const describedGrams = totals.accountedSolidsGrams + totals.waterGrams;

  const analysis: RecipeAnalysis = {
    sugarWaterRatio: calculateSugarWaterRatio(totals.sugarGrams, totals.waterGrams),
    dataCompletenessPercentage: safePercentage(describedGrams, totalWeightGrams) ?? 0,
    incompleteIngredients,
  };

  return { scaling, contributions, totals, percentages, analysis, warnings };
}
