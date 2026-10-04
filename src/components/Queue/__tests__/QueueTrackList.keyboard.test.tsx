import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeTrack } from '@/test/fixtures';

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

vi.mock('@/hooks/useLongPress', () => ({
  useLongPress: vi.fn(() => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onPointerMove: vi.fn(),
  })),
}));

vi.mock('@/hooks/useHorizontalSwipeToRemove', () => ({
  useHorizontalSwipeToRemove: vi.fn(() => ({
    ref: { current: null },
    offsetX: 0,
    isSwiping: false,
    isRevealed: false,
    reset: vi.fn(),
  })),
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: () => null,
}));

vi.mock('@/components/styled', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Avatar: ({ alt }: { alt?: string | undefined }) => <img alt={alt ?? ''} />,
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import QueueTrackList from '../QueueTrackList';

function renderManageableList(onTrackSelect = vi.fn()) {
  const tracks = [
    makeTrack({ id: 'track-1', name: 'Song A', artists: 'Artist A' }),
    makeTrack({ id: 'track-2', name: 'Song B', artists: 'Artist B' }),
  ];
  render(
    <ThemeProvider theme={theme}>
      <QueueTrackList
        tracks={tracks}
        currentTrackIndex={0}
        onTrackSelect={onTrackSelect}
        onRemoveTrack={vi.fn()}
        onReorderTracks={vi.fn()}
        isOpen
      />
    </ThemeProvider>,
  );
  return { onTrackSelect };
}

describe('QueueTrackList — keyboard (#1724)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes focusable rows with descriptive aria-labels', async () => {
    // #given
    const user = userEvent.setup();
    renderManageableList();

    const rows = screen.getAllByTestId('queue-track-row');
    expect(rows[0]).toHaveAttribute('role', 'button');
    expect(rows[0]).toHaveAttribute('aria-label', 'Song A, Artist A, now playing');
    expect(rows[1]).toHaveAttribute('aria-label', 'Song B, Artist B');

    // #when
    await user.tab();

    // #then — first row is in tab order before the actions menu button
    expect(rows[0]).toHaveFocus();
  });

  it('selects a row on Enter and Space', async () => {
    // #given
    const user = userEvent.setup();
    const onTrackSelect = vi.fn();
    renderManageableList(onTrackSelect);
    const secondRow = screen.getAllByTestId('queue-track-row')[1];
    if (!secondRow) throw new Error('expected second row');

    // #when
    secondRow.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    // #then
    expect(onTrackSelect).toHaveBeenCalledWith(1);
    expect(onTrackSelect).toHaveBeenCalledTimes(2);
  });

  it('opens the context menu from the focusable actions trigger', async () => {
    // #given
    renderManageableList();
    const trigger = screen.getByRole('button', { name: 'Actions for Song B' });

    // #when
    fireEvent.click(trigger);

    // #then
    expect(screen.getByTestId('queue-context-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Play next/ })).toBeInTheDocument();
  });
});
