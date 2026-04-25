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
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

      // #then
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('calls onCancel when the overlay backdrop is clicked', async () => {
      // #given
      const onCancel = vi.fn();
      renderDialog({ onCancel });
      // Radix renders the overlay as a sibling of the dialog content under
      // its Portal, so we query by the data-testid wired into our shadcn
      // DialogOverlay override (src/components/ui/dialog.tsx).
      const overlay = screen.getByTestId('dialog-overlay');
      // Radix DismissableLayer registers its pointerdown listener via
      // setTimeout(0); flush the macrotask before firing the event.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // #when — Radix's DismissableLayer dispatches dismiss on pointerdown
      // outside the content; the overlay is "outside" by construction.
      fireEvent.pointerDown(overlay);

      // #then
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('keyboard interactions', () => {
    it('calls onCancel when Escape is pressed', () => {
      // #given
      const onCancel = vi.fn();
      renderDialog({ onCancel });

      // #when — Radix Dialog listens for Escape on document.body
      fireEvent.keyDown(document.body, { key: 'Escape' });

      // #then
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('destructive button styling', () => {
    it('Disconnect button uses the shadcn destructive variant', () => {
      // #given / #when
      renderDialog();
      const disconnectButton = screen.getByRole('button', { name: 'Disconnect' });

      // #then — shadcn Button variant="destructive" applies the `bg-destructive` class
      expect(disconnectButton).toHaveClass(/destructive/);
    });
  });
});
