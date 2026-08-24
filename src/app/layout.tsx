import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/layout/nav';
import { AppProviders } from '@/components/app-providers';
import { loadIngredientsSafely } from '@/lib/ingredients/load';

export const metadata: Metadata = {
  title: {
    default: 'Ganache Calculator',
    template: '%s · Ganache Calculator',
  },
  description:
    'Расчёт рецептур ганаша, шоколадных конфет и кондитерских начинок: состав, вода, сахара, сухая масса, активность воды и теоретическая оценка срока годности.',
};

/**
 * The layout reads the ingredient catalogue from PostgreSQL, so every page
 * under it must render per-request. Without this the catalogue would be frozen
 * at build time and a newly added ingredient would not appear until the next
 * deploy — and a build running without database access would bake in the
 * "база недоступна" state permanently.
 */
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf4ea' },
    { media: '(prefers-color-scheme: dark)', color: '#161009' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ingredients are loaded once on the server and handed to the client store,
  // so ingredient search is instant and needs no per-keystroke request (§45).
  const { ingredients, error } = await loadIngredientsSafely();

  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--surface-card)] focus:px-3 focus:py-2 focus:text-sm"
        >
          Перейти к содержимому
        </a>
        <AppProviders ingredients={ingredients} ingredientsError={error}>
          <Nav />
          <div id="content">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
