'use client';

import * as React from 'react';
import { Card, CardContent, EmptyState, Notice } from '@/components/ui';
import { useRecipe } from '@/lib/store/recipe-store';
import { WaterActivityPanel } from '@/components/science/water-activity-panel';
import { SugarSpeciationPanel } from '@/components/science/sugar-speciation-panel';
import { HurdlePanel } from '@/components/science/hurdle-panel';
import { LabMeasurementsForm } from '@/components/science/lab-measurements-form';
import { MicrobialRiskPanel } from '@/components/science/microbial-risk-panel';

/**
 * Physico-chemical stability of the working recipe (spec §31 layers 5–8).
 *
 * Deliberately separate from /shelf-life: this page describes what the product
 * IS (water activity, barriers, microbiological exposure), while shelf-life
 * attempts the far weaker claim of how long it lasts. Merging them would let
 * the strong result lend borrowed authority to the weak one.
 */
export function StabilityView() {
  const { calculation, waterActivity, science, hurdles, recipe, hydrated } = useRecipe();

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="text-muted py-10 text-center text-sm">Загрузка…</CardContent>
      </Card>
    );
  }

  if (calculation.totals.totalWeightGrams <= 0) {
    return (
      <Card>
        <EmptyState
          icon={<span className="text-3xl">🧪</span>}
          title="Рецепт пуст"
          description="Соберите рецепт в калькуляторе — здесь появится анализ водной фазы, активности воды и барьеров стабильности."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Notice tone="neutral" title="Что показывает эта страница">
        Физико-химическое состояние продукта <strong>в момент изготовления</strong>: активность
        воды, состав водной фазы, микробиологическая уязвимость и наличие барьеров. Это{' '}
        <strong>не срок годности</strong> — теоретическая стабильность и подтверждённый срок
        хранения разграничены намеренно.
      </Notice>

      <WaterActivityPanel resolved={waterActivity} />

      <MicrobialRiskPanel
        waterActivity={waterActivity.result.value}
        measuredPH={recipe.measuredPH}
        storageTemperatureC={recipe.storageTemperatureC}
      />

      <HurdlePanel analysis={hurdles} />

      <SugarSpeciationPanel science={science} />

      <LabMeasurementsForm />
    </div>
  );
}
