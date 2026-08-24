'use client';

import * as React from 'react';
import type { Ingredient } from '@/lib/calculator/types';
import { RecipeProvider } from '@/lib/store/recipe-store';

const IngredientsErrorContext = React.createContext<string | null>(null);

export function useIngredientsError(): string | null {
  return React.useContext(IngredientsErrorContext);
}

export function AppProviders({
  ingredients,
  ingredientsError,
  children,
}: {
  ingredients: Ingredient[];
  ingredientsError: string | null;
  children: React.ReactNode;
}) {
  return (
    <IngredientsErrorContext.Provider value={ingredientsError}>
      <RecipeProvider ingredients={ingredients}>{children}</RecipeProvider>
    </IngredientsErrorContext.Provider>
  );
}
