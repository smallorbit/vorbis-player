import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { ColorProvider } from '@/contexts/ColorContext';
import { STORAGE_KEYS } from '@/constants/storage';
import type { MediaTrack } from '@/types/domain';

/**
 * Issue #1467 integration test — locks in the fix for the Settings v2
 * eyedropper failing to capture pixel clicks.
 *
 * Unlike `AccentColorManager.test.tsx`, this test uses the **real**
 * `EyedropperOverlay` (not a mock) wrapped in the **real** `SettingsV2`
 * Radix Dialog. The combination is what surfaces the bug: the eyedropper
 * portals itself to `document.body`, which puts it outside the Dialog's
 * content tree, so Radix's `DismissableLayer` would otherwise treat the
 * canvas pointerdown as an outside-click and dismiss the Dialog before
 * the canvas `click` handler fires.
 *
 * The fix in `SettingsV2.tsx` (`onPointerDownOutside` +
 * `onInteractOutside` handlers that `preventDefault()` when the event
 * target is inside `[data-eyedropper-overlay]`) is what this test
 * exercises end-to-end.
 *
 * `SettingsV2Content` is mocked so this test can render `<AccentColorManager />`
 * directly inside the real Dialog without pulling in the full section
 * registry (Translucence/Visualizer contexts, lazy-loaded providers, etc.).
 */

const mockCurrentTrack: MediaTrack = {
  id: 't1',
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: 'spotify:track:t1' },
  name: 'Test Track',
  artists: 'Test Artist',
  album: 'Test Album',
  albumId: 'album-123',
  durationMs: 1000,
  image: 'https://example.com/image.jpg',
};

vi.mock('@/hooks/useUiV2', () => ({ useUiV2: () => true }));
vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: () => ({ isMobile: false }),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: vi.fn(() => ({
    currentTrack: mockCurrentTrack,
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn(),
  })),
}));

vi.mock('@/utils/colorExtractor', () => ({
  extractTopVibrantColors: vi.fn(async () => [
    { hex: '#ff0000', score: 1 },
    { hex: '#00ff00', score: 0.9 },
  ]),
}));

vi.mock('@/providers/dropbox/dropboxPreferencesSync', () => ({
  getPreferencesSync: vi.fn(() => null),
}));

vi.mock('../../SettingsV2Sidebar', () => ({
  SettingsV2Sidebar: () => null,
}));

vi.mock('../../SettingsV2MobileTakeover', () => ({
  SettingsV2MobileTakeover: () => null,
}));

vi.mock('../../SettingsV2Content', async () => {
  const { AccentColorManager } = await import('../appearance/AccentColorManager');
  return {
    SettingsV2Content: () => <AccentColorManager />,
  };
});

import { SettingsV2 } from '../../SettingsV2';

/**
 * jsdom does not implement PointerEvent. Radix's `DismissableLayer` listens
 * for `pointerdown`, so we dispatch a regular `MouseEvent` with that type
 * (the listener only reads `event.target` + `event.preventDefault`, both of
 * which `MouseEvent` provides).
 */
function dispatchPointerDown(target: Element): boolean {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
  return target.dispatchEvent(event);
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <ColorProvider>{children}</ColorProvider>
  </ThemeProvider>
);

describe('SettingsV2 + real EyedropperOverlay (issue #1467)', () => {
  beforeAll(() => {
    /**
     * jsdom does not implement HTMLCanvasElement.getContext. Stub it with a
     * minimal 2D context — drawImage is a no-op and getImageData returns a
     * deterministic pixel so the eyedropper produces #abcdef when picked.
     */
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () =>
        ({
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray([0xab, 0xcd, 0xef, 0xff]),
          })),
        }) as unknown as CanvasRenderingContext2D,
    ) as typeof HTMLCanvasElement.prototype.getContext;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it('keeps the SettingsV2 Dialog open when pointerdown fires inside the eyedropper portal', async () => {
    // #given — real SettingsV2 Dialog open with AccentColorManager mounted
    const onClose = vi.fn();
    render(
      <Wrapper>
        <SettingsV2 isOpen={true} onClose={onClose} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByTestId('settings-v2-desktop'));
    fireEvent.click(screen.getByLabelText('Pick color from album art'));
    const overlay = await waitFor(() =>
      document.body.querySelector('[data-eyedropper-overlay="true"]'),
    );
    expect(overlay).not.toBeNull();

    // Radix's `usePointerDownOutside` registers its document listener inside
    // a setTimeout(0) — yield once so the listener is live before we dispatch.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    // #when — pointerdown on the eyedropper portal (outside the Dialog tree)
    act(() => {
      dispatchPointerDown(overlay!);
    });

    // #then — Dialog stays open. Without the fix, Radix DismissableLayer
    // would treat this as an outside-click and call onClose().
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-v2-desktop')).toBeInTheDocument();
  });

  it('captures the picked color and dual-writes ACCENT_COLOR_OVERRIDES + CUSTOM_ACCENT_COLORS', async () => {
    // #given — real SettingsV2 Dialog open with AccentColorManager mounted
    const onClose = vi.fn();
    render(
      <Wrapper>
        <SettingsV2 isOpen={true} onClose={onClose} />
      </Wrapper>,
    );
    await waitFor(() => screen.getByTestId('settings-v2-desktop'));
    fireEvent.click(screen.getByLabelText('Pick color from album art'));
    const canvas = (await waitFor(() =>
      document.body.querySelector('[data-eyedropper-overlay="true"] canvas'),
    )) as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    // #when — pointerdown (Radix dismiss-event) followed by click (canvas pick)
    act(() => {
      dispatchPointerDown(canvas);
    });
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });

    // #then — Dialog still open, dual-key write hit localStorage with the
    // canonical `vorbis-player-` prefixed keys.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-v2-desktop')).toBeInTheDocument();

    const setItemCalls = (window.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls;
    const overrideWrite = setItemCalls.find(([key]) => key === STORAGE_KEYS.ACCENT_COLOR_OVERRIDES);
    const customWrite = setItemCalls.find(([key]) => key === STORAGE_KEYS.CUSTOM_ACCENT_COLORS);
    expect(overrideWrite).toBeTruthy();
    expect(customWrite).toBeTruthy();
    expect(JSON.parse(overrideWrite![1] as string)).toEqual({ 'album-123': '#abcdef' });
    expect(JSON.parse(customWrite![1] as string)).toEqual({ 'album-123': '#abcdef' });
  });
});
