import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRovingMenuKeyDown } from '@/hooks/useRovingMenuKeyDown';

describe('useRovingMenuKeyDown', () => {
  it('returns a stable keydown handler', () => {
    const { result, rerender } = renderHook(() => useRovingMenuKeyDown());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
