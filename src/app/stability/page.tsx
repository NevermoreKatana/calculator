import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { StabilityView } from '@/components/stability-view';

export const metadata: Metadata = {
  title: 'Стабильность',
  description:
    'Активность воды по составу водной фазы, микробиологическая уязвимость, барьеры стабильности и ввод лабораторных измерений.',
};

export default function StabilityPage() {
  return (
    <PageShell
      title="Стабильность"
      subtitle="Физико-химическое состояние продукта в момент изготовления: активность воды по составу водной фазы, микробиологическая уязвимость и наличие барьеров. Каждое число можно раскрыть до формулы и источника."
    >
      <StabilityView />
    </PageShell>
  );
}
