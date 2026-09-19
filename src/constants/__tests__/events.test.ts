import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AUTH_STATE_CHANGED_EVENT,
  SESSION_EXPIRED_EVENT,
  LOCAL_STORAGE_CHANGE_EVENT,
  dispatchAppEvent,
  onAppEvent,
} from '../events';

describe('AppEventMap helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatchAppEvent emits a CustomEvent with typed detail', () => {
    // #given
    const spy = vi.spyOn(window, 'dispatchEvent');

    // #when
    dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'spotify' });

    // #then
    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event).toMatchObject({
      type: SESSION_EXPIRED_EVENT,
      detail: { providerId: 'spotify' },
    });
  });

  it('dispatchAppEvent supports no-detail events', () => {
    // #given
    const spy = vi.spyOn(window, 'dispatchEvent');

    // #when
    dispatchAppEvent(AUTH_STATE_CHANGED_EVENT);

    // #then
    const event = spy.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe(AUTH_STATE_CHANGED_EVENT);
  });

  it('onAppEvent delivers detail and returns an unsubscribe', () => {
    // #given
    const seen: Array<{ key: string; newValue: string | null }> = [];
    const unsub = onAppEvent(LOCAL_STORAGE_CHANGE_EVENT, (detail) => {
      seen.push(detail);
    });

    // #when
    dispatchAppEvent(LOCAL_STORAGE_CHANGE_EVENT, { key: 'k', newValue: 'v' });
    unsub();
    dispatchAppEvent(LOCAL_STORAGE_CHANGE_EVENT, { key: 'k2', newValue: null });

    // #then
    expect(seen).toEqual([{ key: 'k', newValue: 'v' }]);
  });
});
