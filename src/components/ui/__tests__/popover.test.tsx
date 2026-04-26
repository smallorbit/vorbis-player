import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverClose,
} from '../popover';

describe('Popover', () => {
  describe('open / closed state', () => {
    it('content is absent from the DOM when closed', () => {
      // #when
      render(
        <Popover open={false}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>,
      );

      // #then
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('content is present in the DOM when open', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>,
      );

      // #then
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('trigger click opens popover in uncontrolled mode', async () => {
      // #given
      const user = userEvent.setup();
      render(
        <Popover>
          <PopoverTrigger>Toggle</PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>,
      );

      // #when
      await user.click(screen.getByRole('button', { name: /Toggle/i }));

      // #then
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('onOpenChange(false) fires when Escape is pressed', async () => {
      // #given
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Popover open={true} onOpenChange={onOpenChange}>
          <PopoverContent>
            <button>Inside</button>
          </PopoverContent>
        </Popover>,
      );
      screen.getByRole('button', { name: /Inside/i }).focus();

      // #when
      await user.keyboard('{Escape}');

      // #then
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('portal rendering', () => {
    it('content is portaled to document.body, not inside the render container', () => {
      // #given / #when
      const { container } = render(
        <Popover open={true}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Portal content</PopoverContent>
        </Popover>,
      );

      // #then
      const dialog = screen.getByRole('dialog');
      expect(container).not.toContainElement(dialog);
      expect(document.body).toContainElement(dialog);
    });
  });

  describe('z-index', () => {
    it('content has z-index 1500 (theme.zIndex.popover, above dialogs at 1405)', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      // #then
      expect(screen.getByRole('dialog')).toHaveStyle({ zIndex: 1500 });
    });
  });

  describe('neutral palette classes', () => {
    it('content has bg-popover, text-popover-foreground, and border classes', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );
      const dialog = screen.getByRole('dialog');

      // #then
      expect(dialog.className).toContain('bg-popover');
      expect(dialog.className).toContain('text-popover-foreground');
      expect(dialog.className).toContain('border');
    });
  });

  describe('animation classes', () => {
    it('content className includes animate-in and animate-out data-state variants', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );
      const dialog = screen.getByRole('dialog');

      // #then
      expect(dialog.className).toContain('data-[state=open]:animate-in');
      expect(dialog.className).toContain('data-[state=closed]:animate-out');
    });

    it('content className includes motion-reduce animation overrides', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );
      const dialog = screen.getByRole('dialog');

      // #then
      expect(dialog.className).toContain('motion-reduce:data-[state=open]:animate-none');
      expect(dialog.className).toContain('motion-reduce:data-[state=closed]:animate-none');
    });
  });

  describe('default positioning props', () => {
    it('content has data-side="bottom" and data-align="center" by default', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );
      const dialog = screen.getByRole('dialog');

      // #then
      expect(dialog).toHaveAttribute('data-side', 'bottom');
      expect(dialog).toHaveAttribute('data-align', 'center');
    });
  });

  describe('PopoverClose', () => {
    it('PopoverClose inside content invokes onOpenChange(false) when clicked', async () => {
      // #given
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Popover open={true} onOpenChange={onOpenChange}>
          <PopoverContent>
            <PopoverClose data-testid="close-btn">Close</PopoverClose>
          </PopoverContent>
        </Popover>,
      );

      // #when
      await user.click(screen.getByTestId('close-btn'));

      // #then
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('PopoverAnchor', () => {
    it('renders an anchor element as positioning reference alongside open content', () => {
      // #when
      render(
        <Popover open={true}>
          <PopoverAnchor asChild>
            <div data-testid="anchor-div">anchor</div>
          </PopoverAnchor>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      // #then
      expect(screen.getByTestId('anchor-div')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
