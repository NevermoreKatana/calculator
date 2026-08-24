import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { CompositionView } from '@/components/composition-view';

export const metadata: Metadata = {
  title: 'Состав',
  description: 'Состав рецепта: жиры, сахара, какао, молочные сухие, вода, сухая масса.',
};

export default function CompositionPage() {
  return (
    <PageShell
      title="Состав рецепта"
      subtitle="Разложение текущего рецепта по компонентам. Категории повторяют модель исходной таблицы Excel, плюс отдельная доля «не учтено»."
    >
      <CompositionView />
    </PageShell>
  );
}
