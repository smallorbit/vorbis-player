/**
 * Narrow `T | undefined` in tests after presence is known (e.g. after
 * `toHaveLength` / `toBeDefined`). Throws if the value is missing so
 * `noUncheckedIndexedAccess` does not force non-null assertions.
 */
export function defined<T>(value: T | undefined, message?: string): T {
  if (value === undefined) {
    throw new Error(message ?? 'expected value to be defined');
  }
  return value;
}
