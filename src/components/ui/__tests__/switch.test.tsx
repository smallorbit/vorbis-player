import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { Switch } from '../switch';

describe('Switch', () => {
  describe('a11y', () => {
    it('renders a role="switch" element', () => {
      // #when
      render(<Switch aria-label="Toggle feature" />);

      // #then
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('aria-checked is false when unchecked', () => {
      // #when
      render(<Switch aria-label="Toggle" checked={false} onCheckedChange={vi.fn()} />);

      // #then
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('aria-checked is true when checked', () => {
      // #when
      render(<Switch aria-label="Toggle" checked={true} onCheckedChange={vi.fn()} />);

      // #then
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('aria-label resolves via getByLabelText', () => {
      // #when
      render(<Switch aria-label="Enable notifications" />);

      // #then
      expect(screen.getByLabelText('Enable notifications')).toBeInTheDocument();
    });

    it('disabled prop marks the button as disabled', () => {
      // #when
      render(<Switch aria-label="Toggle" disabled />);

      // #then
      expect(screen.getByRole('switch')).toBeDisabled();
    });
  });

  describe('callbacks', () => {
    it('onCheckedChange fires with the new boolean value on click', async () => {
      // #given
      const onCheckedChange = vi.fn();
      const user = userEvent.setup();
      render(<Switch aria-label="Toggle" onCheckedChange={onCheckedChange} />);

      // #when
      await user.click(screen.getByRole('switch'));

      // #then
      expect(onCheckedChange).toHaveBeenCalledOnce();
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('disabled switch does not invoke onCheckedChange on click', async () => {
      // #given
      const onCheckedChange = vi.fn();
      const user = userEvent.setup();
      render(<Switch aria-label="Toggle" disabled onCheckedChange={onCheckedChange} />);

      // #when
      await user.click(screen.getByRole('switch'));

      // #then
      expect(onCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('variant="accent" (default)', () => {
    it('track className contains accent-color checked-state class', () => {
      // #when
      render(<Switch aria-label="Toggle" checked onCheckedChange={vi.fn()} />);

      // #then
      expect(screen.getByRole('switch').className).toContain(
        'data-[state=checked]:bg-[var(--accent-color)]',
      );
    });

    it('track className contains bg-input/40 unchecked-state class', () => {
      // #when
      render(<Switch aria-label="Toggle" checked={false} onCheckedChange={vi.fn()} />);

      // #then
      expect(screen.getByRole('switch').className).toContain(
        'data-[state=unchecked]:bg-input/40',
      );
    });
  });

  describe('variant="neutral"', () => {
    it('track className contains bg-primary checked-state class', () => {
      // #when
      render(<Switch aria-label="Toggle" variant="neutral" checked onCheckedChange={vi.fn()} />);

      // #then
      expect(screen.getByRole('switch').className).toContain('data-[state=checked]:bg-primary');
    });

    it('track className contains bg-input unchecked-state class', () => {
      // #when
      render(
        <Switch aria-label="Toggle" variant="neutral" checked={false} onCheckedChange={vi.fn()} />,
      );

      // #then
      expect(screen.getByRole('switch').className).toContain('data-[state=unchecked]:bg-input');
    });
  });

  describe('state-aware thumb colors', () => {
    it('thumb className contains bg-background for the checked state', () => {
      // #given
      render(<Switch aria-label="Toggle" checked onCheckedChange={vi.fn()} />);
      const thumb = screen.getByRole('switch').querySelector('span');

      // #then
      expect(thumb?.className).toContain('data-[state=checked]:bg-background');
    });

    it('thumb className contains bg-foreground for the unchecked state', () => {
      // #given
      render(<Switch aria-label="Toggle" checked={false} onCheckedChange={vi.fn()} />);
      const thumb = screen.getByRole('switch').querySelector('span');

      // #then
      expect(thumb?.className).toContain('data-[state=unchecked]:bg-foreground');
    });
  });

  describe('style escape hatches', () => {
    it('trackStyle applies as inline style on the root button', () => {
      // #when
      render(<Switch aria-label="Toggle" trackStyle={{ background: 'red' }} />);

      // #then
      expect(screen.getByRole('switch')).toHaveStyle({ background: 'red' });
    });

    it('thumbStyle applies as inline style on the thumb span', () => {
      // #when
      render(<Switch aria-label="Toggle" thumbStyle={{ border: '2px solid blue' }} />);
      const thumb = screen.getByRole('switch').querySelector('span');

      // #then
      expect(thumb).toHaveStyle({ border: '2px solid blue' });
    });
  });
});
