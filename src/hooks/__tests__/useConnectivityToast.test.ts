import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useConnectivityToast } from '../useConnectivityToast';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

describe('useConnectivityToast', () => {
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it('shows nothing while online', () => {
    // #when
    renderHook(() => useConnectivityToast());

    // #then
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows a persistent offline toast when the connection drops', () => {
    // #given
    renderHook(() => useConnectivityToast());

    // #when
    setOnline(false);

    // #then
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("You're offline"), {
      id: 'connectivity',
      duration: Infinity,
    });
  });

  it('replaces the offline toast with a brief confirmation on reconnect', () => {
    // #given
    renderHook(() => useConnectivityToast());
    setOnline(false);

    // #when
    setOnline(true);

    // #then
    expect(toast.success).toHaveBeenCalledWith('Back online', { id: 'connectivity', duration: 3000 });
  });

  it('stops listening after unmount', () => {
    // #given
    const { unmount } = renderHook(() => useConnectivityToast());
    unmount();

    // #when
    setOnline(false);

    // #then
    expect(toast).not.toHaveBeenCalled();
  });
});
