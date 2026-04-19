import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import ProviderDisconnectDialog from '../ProviderDisconnectDialog';

function renderDialog(overrides?: {
  providerName?: string;
  affectedQueueCount?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const props = {
    providerName: 'Spotify',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <ProviderDisconnectDialog {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('ProviderDisconnectDialog', () => {
  describe('content rendering', () => {
    it('renders the provider name in title and body', () => {
      // #given / #when
      renderDialog({ providerName: 'Dropbox' });

      // #then
      expect(screen.getByText('Disconnect Dropbox')).toBeInTheDocument();
      expect(screen.getByText(/disconnect.*Dropbox/i)).toBeInTheDocument();
    });

    it('renders the affected-queue count line when count is positive', () => {
      // #given / #when
      renderDialog({ affectedQueueCount: 5 });

      // #then
      expect(screen.getByText(/remove 5 queued tracks/i)).toBeInTheDocument();
    });

    it('uses singular "track" when affected count is 1', () => {
      // #given / #when
      renderDialog({ affectedQueueCount: 1 });

      // #then
      expect(screen.getByText(/remove 1 queued track\./i)).toBeInTheDocument();
    });

    it('hides the count line when affectedQueueCount is 0', () => {
      // #given / #when
      renderDialog({ affectedQueueCount: 0 });

      // #then
      expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
    });

    it('hides the count line when affectedQueueCount is undefined', () => {
      // #given / #when
      renderDialog({ affectedQueueCount: undefined });

      // #then
      expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls onCancel when Cancel is clicked', () => {
      // #given
      const onCancel = vi.fn();
      renderDialog({ onCancel });

      // #when
      fireEvent.click(screen.getByText('Cancel'));

      // #then
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onConfirm when Disconnect is clicked', () => {
      // #given
      const onConfirm = vi.fn();
      renderDialog({ onConfirm });

      // #when
      fireEvent.click(screen.getByText('Disconnect'));

      // #then
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('calls onCancel when the overlay backdrop is clicked', () => {
      // #given
      const onCancel = vi.fn();
      renderDialog({ onCancel });
      // Dialog is portalled to document.body — query the overlay from there
      const overlay = document.body.querySelector('[style]') ?? document.body.firstElementChild as HTMLElement;
      // The overlay is the fixed-position div wrapping the dialog box
      const dialogBox = screen.getByRole('dialog');
      const overlayEl = dialogBox.parentElement as HTMLElement;

      // #when
      fireEvent.click(overlayEl);

      // #then
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('keyboard interactions', () => {
    it('calls onCancel when Escape is pressed on the overlay', () => {
      // #given
      const onCancel = vi.fn();
      renderDialog({ onCancel });
      const dialogBox = screen.getByRole('dialog');
      const overlayEl = dialogBox.parentElement as HTMLElement;

      // #when
      fireEvent.keyDown(overlayEl, { key: 'Escape' });

      // #then
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('destructive button styling', () => {
    it('Disconnect button has $destructive prop applied', () => {
      // #given / #when
      renderDialog();
      const disconnectButton = screen.getByText('Disconnect');

      // #then — $destructive renders red background via styled-components
      expect(disconnectButton).toHaveStyle({ background: 'rgba(239, 68, 68, 0.85)' });
    });
  });
});
