'use client';

import * as React from 'react';
import type { Ingredient } from '@/lib/calculator/types';
import { componentSum } from '@/lib/calculator/calculateIngredientContribution';
import { Badge, Input } from '@/components/ui';
import { CATEGORY_LABELS } from '@/lib/ingredients/labels';
import { cn } from '@/lib/utils';

/**
 * Local, in-memory ingredient search.
 *
 * The whole catalogue (≈113 rows) is already in the client store, so filtering
 * is synchronous and needs no network call per keystroke (spec §45). Debounce
 * only matters for the external provider, which lives on /ingredients.
 */
export function IngredientPicker({
  ingredients,
  onSelect,
  placeholder = 'Найти ингредиент…',
}: {
  ingredients: Ingredient[];
  onSelect: (ingredient: Ingredient) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  // The highlight is stored together with the query it belongs to, so a new
  // query resets it during render instead of through a state-syncing effect.
  const [highlightState, setHighlightState] = React.useState({ query: '', index: 0 });
  const highlight = highlightState.query === query ? highlightState.index : 0;
  const setHighlight = React.useCallback(
    (next: number | ((current: number) => number)) =>
      setHighlightState((prev) => {
        const current = prev.query === query ? prev.index : 0;
        return { query, index: typeof next === 'function' ? next(current) : next };
      }),
    [query],
  );
  const containerRef = React.useRef<HTMLDivElement>(null);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients.slice(0, 12);
    return ingredients
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.brand ? i.brand.toLowerCase().includes(q) : false),
      )
      .slice(0, 40);
  }, [ingredients, query]);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const choose = (ingredient: Ingredient) => {
    onSelect(ingredient);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter' && open && matches[highlight]) {
      event.preventDefault();
      choose(matches[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls="ingredient-listbox"
        aria-autocomplete="list"
      />

      {open && matches.length > 0 ? (
        <ul
          id="ingredient-listbox"
          role="listbox"
          className="surface-card absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg py-1 shadow-[var(--shadow-raised)]"
        >
          {matches.map((ingredient, index) => {
            const sum = componentSum(ingredient);
            return (
              <li key={ingredient.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onPointerEnter={() => setHighlight(index)}
                  onClick={() => choose(ingredient)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    index === highlight ? 'bg-[var(--surface-sunken)]' : '',
                  )}
                >
                  <span className="flex-1 truncate">{ingredient.name}</span>
                  <Badge tone="neutral">{CATEGORY_LABELS[ingredient.category]}</Badge>
                  {sum < 99.5 ? (
                    <Badge tone="warning" title={`Состав описан на ${sum.toFixed(1)} %`}>
                      {sum.toFixed(0)} %
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {open && query.trim() && matches.length === 0 ? (
        <div className="surface-card text-muted absolute z-20 mt-1 w-full rounded-lg px-3 py-3 text-sm">
          Ничего не найдено. Добавить свой ингредиент можно на странице «Ингредиенты».
        </div>
      ) : null}
    </div>
  );
}
