import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import VorbisQueueDialog from '../VorbisQueueDialog';
import type { VorbisQueueDialogProps } from '../VorbisQueueDialog';

function renderDialog(overrides?: Partial<VorbisQueueDialogProps>) {
  const props: VorbisQueueDialogProps = {
    isOpen: true,
    isResolving: false,
    removedCount: null,
    onKeepQueue: vi.fn(),
    onStartFresh: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider theme={theme}>
      <VorbisQueueDialog {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('VorbisQueueDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('initial state (isResolving=false, removedCount=null)', () => {
    it('renders both action buttons', () => {
      renderDialog();
      expect(screen.getByRole('button', { name: /keep queue/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /start fresh/i })).toBeTruthy();
    });

    it('shows explanation text about cross-provider tracks', () => {
      renderDialog();
      expect(screen.getByText(/radio queue contains tracks/i)).toBeTruthy();
    });

    it('calls onStartFresh when "Start fresh" is clicked', () => {
      const props = renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }));
      expect(props.onStartFresh).toHaveBeenCalledOnce();
    });

    it('calls onKeepQueue when "Keep queue" is clicked', () => {
      const props = renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /keep queue/i }));
      expect(props.onKeepQueue).toHaveBeenCalledOnce();
    });
  });

  describe('resolving state (isResolving=true)', () => {
    it('shows loading text when isResolving is true', () => {
      renderDialog({ isResolving: true });
      expect(screen.getByText(/resolving tracks/i)).toBeTruthy();
    });

    it('disables both buttons while resolving', () => {
      renderDialog({ isResolving: true });
      const keepBtn = screen.getByRole('button', { name: /keep queue/i });
      const freshBtn = screen.getByRole('button', { name: /start fresh/i });
      expect((keepBtn as HTMLButtonElement).disabled).toBe(true);
      expect((freshBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('summary state (isResolving=false, removedCount set)', () => {
    it('shows success message when removedCount is 0', () => {
      renderDialog({ removedCount: 0 });
      expect(screen.getByText(/all tracks resolved successfully/i)).toBeTruthy();
    });

    it('shows removal count when removedCount is 2', () => {
      renderDialog({ removedCount: 2 });
      expect(screen.getByText(/2 track\(s\) not found on spotify/i)).toBeTruthy();
    });

    it('renders a Continue button in summary state', () => {
      renderDialog({ removedCount: 0 });
      expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    });

    it('calls onDismiss when Continue is clicked', () => {
      const props = renderDialog({ removedCount: 0 });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(props.onDismiss).toHaveBeenCalledOnce();
    });

    it('does not show the initial action buttons in summary state', () => {
      renderDialog({ removedCount: 1 });
      expect(screen.queryByRole('button', { name: /keep queue/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /start fresh/i })).toBeNull();
    });
  });
});
