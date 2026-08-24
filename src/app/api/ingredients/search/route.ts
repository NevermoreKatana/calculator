import { NextResponse } from 'next/server';
import { IngredientSearchSchema } from '@/lib/validation/schemas';
import { LocalIngredientProvider, OpenFoodFactsProvider } from '@/lib/ingredients';

/**
 * Ingredient search across providers.
 *
 * The local database is authoritative and always answers. The external
 * provider is best-effort: when it fails the response still succeeds, with the
 * failure reported in `providerErrors`, so the UI degrades instead of breaking
 * (spec §46).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = IngredientSearchSchema.safeParse({
    query: url.searchParams.get('q') ?? '',
    category: url.searchParams.get('category') || null,
    source: url.searchParams.get('source') ?? 'local',
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные параметры запроса', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { query, category, source, limit } = parsed.data;
  const providerErrors: { providerId: string; error: string }[] = [];

  const providers =
    source === 'local'
      ? [LocalIngredientProvider]
      : source === 'external'
        ? [OpenFoodFactsProvider]
        : [LocalIngredientProvider, OpenFoodFactsProvider];

  const results = await Promise.all(
    providers.map((provider) =>
      provider.search(query, { category, limit }).catch(() => ({
        ingredients: [],
        ok: false as const,
        providerId: provider.id,
        error: 'Провайдер недоступен',
      })),
    ),
  );

  const ingredients = results.flatMap((result) => {
    if (!result.ok) {
      providerErrors.push({
        providerId: result.providerId,
        error: result.error ?? 'Источник недоступен',
      });
      return [];
    }
    return result.ingredients;
  });

  return NextResponse.json(
    { ingredients, providerErrors },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
