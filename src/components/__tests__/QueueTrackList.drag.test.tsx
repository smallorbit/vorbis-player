import { useState } from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

// Mock only the leaf hooks/components that transitively pull in the Spotify SDK
// and other heavy dependencies. @dnd-kit is intentionally NOT mocked — this test
// drives a real PointerSensor drag gesture end to end.
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
    onPointerLeave: vi.fn(),
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

vi.mock('./QueueContextMenu', () => ({
  QueueContextMenu: () => null,
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: () => null,
}));

const { default: QueueTrackList } = await import('../QueueTrackList');

// jsdom ships no usable PointerEvent (clientX/clientY are dropped), and
// @dnd-kit's PointerSensor activator requires isPrimary === true && button === 0.
// Extending MouseEvent lets coordinates ride through and defaults isPrimary true.
class FakePointerEvent extends MouseEvent {
  isPrimary = true;
  pointerId = 1;
  pointerType = 'mouse';
  width = 1;
  height = 1;
  pressure = 0;
  tangentialPressure = 0;
  tiltX = 0;
  tiltY = 0;
  twist = 0;

  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    if (params.isPrimary != null) this.isPrimary = params.isPrimary;
    if (params.pointerId != null) this.pointerId = params.pointerId;
    if (params.pointerType != null) this.pointerType = params.pointerType;
  }
}

const ROW_HEIGHT = 50;
const ROW_WIDTH = 300;

function stubRowRect(el: HTMLElement, index: number): void {
  const top = index * ROW_HEIGHT;
  el.getBoundingClientRect = (): DOMRect =>
    ({
      x: 0,
      y: top,
      top,
      left: 0,
      bottom: top + ROW_HEIGHT,
      right: ROW_WIDTH,
      width: ROW_WIDTH,
      height: ROW_HEIGHT,
      toJSON() {},
    }) as DOMRect;
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeAll(() => {
  global.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent;
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: ROW_HEIGHT,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: ROW_WIDTH,
  });
});

/**
 * Harness that owns the queue order so a reorder callback actually mutates the
 * rendered list, and exposes a setter to mutate a track's display name
 * mid-gesture (mimicking async Dropbox ID3 enrichment landing during a drag).
 */
function DragHarness({
  initialTracks,
  onReorderSpy,
  renameRef,
}: {
  initialTracks: MediaTrack[];
  onReorderSpy: (from: number, to: number) => void;
  renameRef: { current: ((id: string, name: string) => void) | null };
}) {
  const [tracks, setTracks] = useState(initialTracks);

  renameRef.current = (id: string, name: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  const handleReorder = (from: number, to: number) => {
    onReorderSpy(from, to);
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <QueueTrackList
        tracks={tracks}
        currentTrackIndex={0}
        onTrackSelect={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReorderTracks={handleReorder}
        canEdit
        isOpen
      />
    </ThemeProvider>
  );
}

/**
 * The dnd-kit sortable element is the QueueListItem rendered with
 * role="button" + aria-roledescription="sortable" once edit mode spreads the
 * sortable attributes/listeners. dnd-kit measures the setNodeRef wrapper (its
 * parent), so rects are stubbed there.
 */
function getDraggables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="button"][aria-roledescription="sortable"]',
    ),
  );
}

function nodeRefWrapper(draggable: HTMLElement): HTMLElement {
  const parent = draggable.parentElement;
  if (!parent) throw new Error('sortable draggable has no setNodeRef wrapper');
  return parent;
}

describe('QueueTrackList — drag gesture survives mid-drag rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the drag active when a dragged track is renamed, and still applies the reorder on drop', async () => {
    // #given — a 3-track queue in edit mode, with the current track pinned at
    // index 0 (so the row we drag, index 1, exposes drag listeners)
    const onReorderSpy = vi.fn<(from: number, to: number) => void>();
    const renameRef: { current: ((id: string, name: string) => void) | null } = {
      current: null,
    };
    const initialTracks = [
      makeMediaTrack({ id: 'track-1', name: 'Song A' }),
      makeMediaTrack({ id: 'track-2', name: 'filename-derived.flac' }),
      makeMediaTrack({ id: 'track-3', name: 'Song C' }),
    ];

    render(
      <DragHarness
        initialTracks={initialTracks}
        onReorderSpy={onReorderSpy}
        renameRef={renameRef}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));

    // The track at index 1 starts with a filename-style name; rename targets it.
    // dnd-kit caches drag-start rects, so stub the setNodeRef wrappers once up front.
    let draggables = getDraggables();
    draggables.forEach((d, i) => stubRowRect(nodeRefWrapper(d), i));

    const dragHandle = draggables[1];
    const dropWrapper = draggables[2] ? nodeRefWrapper(draggables[2]) : undefined;
    if (!dragHandle || !dropWrapper) throw new Error('expected at least 3 rows');

    const from = centerOf(nodeRefWrapper(dragHandle));
    const to = centerOf(dropWrapper);

    // #when — lift the second row and move it past the 8px activation distance
    fireEvent.pointerDown(dragHandle, {
      clientX: from.x,
      clientY: from.y,
      button: 0,
      isPrimary: true,
    });
    fireEvent.pointerMove(document, { clientX: from.x, clientY: from.y + 9 });
    await flush();

    // ...and MID-GESTURE the dragged track's display name is enriched.
    // Pre-fix code keyed sortable IDs by `${name}-${id}`, so this rename would
    // orphan active.id and cancel the drag.
    act(() => {
      renameRef.current?.('track-2', 'Real Album Title');
    });
    await flush();

    // Re-stub rects after the rename rerender so any freshly-created row nodes
    // still report live rects (dnd-kit reuses its cached drag-start rect map for
    // the active drag; this just keeps the DOM measurable for the helper).
    draggables = getDraggables();
    draggables.forEach((d, i) => stubRowRect(nodeRefWrapper(d), i));

    // continue the gesture to the third row's center, then drop
    fireEvent.pointerMove(document, { clientX: to.x, clientY: to.y });
    await flush();
    fireEvent.pointerUp(document, { clientX: to.x, clientY: to.y });
    await flush();

    // #then — the rename did not interrupt the gesture: the reorder still fired,
    // moving the renamed track from index 1 to index 2
    expect(onReorderSpy).toHaveBeenCalledTimes(1);
    expect(onReorderSpy).toHaveBeenCalledWith(1, 2);

    // ...and the renamed track is now visible in its new position
    expect(screen.getByText('Real Album Title')).toBeInTheDocument();
  });
});
