'use client';

import * as React from 'react';
import type { Ingredient, RecipeInput } from '@/lib/calculator/types';
import { calculateRecipe } from '@/lib/calculator/calculateRecipe';
import { analyseRecipeScience } from '@/lib/calculator/calculateWaterActivity';
import { analyseHurdles, type HurdleAnalysis, type AdaptedRecipe } from '@/lib/science';
import { calculateShelfLife } from '@/lib/calculator/calculateShelfLife';
import type { RecipeCalculation } from '@/lib/calculator/types';
import type { ResolvedWaterActivity } from '@/lib/water-activity';
import type { ShelfLifeEstimate } from '@/lib/shelf-life';

/**
 * The working recipe, shared by /calculator, /composition and /shelf-life so
 * all three describe the same batch. Persisted to localStorage so a reload or
 * a page change never loses work.
 *
 * The store holds INPUT only. Every derived number comes from the pure engine
 * via useMemo, so no calculation lives in a component (spec §6).
 */

export interface WorkingItem {
  id: string;
  ingredientId: string;
  weightGrams: number;
}

export interface WorkingRecipe {
  id: string | null;
  name: string;
  description: string;
  items: WorkingItem[];
  targetTotalWeightGrams: number | null;
  pieceCount: number | null;
  pieceWeightGrams: number | null;
  useMeasuredAw: boolean;
  measuredWaterActivity: number | null;
  storageTemperatureC: number | null;
  productType: string;
  notes: string;

  /* ── Laboratory measurements (spec §51) ──────────────────────────────────
   * All optional. A measured value always outranks a computed one, and its
   * absence lowers the confidence of whatever depends on it rather than being
   * silently replaced by a default. */

  /** pH meter reading. Cannot be derived from a recipe (spec §16). */
  measuredPH: number | null;
  /** Refractometer reading on the water phase. */
  measuredBrix: number | null;
  /** Oven-dry moisture, % (ГОСТ 5900-2014). */
  measuredMoisturePercent: number | null;

  /* ── Process and packaging hurdles (spec §17) ─────────────────────────── */
  packagingSealed: boolean | null;
  chocolateShell: boolean | null;
  thermalTreatment: boolean | null;
  hasPreservative: boolean;
}

export const EMPTY_RECIPE: WorkingRecipe = {
  id: null,
  name: '',
  description: '',
  items: [],
  targetTotalWeightGrams: null,
  pieceCount: null,
  pieceWeightGrams: null,
  useMeasuredAw: false,
  measuredWaterActivity: null,
  storageTemperatureC: null,
  productType: '',
  notes: '',
  measuredPH: null,
  measuredBrix: null,
  measuredMoisturePercent: null,
  packagingSealed: null,
  chocolateShell: null,
  thermalTreatment: null,
  hasPreservative: false,
};

interface RecipeContextValue {
  ingredients: Ingredient[];
  ingredientsById: Map<string, Ingredient>;
  recipe: WorkingRecipe;
  /** True until localStorage has been read, so SSR and first paint agree. */
  hydrated: boolean;

  calculation: RecipeCalculation;
  waterActivity: ResolvedWaterActivity;
  shelfLife: ShelfLifeEstimate;
  /** Per-line sugar speciation and the aqueous-phase payload (spec §36). */
  science: AdaptedRecipe;
  /** Barrier-by-barrier stability picture (spec §17). */
  hurdles: HurdleAnalysis;

  addIngredient: (ingredientId: string, weightGrams?: number) => void;
  updateItemWeight: (itemId: string, weightGrams: number) => void;
  updateItemIngredient: (itemId: string, ingredientId: string) => void;
  removeItem: (itemId: string) => void;
  reorderItem: (itemId: string, direction: -1 | 1) => void;
  patch: (changes: Partial<WorkingRecipe>) => void;
  loadRecipe: (recipe: WorkingRecipe) => void;
  reset: () => void;
}

const RecipeContext = React.createContext<RecipeContextValue | null>(null);
const STORAGE_KEY = 'ganache-calculator.working-recipe.v1';

function makeId(): string {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Accepts only the shape we wrote; anything else falls back to an empty recipe. */
function parseStored(raw: string): WorkingRecipe | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<WorkingRecipe>;
    if (!Array.isArray(value.items)) return null;
    const items: WorkingItem[] = value.items
      .filter(
        (i): i is WorkingItem =>
          Boolean(i) &&
          typeof (i as WorkingItem).ingredientId === 'string' &&
          Number.isFinite((i as WorkingItem).weightGrams),
      )
      .map((i) => ({
        id: typeof i.id === 'string' ? i.id : makeId(),
        ingredientId: i.ingredientId,
        weightGrams: i.weightGrams,
      }));
    return { ...EMPTY_RECIPE, ...value, items };
  } catch {
    return null;
  }
}

/* ── External store ─────────────────────────────────────────────────────────
 * The working recipe lives outside React and is read through
 * useSyncExternalStore. That is the primitive designed for exactly this
 * situation: localStorage cannot be read during server render, so the server
 * snapshot is always the empty recipe and the client swaps in the persisted
 * one after mount — no hydration mismatch, and no setState inside an effect
 * triggering a cascading re-render.
 *
 * Module-level mutable state is safe here because this is a client module:
 * during SSR only `getServerSnapshot` runs, and it returns a frozen constant,
 * so nothing can leak between requests.
 * ────────────────────────────────────────────────────────────────────────── */

interface StoreState {
  recipe: WorkingRecipe;
  /** False until localStorage has been consulted. */
  hydrated: boolean;
}

const SERVER_STATE: StoreState = { recipe: EMPTY_RECIPE, hydrated: false };

let state: StoreState = SERVER_STATE;
let storageRead = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function readStorageOnce(): void {
  if (storageRead) return;
  storageRead = true;
  let recipe = EMPTY_RECIPE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) recipe = parseStored(raw) ?? EMPTY_RECIPE;
  } catch {
    /* private mode / disabled storage — start from an empty recipe */
  }
  state = { recipe, hydrated: true };
}

function subscribe(listener: () => void): () => void {
  if (!storageRead) {
    readStorageOnce();
    // Notify after the current commit so subscribers pick up the stored recipe.
    queueMicrotask(emit);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

function getServerSnapshot(): StoreState {
  return SERVER_STATE;
}

function commit(next: WorkingRecipe): void {
  state = { recipe: next, hydrated: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — persistence is a convenience, not a requirement */
  }
  emit();
}

function update(updater: (previous: WorkingRecipe) => WorkingRecipe): void {
  commit(updater(state.recipe));
}

export function RecipeProvider({
  ingredients,
  children,
}: {
  ingredients: Ingredient[];
  children: React.ReactNode;
}) {
  const { recipe, hydrated } = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const ingredientsById = React.useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  // Drop lines whose ingredient no longer exists, so a deleted ingredient can
  // never produce an undefined lookup inside the engine.
  const calculatorInput = React.useMemo<RecipeInput>(() => {
    const items = recipe.items
      .map((item) => {
        const ingredient = ingredientsById.get(item.ingredientId);
        return ingredient ? { id: item.id, ingredient, weightGrams: item.weightGrams } : null;
      })
      .filter((v): v is { id: string; ingredient: Ingredient; weightGrams: number } => v !== null);

    return {
      name: recipe.name,
      items,
      targetTotalWeightGrams: recipe.targetTotalWeightGrams,
      pieceCount: recipe.pieceCount,
      pieceWeightGrams: recipe.pieceWeightGrams,
    };
  }, [recipe, ingredientsById]);

  const calculation = React.useMemo(() => calculateRecipe(calculatorInput), [calculatorInput]);

  const { adapted: science, waterActivity } = React.useMemo(
    () =>
      analyseRecipeScience(calculation, {
        measuredValue: recipe.useMeasuredAw ? recipe.measuredWaterActivity : null,
        temperatureCelsius: recipe.storageTemperatureC,
        ingredientsById,
      }),
    [
      calculation,
      ingredientsById,
      recipe.useMeasuredAw,
      recipe.measuredWaterActivity,
      recipe.storageTemperatureC,
    ],
  );

  const hurdles = React.useMemo(() => {
    const detail = waterActivity.result.detail;
    const phase = detail?.aqueousPhase;
    const ethanolPercent =
      phase && phase.phaseMassGrams > 0
        ? ((phase.solutes.find((s) => s.species === 'ethanol')?.grams ?? 0) /
            phase.phaseMassGrams) *
          100
        : null;

    return analyseHurdles({
      waterActivity: waterActivity.result.value,
      waterActivityMeasured: waterActivity.result.source === 'measured',
      measuredPH: recipe.measuredPH,
      storageTemperatureC: recipe.storageTemperatureC,
      dissolvedSolidsPercent: phase?.dissolvedSolidsPercent ?? null,
      ethanolPercentOfWaterPhase: ethanolPercent,
      hasPreservative: recipe.hasPreservative,
      packagingSealed: recipe.packagingSealed,
      chocolateShell: recipe.chocolateShell,
      thermalTreatment: recipe.thermalTreatment,
      fatPercentage: calculation.percentages.totalFatPercentage,
    });
  }, [
    waterActivity,
    recipe.measuredPH,
    recipe.storageTemperatureC,
    recipe.hasPreservative,
    recipe.packagingSealed,
    recipe.chocolateShell,
    recipe.thermalTreatment,
    calculation.percentages.totalFatPercentage,
  ]);

  const shelfLife = React.useMemo(
    () => calculateShelfLife(calculation, { waterActivity: waterActivity.result.value }),
    [calculation, waterActivity.result.value],
  );

  const value = React.useMemo<RecipeContextValue>(
    () => ({
      ingredients,
      ingredientsById,
      recipe,
      hydrated,
      calculation,
      waterActivity,
      shelfLife,
      science,
      hurdles,

      addIngredient: (ingredientId, weightGrams = 0) =>
        update((prev) => ({
          ...prev,
          items: [...prev.items, { id: makeId(), ingredientId, weightGrams }],
        })),

      updateItemWeight: (itemId, weightGrams) =>
        update((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId
              ? { ...i, weightGrams: Number.isFinite(weightGrams) ? weightGrams : 0 }
              : i,
          ),
        })),

      updateItemIngredient: (itemId, ingredientId) =>
        update((prev) => ({
          ...prev,
          items: prev.items.map((i) => (i.id === itemId ? { ...i, ingredientId } : i)),
        })),

      removeItem: (itemId) =>
        update((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) })),

      reorderItem: (itemId, direction) =>
        update((prev) => {
          const index = prev.items.findIndex((i) => i.id === itemId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= prev.items.length) return prev;
          const items = [...prev.items];
          [items[index], items[target]] = [items[target], items[index]];
          return { ...prev, items };
        }),

      patch: (changes) => update((prev) => ({ ...prev, ...changes })),
      loadRecipe: (next) => commit(next),
      reset: () => commit(EMPTY_RECIPE),
    }),
    [
      ingredients,
      ingredientsById,
      recipe,
      hydrated,
      calculation,
      waterActivity,
      shelfLife,
      science,
      hurdles,
    ],
  );

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}

export function useRecipe(): RecipeContextValue {
  const context = React.useContext(RecipeContext);
  if (!context) throw new Error('useRecipe должен вызываться внутри <RecipeProvider>');
  return context;
}
