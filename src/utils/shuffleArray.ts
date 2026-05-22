/** Fisher-Yates shuffle. Returns a new shuffled copy of the array. */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i] as T;
    const b = shuffled[j] as T;
    shuffled[i] = b;
    shuffled[j] = a;
  }
  return shuffled;
}
