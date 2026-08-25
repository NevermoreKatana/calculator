import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { ScienceReferenceView } from '@/components/science/science-reference-view';

export const metadata: Metadata = {
  title: 'Научная справка',
  description:
    'Реестр научных формул, констант, микробиологических порогов и источников. Что можно рассчитать, что нужно измерить, а где данных недостаточно.',
};

export default function SciencePage() {
  return (
    <PageShell
      title="Научная справка"
      subtitle="Каждое число в приложении можно проследить до формулы и опубликованного источника. Здесь собраны реестры целиком: формулы с областью применимости, константы с диапазонами проверки, микробиологические пороги с расхождениями между источниками и полный список литературы с оговорками."
    >
      <ScienceReferenceView />
    </PageShell>
  );
}
