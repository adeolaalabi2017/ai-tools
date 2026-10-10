"use client";

import { useEffect, useState } from "react";

/**
 * Debounced mirror of a value. The first value is applied immediately (so
 * seeded queries / initial filters fire on mount); subsequent changes are
 * delayed by `delay` ms.
 */
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
