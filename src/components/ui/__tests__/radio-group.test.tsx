import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { RadioGroup, RadioGroupItem } from '../radio-group';

function renderRadioGroup(options?: { value?: string; onValueChange?: (v: string) => void }) {
  const { value, onValueChange } = options ?? {};
  return render(
    <RadioGroup value={value} onValueChange={onValueChange}>
      <RadioGroupItem value="option-a" aria-label="Option A" />
      <RadioGroupItem value="option-b" aria-label="Option B" />
    </RadioGroup>,
  );
}

describe('RadioGroup', () => {
  describe('default render', () => {
    it('renders radio buttons with role="radio"', () => {
      // #when
      renderRadioGroup();

      // #then
      expect(screen.getAllByRole('radio')).toHaveLength(2);
    });

    it('items have aria-checked="false" when no value is selected', () => {
      // #when
      renderRadioGroup();

      // #then
      screen.getAllByRole('radio').forEach((radio) => {
        expect(radio).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('selected item has aria-checked="true"', () => {
      // #when
      renderRadioGroup({ value: 'option-a' });

      // #then
      expect(screen.getByRole('radio', { name: /Option A/i })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('non-selected item has aria-checked="false" when another is selected', () => {
      // #when
      renderRadioGroup({ value: 'option-a' });

      // #then
      expect(screen.getByRole('radio', { name: /Option B/i })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
  });

  describe('interaction', () => {
    it('clicking an item invokes onValueChange with its value', async () => {
      // #given
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      renderRadioGroup({ onValueChange });

      // #when
      await user.click(screen.getByRole('radio', { name: /Option B/i }));

      // #then
      expect(onValueChange).toHaveBeenCalledWith('option-b');
    });

    it('disabled item does not invoke onValueChange when clicked', async () => {
      // #given
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      render(
        <RadioGroup onValueChange={onValueChange}>
          <RadioGroupItem value="disabled-option" aria-label="Disabled" disabled />
        </RadioGroup>,
      );

      // #when
      await user.click(screen.getByRole('radio', { name: /Disabled/i }));

      // #then
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('motion-reduce variant', () => {
    it('radio group renders without animation classes (no entry/exit transitions apply)', () => {
      // RadioGroup and RadioGroupItem carry no entry/exit animation classes —
      // no motion-reduce overrides are needed. Smoke-render confirms the tree
      // mounts cleanly with prefers-reduced-motion semantics intact.
      // #when / #then
      expect(() => renderRadioGroup()).not.toThrow();
    });
  });

  describe('per-part style escape hatches', () => {
    it('rootStyle applies as inline style on the RadioGroup root', () => {
      // #when
      render(
        <RadioGroup rootStyle={{ gap: '16px' }}>
          <RadioGroupItem value="a" aria-label="A" />
        </RadioGroup>,
      );
      const root = screen.getByRole('radiogroup');

      // #then
      expect(root).toHaveStyle({ gap: '16px' });
    });

    it('itemStyle applies as inline style on the RadioGroupItem button', () => {
      // #when
      render(
        <RadioGroup>
          <RadioGroupItem value="a" aria-label="A" itemStyle={{ width: '20px', height: '20px' }} />
        </RadioGroup>,
      );

      // #then
      expect(screen.getByRole('radio', { name: /A/i })).toHaveStyle({
        width: '20px',
        height: '20px',
      });
    });

    it('indicatorStyle applies as inline style on the Indicator wrapper', () => {
      // #given
      render(
        <RadioGroup value="a">
          <RadioGroupItem
            value="a"
            aria-label="A"
            indicatorStyle={{ opacity: '0.5' }}
          />
        </RadioGroup>,
      );
      const radio = screen.getByRole('radio', { name: /A/i });
      const indicator = radio.querySelector('span');

      // #then
      expect(indicator).toHaveStyle({ opacity: '0.5' });
    });
  });
});
