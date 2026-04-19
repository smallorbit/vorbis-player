import React, { useCallback, useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';
import Toast from '../Toast';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

type ResumeToastHarnessHandle = {
  fireHydrate: (track: MediaTrack) => void;
  press: (action: 'play' | 'pause' | 'library' | 'queue') => void;
};

// Mirrors the AudioPlayer wire-up: state + dismissal triggers (play / pause /
// openLibrary) plus a showQueue effect, rendering the real Toast component.
const ResumeToastHarness = React.forwardRef<ResumeToastHarnessHandle, { showQueue: boolean }>(
  ({ showQueue }, ref) => {
    const [resumeToast, setResumeToast] = useState<{ message: string } | null>(null);
    const dismiss = useCallback(() => setResumeToast(null), []);

    const handleHydrateFired = useCallback((track: MediaTrack) => {
      setResumeToast({ message: `Resuming '${track.name}' — press play to continue.` });
    }, []);

    const onPlay = useCallback(() => setResumeToast(null), []);
    const onPause = useCallback(() => setResumeToast(null), []);
    const onOpenLibrary = useCallback(() => setResumeToast(null), []);

    useEffect(() => {
      if (resumeToast && showQueue) setResumeToast(null);
    }, [resumeToast, showQueue]);

    React.useImperativeHandle(ref, () => ({
      fireHydrate: handleHydrateFired,
      press: (action) => {
        if (action === 'play') onPlay();
        if (action === 'pause') onPause();
        if (action === 'library') onOpenLibrary();
      },
    }));

    return resumeToast ? (
      <Toast message={resumeToast.message} onDismiss={dismiss} />
    ) : null;
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
    const track = makeTrack({ name: 'Bohemian Rhapsody' });

    // #when
    act(() => {
      ref.current?.fireHydrate(track);
    });

    // #then
    expect(
      screen.getByText("Resuming 'Bohemian Rhapsody' — press play to continue."),
    ).toBeInTheDocument();
  });

  it('auto-dismisses after ~5s', () => {
    // #given
    const { ref } = renderHarness();
    const track = makeTrack({ name: 'Caravan' });
    act(() => {
      ref.current?.fireHydrate(track);
    });
    expect(screen.getByText(/Resuming 'Caravan'/)).toBeInTheDocument();

    // #when — advance past the Toast's 5000ms auto-dismiss + exit animation
    act(() => {
      vi.advanceTimersByTime(5400);
    });

    // #then
    expect(screen.queryByText(/Resuming 'Caravan'/)).not.toBeInTheDocument();
  });

  it('dismisses immediately when the user presses play', () => {
    // #given
    const { ref } = renderHarness();
    const track = makeTrack({ name: 'Take Five' });
    act(() => {
      ref.current?.fireHydrate(track);
    });
    expect(screen.getByText(/Resuming 'Take Five'/)).toBeInTheDocument();

    // #when
    act(() => {
      ref.current?.press('play');
    });

    // #then
    expect(screen.queryByText(/Resuming 'Take Five'/)).not.toBeInTheDocument();
  });

  it('dismisses immediately when the user presses pause', () => {
    // #given
    const { ref } = renderHarness();
    const track = makeTrack({ name: 'So What' });
    act(() => {
      ref.current?.fireHydrate(track);
    });

    // #when
    act(() => {
      ref.current?.press('pause');
    });

    // #then
    expect(screen.queryByText(/Resuming 'So What'/)).not.toBeInTheDocument();
  });

  it('dismisses immediately when the user navigates to the library', () => {
    // #given
    const { ref } = renderHarness();
    const track = makeTrack({ name: 'Blue in Green' });
    act(() => {
      ref.current?.fireHydrate(track);
    });

    // #when
    act(() => {
      ref.current?.press('library');
    });

    // #then
    expect(screen.queryByText(/Resuming 'Blue in Green'/)).not.toBeInTheDocument();
  });

  it('dismisses immediately when the queue opens (showQueue flips true)', () => {
    // #given
    const { ref, rerender } = renderHarness(false);
    const track = makeTrack({ name: 'Giant Steps' });
    act(() => {
      ref.current?.fireHydrate(track);
    });
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
    const track = makeTrack({ name: 'Four on Six' });
    act(() => {
      ref.current?.fireHydrate(track);
    });

    // #when
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    act(() => {
      fireEvent.click(dismissBtn);
      vi.advanceTimersByTime(400);
    });

    // #then
    expect(screen.queryByText(/Resuming 'Four on Six'/)).not.toBeInTheDocument();
  });
});
