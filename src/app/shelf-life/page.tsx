import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { ShelfLifeView } from '@/components/shelf-life-view';

export const metadata: Metadata = {
  title: 'Срок годности',
  description:
    'Теоретическая оценка срока годности по эмпирическим контрольным точкам, активность воды и микробиологические зоны.',
};

export default function ShelfLifePage() {
  return (
    <PageShell
      title="Срок годности"
      subtitle="Оценка строится только на эмпирических контрольных точках. Формула, связывающая состав со сроком хранения, не выдумывается: если рецепт вне области наблюдений, результат — «недостаточно данных»."
    >
      <ShelfLifeView />
    </PageShell>
  );
}
