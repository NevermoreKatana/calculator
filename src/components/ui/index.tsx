import * as React from 'react';
import { cn } from '@/lib/utils';

/* Small, dependency-light primitives in the shadcn/ui spirit: plain components
   owned by this repo, styled from the design tokens in globals.css. */

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('surface-card rounded-xl', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('font-display text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-secondary mt-1 text-sm', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-transparent shadow-sm',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
  danger:
    'bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger-soft)]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  ...props
}: React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border px-3 text-sm transition-colors',
        'bg-[var(--surface-card)] border-[var(--border-strong)] text-[var(--text-primary)]',
        'placeholder:text-[var(--text-muted)]',
        'focus:border-[var(--accent)] focus:outline-none',
        'disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border px-3 text-sm transition-colors',
        'bg-[var(--surface-card)] border-[var(--border-strong)] text-[var(--text-primary)]',
        'focus:border-[var(--accent)] focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'text-secondary mb-1.5 block text-xs font-medium tracking-wide uppercase',
        className,
      )}
      {...props}
    />
  );
}

type BadgeTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
};

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Callout used for disclaimers and data-quality notices. */
export function Notice({
  tone = 'neutral',
  title,
  children,
  className,
}: {
  tone?: BadgeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const border: Record<BadgeTone, string> = {
    neutral: 'border-[var(--border-strong)]',
    accent: 'border-[var(--accent)]',
    danger: 'border-[var(--danger)]',
    warning: 'border-[var(--warning)]',
    success: 'border-[var(--success)]',
  };
  return (
    <div
      className={cn(
        'rounded-lg border-l-2 py-3 pr-4 pl-4 text-sm',
        BADGE_TONES[tone],
        border[tone],
        className,
      )}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

/** A labelled numeric readout. `value` is pre-formatted by the caller. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const valueTone: Record<BadgeTone, string> = {
    neutral: 'text-[var(--text-primary)]',
    accent: 'text-[var(--accent)]',
    danger: 'text-[var(--danger)]',
    warning: 'text-[var(--warning)]',
    success: 'text-[var(--success)]',
  };
  return (
    <div className={cn('surface-card rounded-xl px-4 py-3.5', className)}>
      <p className="text-muted text-[11px] font-medium tracking-wider uppercase">{label}</p>
      <p className={cn('tabular font-display mt-1 text-2xl font-semibold', valueTone[tone])}>
        {value}
      </p>
      {hint ? <p className="text-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color,
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : 0;
  const pct = max > 0 ? (safe / max) * 100 : 0;
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, backgroundColor: color ?? 'var(--accent)' }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="text-muted mb-3">{icon}</div> : null}
      <p className="font-display text-lg font-medium">{title}</p>
      {description ? (
        <p className="text-secondary mt-1.5 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
