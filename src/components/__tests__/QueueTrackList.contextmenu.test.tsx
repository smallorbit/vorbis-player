import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';

// Render rows plainly (no real dnd-kit gestures), but keep the REAL useLongPress
// and REAL QueueContextMenu so the trigger path is exercised end-to-end.
vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
    verticalListSortingStrategy: actual.verticalListSortingStrategy,
  };
});

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/hooks/useLikeTrack', () => ({
  useLikeTrack: vi.fn(() => ({
    isLiked: false,
    canSaveTrack: false,
    handleLikeToggle: vi.fn(),
  })),
}));

import QueueTrackList from '../QueueTrackList';

function renderList() {
  const tracks = [
    makeMediaTrack({ id: 'track-1', name: 'Song A' }),
    makeMediaTrack({ id: 'track-2', name: 'Song B' }),
  ];
  render(
    <ThemeProvider theme={theme}>
      <QueueTrackList
        tracks={tracks}
        currentTrackIndex={0}
        onTrackSelect={vi.fn()}
        onReorderTracks={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('QueueTrackList — context-menu trigger (regression for #1633)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens the menu on desktop right-click', () => {
    renderList();
    expect(screen.queryByTestId('queue-context-menu')).not.toBeInTheDocument();

    // #when - right-click a non-playing row (index 1, so "Remove" is present)
    fireEvent.contextMenu(screen.getByText('Song B'));

    // #then
    expect(screen.getByTestId('queue-context-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Play next/ })).toBeInTheDocument();
  });

  it('opens the menu on mobile long-press', () => {
    renderList();
    const row = screen.getByText('Song B');

    // #when - press and hold past the long-press threshold
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 50, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // #then
    expect(screen.getByTestId('queue-context-menu')).toBeInTheDocument();
  });
});
