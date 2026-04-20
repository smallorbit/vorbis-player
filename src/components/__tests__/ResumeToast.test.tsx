import React, { useCallback, useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';
import Toast from '../Toast';
import { makeMediaTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

type HandlerKey = 'play' | 'pause' | 'next' | 'previous' | 'library';

type ResumeToastHarnessHandle = {
  fireHydrate: (track: MediaTrack, skipped?: boolean) => void;
  fireHydrateFailed: () => void;
  invoke: (key: HandlerKey) => void;
};

// Mirrors the AudioPlayer resume-toast wire-up using the same withResumeDismiss
// wrapping factory shape, so a drift in AudioPlayer's wiring surfaces here.
const ResumeToastHarness = React.forwardRef<ResumeToastHarnessHandle, { showQueue: boolean }>(
  ({ showQueue }, ref) => {
    const [message, setMessage] = useState<string | null>(null);
    const dismiss = useCallback(() => setMessage(null), []);

    const handleHydrateFired = useCallback((track: MediaTrack, skipped = false) => {
      setMessage(
        skipped
          ? `Couldn't resume previous track — starting from next in queue.`
          : `Resuming '${track.name}' — press play to continue.`,
      );
    }, []);

    const handleHydrateFailed = useCallback(() => {
      setMessage(`Couldn't resume your last session.`);
    }, []);

    const withResumeDismiss = useCallback(
      <T extends (...args: never[]) => unknown>(fn: T): T =>
        ((...args) => {
          setMessage(null);
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
      if (showQueue) setMessage(null);
    }, [showQueue]);

    React.useImperativeHandle(ref, () => ({
      fireHydrate: handleHydrateFired,
      fireHydrateFailed: handleHydrateFailed,
      invoke: (key) => handlers[key](),
    }));

    return message ? <Toast message={message} onDismiss={dismiss} /> : null;
  }
);
ResumeToastHarness.displayName = 'ResumeToastHarness';

const renderHarness = (initialShowQueue = false) => {
  const ref = React.createRef<ResumeToastHarnessHandle>();
  const Wrapper = ({ showQueue }: { showQueue: boolean }) => (
    <ThemeProvider theme={theme}>
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
    vi.useRealTimers();
  });

  it('appears with the hydrated track name when hydrate fires', () => {
    // #given
    const { ref } = renderHarness();

    // #when
    fireHydrateWith(ref, 'Bohemian Rhapsody');

    // #then
    expect(
      screen.getByText("Resuming 'Bohemian Rhapsody' — press play to continue."),
    ).toBeInTheDocument();
  });

  it('auto-dismisses after ~5s', () => {
    // #given
    const { ref } = renderHarness();
    fireHydrateWith(ref, 'Caravan');
    expect(screen.getByText(/Resuming 'Caravan'/)).toBeInTheDocument();

    // #when — advance past the Toast's 5000ms auto-dismiss + exit animation
    act(() => {
      vi.advanceTimersByTime(5400);
    });

    // #then
    expect(screen.queryByText(/Resuming 'Caravan'/)).not.toBeInTheDocument();
  });

  it.each(['play', 'pause', 'next', 'previous', 'library'] as const)(
    'dismisses when the user invokes the %s handler',
    (handler) => {
      // #given
      const { ref } = renderHarness();
      fireHydrateWith(ref, 'Take Five');
      expect(screen.getByText(/Resuming 'Take Five'/)).toBeInTheDocument();

      // #when
      act(() => {
        ref.current?.invoke(handler);
      });

      // #then
      expect(screen.queryByText(/Resuming 'Take Five'/)).not.toBeInTheDocument();
    },
  );

  it('dismisses immediately when the queue opens (showQueue flips true)', () => {
    // #given
    const { ref, rerender } = renderHarness(false);
    fireHydrateWith(ref, 'Giant Steps');
    expect(screen.getByText(/Resuming 'Giant Steps'/)).toBeInTheDocument();

    // #when
    act(() => {
      rerender(true);
    });

    // #then
    expect(screen.queryByText(/Resuming 'Giant Steps'/)).not.toBeInTheDocument();
  });

  it('dismisses when the Toast dismiss button is clicked', () => {
    // #given
    const { ref } = renderHarness();
    fireHydrateWith(ref, 'Four on Six');

    // #when
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    act(() => {
      fireEvent.click(dismissBtn);
      vi.advanceTimersByTime(400);
    });

    // #then
    expect(screen.queryByText(/Resuming 'Four on Six'/)).not.toBeInTheDocument();
  });

  it('shows the partial-failure message when hydrate skipped to a later track', () => {
    // #given
    const { ref } = renderHarness();

    // #when
    act(() => {
      ref.current?.fireHydrate(makeMediaTrack({ name: 'Skipped Track' }), true);
    });

    // #then
    expect(
      screen.getByText("Couldn't resume previous track — starting from next in queue."),
    ).toBeInTheDocument();
    // The specific track name must not leak into the partial-failure copy.
    expect(screen.queryByText(/Skipped Track/)).not.toBeInTheDocument();
  });

  it('shows the full-failure message when hydrate could not prepare any track', () => {
    // #given
    const { ref } = renderHarness();

    // #when
    act(() => {
      ref.current?.fireHydrateFailed();
    });

    // #then
    expect(
      screen.getByText("Couldn't resume your last session."),
    ).toBeInTheDocument();
  });
});
