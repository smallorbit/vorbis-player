import { describe, it, expect, afterEach, vi } from 'vitest';
import { connectivityStore } from '../connectivityStore';

function goOffline(): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
}

function goOnline(): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
}

describe('connectivityStore', () => {
  afterEach(() => {
    goOnline();
    vi.restoreAllMocks();
  });

  it('starts online when the browser reports online', () => {
    expect(connectivityStore.isOnline()).toBe(true);
  });

  it('notifies subscribers on each transition with the new state', () => {
    // #given
    const listener = vi.fn();
    const unsubscribe = connectivityStore.subscribe(listener);

    // #when
    goOffline();
    goOnline();

    // #then
    expect(listener.mock.calls).toEqual([[false], [true]]);
    unsubscribe();
  });

  it('ignores events that do not change the state', () => {
    // #given
    const listener = vi.fn();
    const unsubscribe = connectivityStore.subscribe(listener);

    // #when
    goOnline();

    // #then
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    // #given
    const listener = vi.fn();
    connectivityStore.subscribe(listener)();

    // #when
    goOffline();

    // #then
    expect(listener).not.toHaveBeenCalled();
    expect(connectivityStore.isOnline()).toBe(false);
  });
});
