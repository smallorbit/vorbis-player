import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { QueueContextMenu } from '../QueueContextMenu';

interface Option {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

function makeOptions(overrides: Option[] = []): Option[] {
  if (overrides.length) return overrides;
  return [
    { label: 'Play next', icon: <svg data-testid="icon-play" />, onClick: vi.fn() },
    { label: 'Like', icon: <svg data-testid="icon-like" />, onClick: vi.fn() },
    {
      label: 'Remove from queue',
      icon: <svg data-testid="icon-remove" />,
      onClick: vi.fn(),
      destructive: true,
    },
  ];
}

function renderMenu(props: Partial<React.ComponentProps<typeof QueueContextMenu>> = {}) {
  const merged = {
    x: 100,
    y: 120,
    options: makeOptions(),
    onClose: vi.fn(),
    ...props,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <QueueContextMenu {...merged} />
    </ThemeProvider>,
  );
  return { ...result, props: merged };
}

function getMenuItems(): HTMLButtonElement[] {
  return screen.getAllByRole('menuitem') as HTMLButtonElement[];
}

describe('QueueContextMenu', () => {
  it('renders one menu item per option, preserving labels', () => {
    // #when
    renderMenu();

    // #then
    const items = getMenuItems();
    expect(items).toHaveLength(3);
    expect(items.map((b) => b.textContent)).toEqual([
      'Play next',
      'Like',
      'Remove from queue',
    ]);
  });

  it('renders the popover content within an accessible menu container', () => {
    // #when
    renderMenu();

    // #then
    expect(screen.getByTestId('queue-context-menu')).toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Queue track actions' })).toBeInTheDocument();
  });

  it('invokes the option handler and onClose when an item is clicked', () => {
    // #given
    const onPlayNext = vi.fn();
    const onClose = vi.fn();
    const options = makeOptions([
      { label: 'Play next', icon: <svg />, onClick: onPlayNext },
    ]);

    // #when
    renderMenu({ options, onClose });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Play next' }));

    // #then
    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the destructive option as a normal, clickable menu item', () => {
    // #given
    const onRemove = vi.fn();
    const options = makeOptions([
      { label: 'Remove from queue', icon: <svg />, onClick: onRemove, destructive: true },
    ]);

    // #when
    renderMenu({ options });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from queue' }));

    // #then
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves focus to the next item', () => {
      // #given
      renderMenu();
      const items = getMenuItems();
      items[0]?.focus();

      // #when
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

      // #then
      expect(document.activeElement).toBe(items[1]);
    });

    it('ArrowDown wraps from the last item to the first', () => {
      // #given
      renderMenu();
      const items = getMenuItems();
      items[items.length - 1]?.focus();

      // #when
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

      // #then
      expect(document.activeElement).toBe(items[0]);
    });

    it('ArrowUp wraps from the first item to the last', () => {
      // #given
      renderMenu();
      const items = getMenuItems();
      items[0]?.focus();

      // #when
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });

      // #then
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('Home and End jump to the first and last items', () => {
      // #given
      renderMenu();
      const items = getMenuItems();
      items[1]?.focus();

      // #when / #then — Home
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
      expect(document.activeElement).toBe(items[0]);

      // #when / #then — End
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
      expect(document.activeElement).toBe(items[items.length - 1]);
    });
  });

  describe('dismissal', () => {
    it('calls onClose on Escape', () => {
      // #given
      const onClose = vi.fn();
      renderMenu({ onClose });

      // #when
      fireEvent.keyDown(screen.getByTestId('queue-context-menu'), { key: 'Escape' });

      // #then
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
