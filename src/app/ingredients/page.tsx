import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { IngredientsView } from '@/components/ingredients-view';
import { loadIngredientsSafely } from '@/lib/ingredients/load';

export const metadata: Metadata = {
  title: 'Ингредиенты',
  description: 'База ингредиентов: состав, вода, сахара, жиры, какао-компоненты.',
};

export default async function IngredientsPage() {
  const { ingredients, error } = await loadIngredientsSafely();

  return (
    <PageShell
      title="База ингредиентов"
      subtitle="Импортировано из листа Database исходной книги Excel. Значения показаны как есть: строки, состав которых не суммируется до 100 %, помечены, но не нормализованы."
    >
      <IngredientsView initialIngredients={ingredients} loadError={error} />
    </PageShell>
  );
}
