import React, { useCallback, useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { theme } from '@/styles/theme';
import { Toaster } from '@/components/ui/sonner';
import { makeMediaTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

type HandlerKey = 'play' | 'pause' | 'next' | 'previous' | 'library';

type ResumeToastHarnessHandle = {
  fireHydrate: (track: MediaTrack, skipped?: boolean) => void;
  fireHydrateFailed: () => void;
  invoke: (key: HandlerKey) => void;
};

const RESUME_TOAST_ID = 'resume-toast';

// Mirrors the AudioPlayer resume-toast wire-up using the same withResumeDismiss
// wrapping factory shape, so a drift in AudioPlayer's wiring surfaces here.
const ResumeToastHarness = React.forwardRef<ResumeToastHarnessHandle, { showQueue: boolean }>(
  ({ showQueue }, ref) => {
    const handleHydrateFired = useCallback((track: MediaTrack, skipped = false) => {
      const message = skipped
        ? `Couldn't resume previous track — starting from next in queue.`
        : `Resuming '${track.name}' — press play to continue.`;
      toast(message, { id: RESUME_TOAST_ID, duration: Infinity });
    }, []);

    const handleHydrateFailed = useCallback(() => {
      toast(`Couldn't resume your last session.`, { id: RESUME_TOAST_ID, duration: Infinity });
    }, []);

    const withResumeDismiss = useCallback(
      <T extends (...args: never[]) => unknown>(fn: T): T =>
        ((...args) => {
          toast.dismiss(RESUME_TOAST_ID);
          return fn(...args);
        }) as T,
      [],
    );

    const handlers = React.useMemo(
      () => ({
        play: withResumeDismiss(() => {}),
        pause: withResumeDismiss(() => {}),
        next: withResumeDismiss(() => {}),
        previous: withResumeDismiss(() => {}),
        library: withResumeDismiss(() => {}),
      }),
      [withResumeDismiss],
    );

    useEffect(() => {
      if (showQueue) toast.dismiss(RESUME_TOAST_ID);
    }, [showQueue]);

    React.useImperativeHandle(ref, () => ({
      fireHydrate: handleHydrateFired,
      fireHydrateFailed: handleHydrateFailed,
      invoke: (key) => handlers[key](),
    }));

    return null;
  }
);
ResumeToastHarness.displayName = 'ResumeToastHarness';

const renderHarness = (initialShowQueue = false) => {
  const ref = React.createRef<ResumeToastHarnessHandle>();
  const Wrapper = ({ showQueue }: { showQueue: boolean }) => (
    <ThemeProvider theme={theme}>
      <Toaster />
      <ResumeToastHarness ref={ref} showQueue={showQueue} />
    </ThemeProvider>
  );
  const utils = render(<Wrapper showQueue={initialShowQueue} />);
  return {
    ref,
    rerender: (showQueue: boolean) => utils.rerender(<Wrapper showQueue={showQueue} />),
  };
};

const fireHydrateWith = (
  ref: React.RefObject<ResumeToastHarnessHandle>,
  trackName: string,
) => {
  act(() => {
    ref.current?.fireHydrate(makeMediaTrack({ name: trackName }));
  });
};

describe('Resume toast behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
    vi.useRealTimers();
  });

  it('appears with the hydrated track name when hydrate fires', async () => {
    // #given
    const { ref } = renderHarness();

    // #when
    fireHydrateWith(ref, 'Bohemian Rhapsody');

    // #then
    await vi.waitFor(() => {
      expect(
        screen.getByText("Resuming 'Bohemian Rhapsody' — press play to continue."),
      ).toBeInTheDocument();
    });
  });

  it('persists past the legacy 5s window (Sonner duration: Infinity — only dismissed on user action)', async () => {
    // #given
    const { ref } = renderHarness();
    fireHydrateWith(ref, 'Caravan');
    await vi.waitFor(() => expect(screen.getByText(/Resuming 'Caravan'/)).toBeInTheDocument());

    // #when — advance well past the legacy auto-dismiss window
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // #then — Sonner uses duration: Infinity, so the toast remains
    expect(screen.getByText(/Resuming 'Caravan'/)).toBeInTheDocument();
  });

  it.each(['play', 'pause', 'next', 'previous', 'library'] as const)(
    'dismisses when the user invokes the %s handler',
    async (handler) => {
      // #given
      const { ref } = renderHarness();
      fireHydrateWith(ref, 'Take Five');
      await vi.waitFor(() => expect(screen.getByText(/Resuming 'Take Five'/)).toBeInTheDocument());

      // #when
      act(() => {
        ref.current?.invoke(handler);
      });

      // #then
      await vi.waitFor(
        () => expect(screen.queryByText(/Resuming 'Take Five'/)).not.toBeInTheDocument(),
        { timeout: 1000 },
      );
    },
  );

  it('dismisses immediately when the queue opens (showQueue flips true)', async () => {
    // #given
    const { ref, rerender } = renderHarness(false);
    fireHydrateWith(ref, 'Giant Steps');
    await vi.waitFor(() => expect(screen.getByText(/Resuming 'Giant Steps'/)).toBeInTheDocument());

    // #when
    act(() => {
      rerender(true);
    });

    // #then
    await vi.waitFor(
      () => expect(screen.queryByText(/Resuming 'Giant Steps'/)).not.toBeInTheDocument(),
      { timeout: 1000 },
    );
  });

  it('dismisses when the Sonner close button is clicked', async () => {
    // #given
    const { ref } = renderHarness();
    fireHydrateWith(ref, 'Four on Six');
    await vi.waitFor(() => expect(screen.getByText(/Resuming 'Four on Six'/)).toBeInTheDocument());

    // #when — Sonner exposes its close button via aria-label "Close toast"
    const dismissBtn = screen.getByLabelText(/close toast/i);
    act(() => {
      fireEvent.click(dismissBtn);
    });

    // #then
    await vi.waitFor(
      () => expect(screen.queryByText(/Resuming 'Four on Six'/)).not.toBeInTheDocument(),
      { timeout: 1000 },
    );
  });

  it('shows the partial-failure message when hydrate skipped to a later track', async () => {
    // #given
    const { ref } = renderHarness();

    // #when
    act(() => {
      ref.current?.fireHydrate(makeMediaTrack({ name: 'Skipped Track' }), true);
    });

    // #then
    await vi.waitFor(() => {
      expect(
        screen.getByText("Couldn't resume previous track — starting from next in queue."),
      ).toBeInTheDocument();
    });
    // The specific track name must not leak into the partial-failure copy.
    expect(screen.queryByText(/Skipped Track/)).not.toBeInTheDocument();
  });

  it('shows the full-failure message when hydrate could not prepare any track', async () => {
    // #given
    const { ref } = renderHarness();

    // #when
    act(() => {
      ref.current?.fireHydrateFailed();
    });

    // #then
    await vi.waitFor(() => {
      expect(
        screen.getByText("Couldn't resume your last session."),
      ).toBeInTheDocument();
    });
  });
});
