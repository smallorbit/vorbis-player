/**
 * Extra tests for LibraryCard — preventDefault on right-click and long-press (#1294).
 * Supplements card/__tests__/LibraryCard.test.tsx written by the builder.
 */

import React from 'react';
import { render, screen, createEvent, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LibraryCard from '../LibraryCard';

const baseProps = {
  kind: 'playlist' as const,
  id: 'p1',
  name: 'Sample Playlist',
  variant: 'row' as const,
  onSelect: vi.fn(),
};

describe('LibraryCard (extra)', () => {
  it('calls preventDefault on context-menu event to suppress native browser menu', () => {
    // #given
    const onContextMenuRequest = vi.fn();
    render(<LibraryCard {...baseProps} onContextMenuRequest={onContextMenuRequest} />);
    const card = screen.getByTestId('library-card-playlist-p1');
    const contextMenuEvent = createEvent.contextMenu(card, { clientX: 30, clientY: 40 });
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault');

    // #when
    fireEvent(card, contextMenuEvent);

    // #then
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  describe('long-press', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires onContextMenuRequest after 500ms hold', () => {
      // #given
      const onContextMenuRequest = vi.fn();
      render(<LibraryCard {...baseProps} onContextMenuRequest={onContextMenuRequest} />);
      const card = screen.getByTestId('library-card-playlist-p1');

      // #when — simulate pointer down and wait 500ms
      act(() => {
        fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // #then
      expect(onContextMenuRequest).toHaveBeenCalledTimes(1);
      const req = onContextMenuRequest.mock.calls[0][0];
      expect(req.kind).toBe('playlist');
      expect(req.id).toBe('p1');
    });

    it('fires onContextMenuRequest exactly once — does not double-fire on pointerUp after long-press', () => {
      // #given
      const onContextMenuRequest = vi.fn();
      render(<LibraryCard {...baseProps} onContextMenuRequest={onContextMenuRequest} />);
      const card = screen.getByTestId('library-card-playlist-p1');

      // #when — long-press fires, then pointer released
      act(() => { fireEvent.pointerDown(card, { clientX: 5, clientY: 5 }); });
      act(() => { vi.advanceTimersByTime(500); });
      act(() => { fireEvent.pointerUp(card); });

      // #then — triggered exactly once (onTap suppressed after long-press)
      expect(onContextMenuRequest).toHaveBeenCalledTimes(1);
    });

    it('does not activate long-press when onContextMenuRequest is undefined', () => {
      // #given — no context menu handler, so useLongPress disabled
      const onSelect = vi.fn();
      render(<LibraryCard {...baseProps} onSelect={onSelect} />);
      const card = screen.getByTestId('library-card-playlist-p1');

      // #when
      act(() => {
        fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
        vi.advanceTimersByTime(500);
        fireEvent.pointerUp(card);
      });

      // #then — click fires onSelect via normal click handler (not long-press path)
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });
});
