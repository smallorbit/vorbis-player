import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useQueueAddedToast } from '../useQueueAddedToast';

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

describe('useQueueAddedToast', () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
  });

  it('shows a toast with View action wired to openQueue', () => {
    const openQueue = vi.fn();
    const { result } = renderHook(() => useQueueAddedToast(openQueue));

    act(() => {
      result.current.notifyAdded('Added 2 tracks from "Mix" to play next.', 'lib-play-next');
    });

    expect(toast).toHaveBeenCalledWith('Added 2 tracks from "Mix" to play next.', {
      id: 'lib-play-next',
      action: { label: 'View', onClick: openQueue },
    });

    act(() => {
      openQueue();
    });
    expect(openQueue).toHaveBeenCalledOnce();
  });

  it('pluralizes track count', () => {
    const { result } = renderHook(() => useQueueAddedToast(vi.fn()));
    expect(result.current.trackWord(1)).toBe('track');
    expect(result.current.trackWord(2)).toBe('tracks');
  });
});
