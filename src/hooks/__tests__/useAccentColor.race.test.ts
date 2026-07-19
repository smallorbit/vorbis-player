import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createDeferredFn } from '@/test/asyncRace';
import type { MediaTrack } from '@/types/domain';

type Extracted = { hex: string; rgb: string; hsl: string } | null;

const extract = createDeferredFn<[string], Extracted>();

vi.mock('@/utils/colorExtractor', () => ({
  extractDominantColor: (...args: [string]) => extract.fn(...args),
}));

vi.mock('@/contexts/ProfilingContext', () => ({
  isProfilingEnabled: () => false,
}));

import { useAccentColor } from '../useAccentColor';
import { makeTrack } from '@/test/fixtures';

function color(hex: string): Extracted {
  return { hex, rgb: hex, hsl: hex };
}

describe('useAccentColor — auto re-extract stale-write race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a late auto re-extraction for the previous track does not clobber the current track color', async () => {
    // #given track A rendered (its effect kicks off an extraction we never
    // settle — the isCurrent guard already covers the effect path)
    const setAccentColor = vi.fn();
    const setAccentColorOverrides = vi.fn();
    const trackA: MediaTrack = makeTrack({ albumId: 'album-A', image: 'imgA' });
    const trackB: MediaTrack = makeTrack({ albumId: 'album-B', image: 'imgB' });

    const { result, rerender } = renderHook(
      ({ track }: { track: MediaTrack }) =>
        useAccentColor(track, {}, setAccentColor, setAccentColorOverrides),
      { initialProps: { track: trackA } },
    );

    await waitFor(() => expect(extract.callCount).toBe(1)); // effect(A) → call 0 (imgA)

    // #when the user picks "auto" while track A is showing — an unguarded
    // async re-extraction of A's art starts...
    act(() => {
      result.current.resetToAutoColor();
    });
    await waitFor(() => expect(extract.callCount).toBe(2)); // auto(A) → call 1 (imgA)

    // ...then the track advances to B, whose effect extracts B's art...
    rerender({ track: trackB });
    await waitFor(() => expect(extract.callCount).toBe(3)); // effect(B) → call 2 (imgB)

    // ...and B (the newest) resolves BEFORE the stale auto(A) resolves.
    await act(async () => {
      extract.resolve(2, color('#B0B0B0'));
      extract.resolve(1, color('#A0A0A0')); // stale auto for the old track A
      extract.resolve(0, color('#A0A0A0')); // stale effect for the old track A
      await Promise.resolve();
    });

    // #then the last committed accent color must be B's, not the stale A that
    // resolved last. Without a generation guard the late auto(A) clobbers B.
    const committed = setAccentColor.mock.calls.map((c: [string]) => c[0]);
    expect(committed.at(-1)).toBe('#B0B0B0');
    expect(committed).not.toContain('#A0A0A0');
  });
});
