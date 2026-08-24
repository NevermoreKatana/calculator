/**
 * Numeric guards and display rounding.
 *
 * Rule (spec §39): intermediate values are never rounded. Rounding happens
 * only at the presentation boundary, through the helpers in this file.
 *
 * Rule (spec §44): no NaN / Infinity / undefined ever reaches the UI. Every
 * division in the engine goes through `safeDivide`, which returns `null`
 * instead of a non-finite number so callers must handle the "no value" case.
 */

/** Returns `null` instead of Infinity/NaN when the denominator is 0 or invalid. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Percentage of `whole` represented by `part`, or `null` when undefined. */
export function safePercentage(part: number, whole: number): number | null {
  const ratio = safeDivide(part, whole);
  return ratio === null ? null : ratio * 100;
}

/** Coerces anything non-finite to 0. Used when reading external/stored data. */
export function finiteOrZero(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Rounds for display only. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  // + Number.EPSILON keeps 1.005 -> 1.01 rather than 1.00
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Formats a gram amount for display, e.g. "350.0 г". */
export function formatGrams(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${round(value, decimals).toFixed(decimals)} г`;
}

/** Formats a percentage for display, e.g. "17.5 %". */
export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${round(value, decimals).toFixed(decimals)} %`;
}

/** Formats the sugar/water ratio as "2.00 : 1" (spec §17). */
export function formatRatio(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${round(value, decimals).toFixed(decimals)} : 1`;
}

/** Formats a day count or day range, e.g. "90" or "58–63". */
export function formatDays(min: number, max: number): string {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** Clamps into [min, max]; returns min when the value is not finite. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
