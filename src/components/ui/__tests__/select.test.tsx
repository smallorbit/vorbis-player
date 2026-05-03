import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../select';

// Radix Select uses Pointer Events and scrollIntoView which jsdom does not implement.
// Polyfill the minimum surface needed to prevent test crashes.
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

function renderSelect(options?: { value?: string; onValueChange?: (v: string) => void }) {
  const { value, onValueChange } = options ?? {};
  return render(
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label="Choose option">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="alpha">Alpha</SelectItem>
        <SelectItem value="beta">Beta</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe('Select', () => {
  describe('default render', () => {
    it('renders the trigger button', () => {
      // #when
      renderSelect();

      // #then
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('trigger shows placeholder when no value is selected', () => {
      // #when
      renderSelect();

      // #then
      expect(screen.getByRole('combobox')).toHaveTextContent('Select…');
    });

    it('listbox is absent from the DOM when closed', () => {
      // #when
      renderSelect();

      // #then
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('open / close', () => {
    it('clicking the trigger opens the listbox', async () => {
      // #given
      const user = userEvent.setup();
      renderSelect();

      // #when
      await user.click(screen.getByRole('combobox'));

      // #then
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('onValueChange fires with the selected value after picking an item', async () => {
      // #given
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      renderSelect({ onValueChange });
      await user.click(screen.getByRole('combobox'));

      // #when
      await user.click(screen.getByRole('option', { name: /Beta/i }));

      // #then
      expect(onValueChange).toHaveBeenCalledWith('beta');
    });
  });

  describe('motion-reduce variant', () => {
    it('SelectContent className includes motion-reduce animation overrides', async () => {
      // #given
      const user = userEvent.setup();
      renderSelect();
      await user.click(screen.getByRole('combobox'));
      const listbox = screen.getByRole('listbox');
      const content = listbox.closest('[data-radix-popper-content-wrapper]')?.firstElementChild ?? listbox.parentElement;

      // #then
      expect(content?.className ?? '').toContain('motion-reduce:data-[state=open]:animate-none');
      expect(content?.className ?? '').toContain('motion-reduce:data-[state=closed]:animate-none');
    });
  });

  describe('per-part style escape hatches', () => {
    it('triggerStyle applies as inline style on the trigger button', () => {
      // #when
      render(
        <Select>
          <SelectTrigger aria-label="Styled trigger" triggerStyle={{ minWidth: '200px' }}>
            <SelectValue placeholder="Pick…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="x">X</SelectItem>
          </SelectContent>
        </Select>,
      );

      // #then
      expect(screen.getByRole('combobox')).toHaveStyle({ minWidth: '200px' });
    });

    it('itemStyle applies as inline style on a SelectItem option', async () => {
      // #given
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger aria-label="Styled item trigger">
            <SelectValue placeholder="Pick…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="styled" itemStyle={{ fontWeight: 'bold' }}>
              Styled
            </SelectItem>
          </SelectContent>
        </Select>,
      );
      await user.click(screen.getByRole('combobox'));

      // #then
      expect(screen.getByRole('option', { name: /Styled/i })).toHaveStyle({
        fontWeight: 'bold',
      });
    });

    it('contentStyle applies as inline style on the SelectContent listbox element', async () => {
      // #given
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger aria-label="Content style trigger">
            <SelectValue placeholder="Pick…" />
          </SelectTrigger>
          <SelectContent contentStyle={{ minWidth: '300px' }}>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>,
      );
      await user.click(screen.getByRole('combobox'));
      const listbox = screen.getByRole('listbox');

      // contentStyle is spread onto SelectPrimitive.Content which renders as role="listbox"
      // #then
      expect(listbox).toHaveStyle({ minWidth: '300px' });
    });
  });
});
