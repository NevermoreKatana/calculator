import type { IngredientCategory } from '../calculator/types';

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  chocolate: 'Шоколад',
  cocoa: 'Какао',
  dairy: 'Молочное',
  fruit: 'Фрукты',
  sugar: 'Сахара',
  nut: 'Орехи',
  alcohol: 'Алкоголь',
  fat: 'Жиры',
  other: 'Прочее',
};

export const COMPONENT_LABELS = {
  sugarPercentage: 'Сахара',
  fatPercentage: 'Жиры (кроме масла какао)',
  cocoaButterPercentage: 'Масло какао',
  milkSolidsPercentage: 'Сухое молоко',
  cocoaSolidsPercentage: 'Сухие какао',
  otherSolidsPercentage: 'Прочие сухие',
  waterPercentage: 'Вода',
} as const;
