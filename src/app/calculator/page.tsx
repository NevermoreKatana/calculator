import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { CalculatorView } from '@/components/calculator/calculator-view';

export const metadata: Metadata = {
  title: 'Калькулятор',
  description: 'Расчёт рецептуры ганаша: вес, проценты, вода, сахара, сухая масса.',
};

export default function CalculatorPage() {
  return (
    <PageShell
      title="Калькулятор рецептуры"
      subtitle="Задайте количество конфет или общий вес — состав пересчитается автоматически. Проценты не меняются при масштабировании."
    >
      <CalculatorView />
    </PageShell>
  );
}
