'use client';

import * as React from 'react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Notice } from '@/components/ui';
import {
  assessGrowthRisk,
  FDA_SAFETY_AW_THRESHOLD,
  UNIVERSAL_GROWTH_LIMIT_AW,
} from '@/lib/science';

/**
 * Which organisms have no barrier at this recipe's conditions (spec §18, §19).
 *
 * Answers "what could grow", not "what will grow" and not "how fast" — the
 * distinction is stated on the card rather than left for the user to infer.
 */
export function MicrobialRiskPanel({
  waterActivity,
  measuredPH,
  storageTemperatureC,
}: {
  waterActivity: number | null;
  measuredPH: number | null;
  storageTemperatureC: number | null;
}) {
  if (waterActivity === null || !Number.isFinite(waterActivity)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Микробиологическая уязвимость</CardTitle>
        </CardHeader>
        <CardContent>
          <Notice tone="warning">
            Без активности воды оценка невозможна. Введите измеренное значение или задайте
            состав так, чтобы модель могла его рассчитать.
          </Notice>
        </CardContent>
      </Card>
    );
  }

  const risks = assessGrowthRisk({
    waterActivity,
    pH: measuredPH,
    temperatureCelsius: storageTemperatureC,
    confectioneryOnly: true,
  });

  const possible = risks.filter((r) => r.growthPossible);
  const pathogens = possible.filter((r) => r.threshold.hazard === 'safety');
  const spoilage = possible.filter((r) => r.threshold.hazard === 'spoilage');
  const blocked = risks.filter((r) => !r.growthPossible);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Микробиологическая уязвимость</CardTitle>
        <CardDescription>
          Сопоставление a_w{measuredPH !== null ? ', pH' : ''}
          {storageTemperatureC !== null ? ' и температуры' : ''} с опубликованными пределами
          роста. Это ответ на вопрос «какие барьеры отсутствуют», а не прогноз порчи: перейдённый
          порог означает возможность роста, но не его скорость.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {possible.length === 0 ? (
          <Notice tone="success" title="Барьер по активности воды работает">
            При a_w = {waterActivity.toFixed(3)} рост ни одного из релевантных организмов не
            документирован. Абсолютный предел роста в пищевых системах —{' '}
            {UNIVERSAL_GROWTH_LIMIT_AW.value}.
          </Notice>
        ) : (
          <>
            {pathogens.length > 0 ? (
              <Notice tone="danger" title="Возможен рост патогенов">
                a_w = {waterActivity.toFixed(3)} превышает порог безопасности FDA{' '}
                {FDA_SAFETY_AW_THRESHOLD.value}. Продукт требует дополнительных барьеров или
                холодильного хранения.
              </Notice>
            ) : (
              <Notice tone="success" title="Патогены заблокированы">
                При a_w = {waterActivity.toFixed(3)} рост патогенных бактерий не ожидается.
                Порча при этом возможна — см. ниже.
              </Notice>
            )}

            <div className="space-y-2.5">
              {[...pathogens, ...spoilage].map((r) => (
                <div
                  key={r.threshold.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{r.threshold.organismRu}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="tabular text-xs">
                        min a_w {r.threshold.minimumAw.toFixed(2)}
                      </span>
                      <Badge tone={r.threshold.hazard === 'safety' ? 'danger' : 'warning'}>
                        {r.threshold.hazard === 'safety' ? 'Безопасность' : 'Порча'}
                      </Badge>
                      {r.withinSourceDisagreement ? (
                        <Badge tone="neutral">источники расходятся</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{r.threshold.note}</p>
                  {r.withinSourceDisagreement ? (
                    <p className="text-muted mt-1 text-xs">
                      Значение a_w попадает в зону расхождения источников (
                      {r.threshold.minimumAwRange[0]}–{r.threshold.minimumAwRange[1]}): часть
                      литературы допускает рост, часть — нет.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}

        {blocked.length > 0 ? (
          <details className="rounded-lg border border-[var(--border-subtle)]">
            <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-medium">
              Заблокированные организмы ({blocked.length})
            </summary>
            <ul className="space-y-1.5 border-t border-[var(--border-subtle)] px-3.5 py-3 text-sm">
              {blocked.map((r) => (
                <li key={r.threshold.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">{r.threshold.organismRu}</span>
                  <span className="tabular text-muted text-xs">
                    требует a_w ≥ {r.threshold.minimumAw.toFixed(2)}
                    {r.pHPermits === false ? ' · pH вне диапазона' : ''}
                    {r.temperaturePermits === false ? ' · T вне диапазона' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {measuredPH === null ? (
          <p className="text-muted text-xs">
            pH не измерен — учтён только барьер по активности воды. Измерение pH уточнит оценку
            для бактерий, но не для осмофильных дрожжей: на них pH в диапазоне 2.5–4.0
            практически не действует.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
