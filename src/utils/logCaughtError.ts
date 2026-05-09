export function logCaughtError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[${context}]`, err);
  }
}
