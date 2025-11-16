import { useEffect, useRef } from 'react';

/**
 * useAnimationFrame Hook
 * 
 * Custom hook for running animations using requestAnimationFrame.
 * Provides a clean way to manage animation loops with proper cleanup.
 * 
 * @hook
 * 
 * @param callback - Function to call on each animation frame. Receives current timestamp.
 * 
 * @example
 * ```typescript
 * useAnimationFrame((time) => {
 *   // Update animation state
 *   updateParticles(time);
 * });
 * ```
 * 
 * @returns void
 */
export function useAnimationFrame(callback: (time: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        callback(time);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback]);
}

