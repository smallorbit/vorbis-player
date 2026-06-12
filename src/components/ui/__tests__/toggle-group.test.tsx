import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { ToggleGroup, ToggleGroupItem } from '../toggle-group';

const renderGroup = (
  props: React.ComponentProps<typeof ToggleGroup> = { type: 'single' },
) =>
  render(
    <ToggleGroup aria-label="Sizes" {...props}>
      <ToggleGroupItem value="s">Small</ToggleGroupItem>
      <ToggleGroupItem value="m">Medium</ToggleGroupItem>
      <ToggleGroupItem value="l">Large</ToggleGroupItem>
    </ToggleGroup>,
  );

describe('ToggleGroup', () => {
  describe('a11y', () => {
    it('exposes an accessible group via aria-label', () => {
      // #when
      renderGroup({ type: 'single' });

      // #then
      expect(screen.getByRole('group', { name: 'Sizes' })).toBeInTheDocument();
    });

    it('type="single" renders items as radio controls (roving selection)', () => {
      // #when
      renderGroup({ type: 'single' });

      // #then
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('marks the active item with data-state="on"', () => {
      // #when
      renderGroup({ type: 'single', value: 'm' });

      // #then
      expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAttribute(
        'data-state',
        'on',
      );
      expect(screen.getByRole('radio', { name: 'Small' })).toHaveAttribute(
        'data-state',
        'off',
      );
    });
  });

  describe('callbacks', () => {
    it('onValueChange fires with the clicked item value', async () => {
      // #given
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      renderGroup({ type: 'single', value: 's', onValueChange });

      // #when
      await user.click(screen.getByRole('radio', { name: 'Large' }));

      // #then
      expect(onValueChange).toHaveBeenCalledWith('l');
    });
  });

  describe('variant', () => {
    it('default (neutral) item uses the --primary active class', () => {
      // #when
      renderGroup({ type: 'single', value: 's' });

      // #then
      expect(screen.getByRole('radio', { name: 'Small' }).className).toContain(
        'data-[state=on]:bg-[hsl(var(--primary))]',
      );
    });

    it('accent item uses the --accent-color active class', () => {
      // #when
      renderGroup({ type: 'single', value: 's', variant: 'accent' });

      // #then
      expect(screen.getByRole('radio', { name: 'Small' }).className).toContain(
        'data-[state=on]:bg-[var(--accent-color)]',
      );
    });
  });

  describe('style escape hatches', () => {
    it('rootStyle applies as inline style on the root', () => {
      // #when
      renderGroup({ type: 'single', rootStyle: { gap: '12px' } });

      // #then
      expect(screen.getByRole('group', { name: 'Sizes' })).toHaveStyle({ gap: '12px' });
    });

    it('group itemStyle applies as inline style on each item', () => {
      // #when
      renderGroup({ type: 'single', itemStyle: { minWidth: '90px' } });

      // #then
      expect(screen.getByRole('radio', { name: 'Small' })).toHaveStyle({
        minWidth: '90px',
      });
    });
  });
});
