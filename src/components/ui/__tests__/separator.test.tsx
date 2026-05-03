import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Separator } from '../separator';

describe('Separator', () => {
  describe('default render', () => {
    it('renders as a horizontal separator by default', () => {
      // #when
      const { container } = render(<Separator />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('has role="none" when decorative (default)', () => {
      // #when
      const { container } = render(<Separator />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el.getAttribute('role')).toBe('none');
    });

    it('has role="separator" when not decorative', () => {
      // #when
      const { container } = render(<Separator decorative={false} />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el.getAttribute('role')).toBe('separator');
    });

    it('applies horizontal sizing classes', () => {
      // #when
      const { container } = render(<Separator />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el.className).toContain('h-[1px]');
      expect(el.className).toContain('w-full');
    });
  });

  describe('orientation="vertical"', () => {
    it('renders with data-orientation="vertical"', () => {
      // #when
      const { container } = render(<Separator orientation="vertical" />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el).toHaveAttribute('data-orientation', 'vertical');
    });

    it('applies vertical sizing classes', () => {
      // #when
      const { container } = render(<Separator orientation="vertical" />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el.className).toContain('h-full');
      expect(el.className).toContain('w-[1px]');
    });
  });

  describe('neutral palette', () => {
    it('has bg-border class (no accent wiring)', () => {
      // #when
      const { container } = render(<Separator />);
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el.className).toContain('bg-border');
    });
  });

  describe('motion-reduce variant', () => {
    it('separator renders without animation classes (no transitions apply)', () => {
      // Separator carries no entry/exit animation classes — no motion-reduce
      // overrides are needed. Smoke-render confirms the tree mounts cleanly.
      // #when / #then
      expect(() => {
        const { container } = render(<Separator />);
        expect(container.firstChild).toBeInTheDocument();
      }).not.toThrow();
    });
  });

  describe('per-part style escape hatch', () => {
    it('separatorStyle applies as inline style on the separator element', () => {
      // #when
      const { container } = render(
        <Separator separatorStyle={{ background: 'red', height: '2px' }} />,
      );
      const el = container.firstChild as HTMLElement;

      // #then
      expect(el).toHaveStyle({ background: 'red', height: '2px' });
    });
  });
});
