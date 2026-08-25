'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/calculator', label: 'Калькулятор' },
  { href: '/composition', label: 'Состав' },
  { href: '/ingredients', label: 'Ингредиенты' },
  { href: '/recipes', label: 'Рецепты' },
  { href: '/stability', label: 'Стабильность' },
  { href: '/shelf-life', label: 'Срок годности' },
  { href: '/science', label: 'Наука' },
  { href: '/settings', label: 'Настройки' },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href || (href === '/calculator' && pathname === '/');

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/calculator" className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden className="text-xl">🍫</span>
          <span className="font-display text-base font-semibold tracking-tight sm:text-lg">
            Ganache Calculator
          </span>
        </Link>

        <nav aria-label="Основная навигация" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(link.href)
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="ml-auto rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm lg:hidden"
        >
          {open ? 'Закрыть' : 'Меню'}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Мобильная навигация"
          className="border-t border-[var(--border-subtle)] lg:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive(link.href)
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)]',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
