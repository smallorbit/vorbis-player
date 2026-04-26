import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../accordion';

function renderAccordion(options?: {
  title?: string;
  content?: string;
  defaultValue?: string;
}) {
  const { title = 'Section Title', content = 'Section content body', defaultValue } = options ?? {};
  return render(
    <Accordion type="single" collapsible defaultValue={defaultValue}>
      <AccordionItem value="item1">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{content}</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

describe('Accordion', () => {
  describe('initial closed state', () => {
    it('trigger has aria-expanded="false" when closed', () => {
      // #when
      renderAccordion();

      // #then
      expect(screen.getByRole('button', { name: /Section Title/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('content is not in the DOM when closed', () => {
      // #when
      renderAccordion();

      // #then
      expect(screen.queryByText('Section content body')).not.toBeInTheDocument();
    });
  });

  describe('open state', () => {
    it('trigger has aria-expanded="true" after click', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();

      // #when
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #then
      expect(screen.getByRole('button', { name: /Section Title/i })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('content enters the DOM after clicking the trigger', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();

      // #when
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #then
      expect(screen.getByText('Section content body')).toBeInTheDocument();
    });

    it('content is removed again after a second click (collapsible)', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #when
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #then
      expect(screen.queryByText('Section content body')).not.toBeInTheDocument();
    });

    it('opens on mount when defaultValue matches item value', () => {
      // #when
      renderAccordion({ defaultValue: 'item1' });

      // #then
      expect(screen.getByText('Section content body')).toBeInTheDocument();
    });
  });

  describe('ARIA', () => {
    it('trigger resolves via getByRole("button") with its label text', () => {
      // #when
      renderAccordion({ title: 'My Section' });

      // #then
      expect(screen.getByRole('button', { name: /My Section/i })).toBeInTheDocument();
    });

    it('open content has role="region"', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();

      // #when
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #then
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('trigger is nested inside an h3 element (AccordionPrimitive.Header)', () => {
      // #when
      renderAccordion();
      const trigger = screen.getByRole('button', { name: /Section Title/i });

      // #then
      expect(trigger.closest('h3')).not.toBeNull();
    });
  });

  describe('chevron SVG', () => {
    it('trigger contains a chevron SVG with aria-hidden', () => {
      // #when
      renderAccordion();
      const svg = screen.getByRole('button', { name: /Section Title/i }).querySelector('svg');

      // #then
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('trigger className includes rotate-180 open-state class for the chevron', () => {
      // #when
      renderAccordion();
      const trigger = screen.getByRole('button', { name: /Section Title/i });

      // #then
      expect(trigger.className).toContain('[&[data-state=open]>svg]:rotate-180');
    });

    it('trigger className includes motion-reduce svg transition override', () => {
      // #when
      renderAccordion();
      const trigger = screen.getByRole('button', { name: /Section Title/i });

      // #then
      expect(trigger.className).toContain('motion-reduce:[&>svg]:transition-none');
    });
  });

  describe('animation classes', () => {
    it('content element has accordion-down and accordion-up animation classes', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();
      await user.click(screen.getByRole('button', { name: /Section Title/i }));

      // #when
      const contentEl = screen.getByRole('region');

      // #then
      expect(contentEl.className).toContain('data-[state=open]:animate-accordion-down');
      expect(contentEl.className).toContain('data-[state=closed]:animate-accordion-up');
    });

    it('content element has motion-reduce animation overrides', async () => {
      // #given
      const user = userEvent.setup();
      renderAccordion();
      await user.click(screen.getByRole('button', { name: /Section Title/i }));
      const contentEl = screen.getByRole('region');

      // #then
      expect(contentEl.className).toContain('motion-reduce:data-[state=open]:animate-none');
      expect(contentEl.className).toContain('motion-reduce:data-[state=closed]:animate-none');
    });
  });

  describe('multiple independent Accordion roots', () => {
    it('opening one accordion does not close the other (separate Roots)', async () => {
      // #given
      const user = userEvent.setup();
      render(
        <>
          <Accordion type="single" collapsible>
            <AccordionItem value="a">
              <AccordionTrigger>First</AccordionTrigger>
              <AccordionContent>First content</AccordionContent>
            </AccordionItem>
          </Accordion>
          <Accordion type="single" collapsible>
            <AccordionItem value="b">
              <AccordionTrigger>Second</AccordionTrigger>
              <AccordionContent>Second content</AccordionContent>
            </AccordionItem>
          </Accordion>
        </>,
      );

      // #when
      await user.click(screen.getByRole('button', { name: /First/i }));
      await user.click(screen.getByRole('button', { name: /Second/i }));

      // #then
      expect(screen.getByText('First content')).toBeInTheDocument();
      expect(screen.getByText('Second content')).toBeInTheDocument();
    });
  });
});
