'use client';

import * as React from 'react';

/**
 * Debounces a rapidly changing value (spec §45: no API request per keystroke).
 * Only network-backed searches need this; the local catalogue is filtered
 * synchronously in memory.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
