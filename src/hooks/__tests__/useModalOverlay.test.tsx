import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { useModalOverlay } from '../useModalOverlay';

function Overlay({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) {
  const { containerRef, dialogProps } = useModalOverlay<HTMLDivElement>(isOpen);
  return (
    <div ref={containerRef} {...dialogProps} aria-label="Panel" data-testid="overlay">
      {children}
    </div>
  );
}

function Harness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Overlay isOpen={isOpen}>
        <button>First</button>
        <button>Middle</button>
        <button onClick={() => setIsOpen(false)}>Close</button>
      </Overlay>
    </>
  );
}

describe('useModalOverlay', () => {
  it('exposes dialog semantics', () => {
    // #given / #when
    render(<Harness initiallyOpen />);

    // #then
    const dialog = screen.getByRole('dialog', { name: 'Panel' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('marks the container inert while closed', () => {
    // #given / #when
    render(<Harness />);

    // #then
    expect(screen.getByTestId('overlay')).toHaveAttribute('inert');
  });

  it('moves focus to the first focusable element on open', async () => {
    // #given
    const user = userEvent.setup();
    render(<Harness />);

    // #when
    await user.click(screen.getByRole('button', { name: 'Open' }));

    // #then
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    expect(screen.getByTestId('overlay')).not.toHaveAttribute('inert');
  });

  it('restores focus to the opener on close', async () => {
    // #given
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);

    // #when
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // #then
    expect(opener).toHaveFocus();
  });

  it('wraps Tab from the last element back to the first', async () => {
    // #given
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Close' }).focus();

    // #when
    await user.tab();

    // #then
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element to the last', async () => {
    // #given
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    // #when
    await user.tab({ shift: true });

    // #then
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('focuses the container itself when it has nothing focusable', () => {
    // #given / #when
    render(<Overlay isOpen />);

    // #then
    expect(screen.getByTestId('overlay')).toHaveFocus();
  });
});
