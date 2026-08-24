import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Notice } from '@/components/ui';
import { WATER_ACTIVITY_ZONES } from '@/lib/water-activity/zones';
import { ALL_AW_MODELS } from '@/lib/water-activity/models';
import { SHELF_LIFE_REFERENCE_POINTS, REFERENCE_ENVELOPE } from '@/lib/shelf-life';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { SettingsForm } from '@/components/settings-form';

export const metadata: Metadata = {
  title: 'Настройки',
  description: 'Параметры приложения, модели активности воды и источники данных.',
};

export const dynamic = 'force-dynamic';

async function loadState() {
  if (!isDatabaseConfigured()) return { settings: null, counts: null, error: 'DATABASE_URL не задан.' };
  try {
    const [settings, ingredientCount, recipeCount, incompleteCount, overCount] = await Promise.all([
      prisma.appSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } }),
      prisma.ingredient.count(),
      prisma.recipe.count(),
      prisma.ingredient.count({ where: { componentSum: { lt: 99.5 } } }),
      prisma.ingredient.count({ where: { componentSum: { gt: 100.5 } } }),
    ]);
    return {
      settings,
      counts: { ingredientCount, recipeCount, incompleteCount, overCount },
      error: null,
    };
  } catch (error) {
    return {
      settings: null,
      counts: null,
      error: error instanceof Error ? error.message : 'База недоступна',
    };
  }
}

export default async function SettingsPage() {
  const { settings, counts, error } = await loadState();

  return (
    <PageShell
      title="Настройки"
      subtitle="Параметры приложения, состояние моделей активности воды и происхождение данных."
    >
      <div className="space-y-6">
        {error ? <Notice tone="danger" title="База данных">{error}</Notice> : null}

        {settings ? (
          <Card>
            <CardHeader>
              <CardTitle>Параметры</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsForm
                initial={{
                  currency: settings.currency,
                  defaultPieceWeightG: settings.defaultPieceWeightG,
                  awModelId: settings.awModelId as 'measured' | 'reference' | 'scientific',
                  enableExternalLookup: settings.enableExternalLookup,
                }}
              />
            </CardContent>
          </Card>
        ) : null}

        {counts ? (
          <Card>
            <CardHeader>
              <CardTitle>Данные</CardTitle>
              <CardDescription>Импортировано из листа Database исходной книги Excel.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-muted text-xs tracking-wide uppercase">Ингредиентов</dt>
                  <dd className="tabular font-display text-2xl font-semibold">
                    {counts.ingredientCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs tracking-wide uppercase">Рецептов</dt>
                  <dd className="tabular font-display text-2xl font-semibold">
                    {counts.recipeCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs tracking-wide uppercase">Состав &lt; 100 %</dt>
                  <dd className="tabular font-display text-2xl font-semibold text-[var(--warning)]">
                    {counts.incompleteCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs tracking-wide uppercase">Состав &gt; 100 %</dt>
                  <dd className="tabular font-display text-2xl font-semibold text-[var(--danger)]">
                    {counts.overCount}
                  </dd>
                </div>
              </dl>
              <p className="text-muted mt-4 text-xs">
                Значения импортированы без нормализации. Строки, сумма компонентов которых меньше
                100 %, дают долю «не учтено»; строки со суммой больше 100 % противоречивы в
                источнике и помечены в базе ингредиентов.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Модели активности воды (a_w)</CardTitle>
            <CardDescription>
              Приложение не выводит a_w из процента воды. Модель возвращает значение только при
              наличии данных.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ALL_AW_MODELS.map((model, index) => (
              <div key={model.id} className="border-b border-[var(--border-subtle)] pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">приоритет {index + 1}</Badge>
                  <span className="font-medium">{model.label}</span>
                  <Badge tone={model.id === 'measured' ? 'success' : 'warning'}>
                    {model.id === 'measured' ? 'работает' : 'нет данных'}
                  </Badge>
                </div>
                <p className="text-secondary mt-1.5 text-sm">{model.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Эмпирические контрольные точки срока годности</CardTitle>
            <CardDescription>
              Область применимости: вода {REFERENCE_ENVELOPE.waterMin}–{REFERENCE_ENVELOPE.waterMax} %,
              сахара {REFERENCE_ENVELOPE.sugarMin}–{REFERENCE_ENVELOPE.sugarMax} %. За её пределами
              оценка не выдаётся.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-[11px] tracking-wider uppercase">
                    <th scope="col" className="px-2 py-2 font-medium">Вода</th>
                    <th scope="col" className="px-2 py-2 font-medium">Сахара</th>
                    <th scope="col" className="px-2 py-2 font-medium">Срок, дней</th>
                    <th scope="col" className="px-2 py-2 font-medium">Источник</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {SHELF_LIFE_REFERENCE_POINTS.map((point) => (
                    <tr key={point.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-2 py-2">{point.waterPercentage} %</td>
                      <td className="px-2 py-2">
                        {point.sugarPercentageMin === point.sugarPercentageMax
                          ? `${point.sugarPercentageMin} %`
                          : `${point.sugarPercentageMin}–${point.sugarPercentageMax} %`}
                      </td>
                      <td className="px-2 py-2">
                        {point.shelfLifeDaysMin === point.shelfLifeDaysMax
                          ? point.shelfLifeDaysMin
                          : `${point.shelfLifeDaysMin}–${point.shelfLifeDaysMax}`}
                      </td>
                      <td className="text-muted px-2 py-2 text-xs">{point.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Микробиологические зоны a_w</CardTitle>
            <CardDescription>
              Транскрипция исходного графика. Пересечение зон 0.80–0.87 и &gt; 0.86 воспроизведено
              намеренно.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-muted border-b border-[var(--border-subtle)] text-left text-[11px] tracking-wider uppercase">
                    <th scope="col" className="px-2 py-2 font-medium">Диапазон</th>
                    <th scope="col" className="px-2 py-2 font-medium">Идентификатор</th>
                    <th scope="col" className="px-2 py-2 font-medium">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {WATER_ACTIVITY_ZONES.map((zone) => (
                    <tr key={zone.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="tabular px-2 py-2 whitespace-nowrap">{zone.sourceRange}</td>
                      <td className="px-2 py-2">
                        <code className="text-muted text-[11px]">{zone.id}</code>
                      </td>
                      <td className="px-2 py-2 text-xs">{zone.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted mt-3 text-xs">
              Разрыв 0.90 &lt; a_w &lt; 0.91 присутствует в исходных данных и сохранён без
              интерполяции.
            </p>
          </CardContent>
        </Card>

        <Notice tone="neutral" title="Документация">
          Полное описание математической модели, формул, допущений и ограничений —
          в файле <code>docs/calculation-model.md</code> репозитория.
        </Notice>
      </div>
    </PageShell>
  );
}
