'use client';

import { useRouter } from 'next/navigation';
import { useRecipe } from '@/lib/store/recipe-store';
import { Button } from '@/components/ui';

/**
 * Starts a genuinely new recipe.
 *
 * This has to reset the store, not just navigate: the working recipe is
 * persisted in localStorage together with the id of whichever saved recipe was
 * opened last. Navigating to /calculator without clearing that id made the
 * next "Сохранить" overwrite the previously opened recipe instead of creating
 * a new one.
 */
export function NewRecipeButton({
  variant = 'primary',
}: {
  variant?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const { reset } = useRecipe();

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => {
        reset();
        router.push('/calculator');
      }}
    >
      Новый рецепт
    </Button>
  );
}
