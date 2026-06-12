import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';

// Capture the `items` array passed to every <SortableContext> render so tests
// can assert the exact IDs without simulating drag gestures.
const capturedSortableContextItems: string[][] = [];

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...actual,
    SortableContext: ({ items, children }: { items: string[]; children: React.ReactNode }) => {
      capturedSortableContextItems.push(items);
      return <>{children}</>;
    },
    useSortable: (args: { id: string }) => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
      // Expose the id so tests can inspect which id was forwarded.
      _capturedId: args.id,
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
  useLongPress: vi.fn(() => ({ onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerLeave: vi.fn() })),
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

vi.mock('./QueueContextMenu', () => ({
  QueueContextMenu: () => null,
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: () => null,
}));

vi.mock('@/components/styled', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Avatar: ({ alt }: { alt?: string | undefined }) => <img alt={alt ?? ''} />,
    Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import QueueTrackList from '../QueueTrackList';

function renderList(overrides?: {
  tracks?: ReturnType<typeof makeMediaTrack>[];
  currentTrackIndex?: number;
  onReorderTracks?: (from: number, to: number) => void;
}) {
  const tracks = overrides?.tracks ?? [
    makeMediaTrack({ id: 'track-1', name: 'Song A' }),
    makeMediaTrack({ id: 'track-2', name: 'Song B' }),
    makeMediaTrack({ id: 'track-3', name: 'Song C' }),
  ];
  render(
    <ThemeProvider theme={theme}>
      <QueueTrackList
        tracks={tracks}
        currentTrackIndex={overrides?.currentTrackIndex ?? 0}
        onTrackSelect={vi.fn()}
        onReorderTracks={overrides?.onReorderTracks ?? vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('QueueTrackList — sortable ID contract', () => {
  beforeEach(() => {
    capturedSortableContextItems.length = 0;
  });

  describe('SortableContext items', () => {
    it('passes track.id (not a composite) as each sortable item', () => {
      // #given
      const tracks = [
        makeMediaTrack({ id: 'track-1', name: 'Song A' }),
        makeMediaTrack({ id: 'track-2', name: 'Song B' }),
        makeMediaTrack({ id: 'track-3', name: 'Song C' }),
      ];

      // #when
      renderList({ tracks });

      // #then — SortableContext received bare IDs, no name-based composite
      expect(capturedSortableContextItems.length).toBeGreaterThan(0);
      const items = capturedSortableContextItems[0];
      expect(items).toEqual(['track-1', 'track-2', 'track-3']);
    });

    it('items remain stable when a track name changes (simulates ID3 enrichment)', () => {
      // #given — initial render with one track
      const track = makeMediaTrack({ id: 'abc', name: 'filename-derived.flac' });
      renderList({ tracks: [track] });

      const itemsBefore = [...(capturedSortableContextItems[0] ?? [])];
      capturedSortableContextItems.length = 0;

      // #when — re-render with same track but mutated name
      renderList({ tracks: [{ ...track, name: 'Real Album Title' }] });

      const itemsAfter = capturedSortableContextItems[0];

      // #then — sortable IDs are unaffected by the name mutation
      expect(itemsBefore).toEqual(['abc']);
      expect(itemsAfter).toEqual(['abc']);
    });

    it('items contain only the track id with no name prefix', () => {
      // #given — track whose name and id share no substring (guards against composite patterns)
      const tracks = [
        makeMediaTrack({ id: 'xk9-unique', name: 'Completely Different Name' }),
      ];

      // #when
      renderList({ tracks });

      // #then — no item is of the form `${name}-${id}` or `${id}-${name}`
      const items = capturedSortableContextItems[0] ?? [];
      for (const item of items) {
        expect(item).toBe('xk9-unique');
        expect(item).not.toContain('Completely Different Name');
      }
    });
  });
});
