export function logCaughtError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[${context}]`, err);
  }
}
