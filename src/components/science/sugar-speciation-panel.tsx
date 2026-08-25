'use client';

import * as React from 'react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Notice } from '@/components/ui';
import {
  SUGAR_PROFILES,
  SUGAR_SPECIES_LABELS,
  type AdaptedRecipe,
  type SugarProfile,
  type SugarProfileId,
  type SugarProfileResolutionMethod,
} from '@/lib/science';

/**
 * Per-ingredient sugar speciation (spec §11, §36).
 *
 * Makes visible the step that turns "35 g of sugar" into physics. Each line
 * shows which species the ingredient's sugar was resolved to and HOW that was
 * decided, because a category default deserves less trust than an explicit
 * declaration and the user should be able to see which they have.
 */

const METHOD_LABEL: Record<SugarProfileResolutionMethod, string> = {
  explicit_override: 'Задано пользователем',
  name_pattern: 'По названию ингредиента',
  category_default: 'По категории',
  unresolved: 'Не определено',
};

/**
 * Tone follows the per-line CONFIDENCE, not the method.
 *
 * "Chocolate's sugar is sucrose" and "a purée is 35/40/25 glucose/fructose/
 * sucrose" are both category defaults, but only the second is a real guess.
 * Colouring by method alone contradicted the confidence figure shown next to it.
 */
function confidenceTone(
  method: SugarProfileResolutionMethod,
  confidence: number,
): 'success' | 'accent' | 'warning' | 'danger' {
  if (method === 'unresolved') return 'danger';
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'accent';
  return 'warning';
}

function describeProfile(profileId: SugarProfileId | null): string {
  if (!profileId) return '—';
  // Read through the interface: `satisfies` keeps the literal types narrow,
  // so the optional dextroseEquivalent is not visible on every union member.
  const profile: SugarProfile = SUGAR_PROFILES[profileId];
  const parts = Object.entries(profile.fractions)
    .filter(([, f]) => typeof f === 'number' && f > 0)
    .map(([species, f]) => {
      const label = SUGAR_SPECIES_LABELS[species as keyof typeof SUGAR_SPECIES_LABELS];
      return (f as number) === 1 ? label : `${label} ${Math.round((f as number) * 100)} %`;
    });
  const de = profile.dextroseEquivalent ? ` (DE ${profile.dextroseEquivalent})` : '';
  return parts.join(' + ') + de;
}

export function SugarSpeciationPanel({ science }: { science: AdaptedRecipe }) {
  const withSugar = science.lines.filter((l) => l.sugarGrams > 0);

  if (withSugar.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Состав сахаров по видам</CardTitle>
        <CardDescription>
          Активность воды определяется числом растворённых частиц, а не массой сахара. 1 г
          инвертного сахара даёт в 1.9 раза больше частиц, чем 1 г сахарозы, потому что его
          молярная масса вдвое меньше. Поэтому суммарные «сахара, %» раскладываются по видам.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-xs">
                <th className="py-1.5 font-medium">Ингредиент</th>
                <th className="py-1.5 text-right font-medium">Сахара, г</th>
                <th className="py-1.5 pl-4 font-medium">Разложение</th>
                <th className="py-1.5 pl-4 font-medium">Как определено</th>
              </tr>
            </thead>
            <tbody>
              {withSugar.map((line) => (
                <tr key={line.ingredientId} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 font-medium">{line.ingredientName}</td>
                  <td className="tabular py-2 text-right">{line.sugarGrams.toFixed(1)}</td>
                  <td className="py-2 pl-4 text-[var(--text-secondary)]">
                    {describeProfile(line.profileId)}
                  </td>
                  <td className="py-2 pl-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={confidenceTone(line.method, line.confidence)}>
                        {METHOD_LABEL[line.method]}
                      </Badge>
                      <span className="tabular text-muted text-xs">
                        достоверность {(line.confidence * 100).toFixed(0)} %
                      </span>
                    </div>
                    <p className="text-muted mt-1 max-w-md text-xs">{line.rationale}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {science.unresolvedIngredients.length > 0 ? (
          <Notice tone="warning" title="Вид сахаров не определён">
            {science.unresolvedIngredients.join(', ')}. Эти сахара учтены в массовом балансе, но
            исключены из расчёта активности воды — подставить произвольный вид означало бы
            выдать догадку за данные. Уверенность оценки a_w понижена.
          </Notice>
        ) : null}
      </CardContent>
    </Card>
  );
}
