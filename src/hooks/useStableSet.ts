import { useRef } from 'react';

/**
 * Returns the previously-returned array reference when the *set* of values
 * is unchanged, even if the caller passes a fresh array on each render.
 *
 * Useful as a dep stabilizer: passing the result into a downstream effect's
 * dependency array prevents the effect from re-firing when the parent
 * re-renders with a new array literal whose contents are equivalent.
 *
 * The in-render ref mutation is idempotent — given the same logical input,
 * the function always returns the same reference and never triggers a render.
 * This makes it StrictMode-safe (double-invocation produces identical output).
 */
export function useStableSet<T extends string>(values: readonly T[]): readonly T[] {
  const ref = useRef<readonly T[]>(values);
  const prev = ref.current;
  if (prev.length === values.length) {
    const prevSet = new Set(prev);
    if (values.every((v) => prevSet.has(v))) {
      return prev;
    }
  }
  ref.current = values;
  return values;
}
