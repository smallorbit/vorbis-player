import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';

function renderTabs(options?: { defaultValue?: string }) {
  const { defaultValue = 'tab1' } = options ?? {};
  return render(
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="tab1">Tab One</TabsTrigger>
        <TabsTrigger value="tab2">Tab Two</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content One</TabsContent>
      <TabsContent value="tab2">Content Two</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  describe('default render', () => {
    it('renders the active tab trigger with data-state="active"', () => {
      // #when
      renderTabs();

      // #then
      expect(screen.getByRole('tab', { name: /Tab One/i })).toHaveAttribute(
        'data-state',
        'active',
      );
    });

    it('renders inactive tab trigger with data-state="inactive"', () => {
      // #when
      renderTabs();

      // #then
      expect(screen.getByRole('tab', { name: /Tab Two/i })).toHaveAttribute(
        'data-state',
        'inactive',
      );
    });

    it('shows the active tab panel content', () => {
      // #when
      renderTabs();

      // #then
      expect(screen.getByText('Content One')).toBeInTheDocument();
    });

    it('does not show inactive tab panel content', () => {
      // #when
      renderTabs();

      // #then
      expect(screen.queryByText('Content Two')).not.toBeInTheDocument();
    });

    it('TabsList has tablist role', () => {
      // #when
      renderTabs();

      // #then
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('clicking a different tab activates it', async () => {
      // #given
      const user = userEvent.setup();
      renderTabs();

      // #when
      await user.click(screen.getByRole('tab', { name: /Tab Two/i }));

      // #then
      expect(screen.getByRole('tab', { name: /Tab Two/i })).toHaveAttribute(
        'data-state',
        'active',
      );
    });

    it('clicking a different tab shows its content', async () => {
      // #given
      const user = userEvent.setup();
      renderTabs();

      // #when
      await user.click(screen.getByRole('tab', { name: /Tab Two/i }));

      // #then
      expect(screen.getByText('Content Two')).toBeInTheDocument();
    });

    it('clicking a different tab hides the previously active content', async () => {
      // #given
      const user = userEvent.setup();
      renderTabs();

      // #when
      await user.click(screen.getByRole('tab', { name: /Tab Two/i }));

      // #then
      expect(screen.queryByText('Content One')).not.toBeInTheDocument();
    });
  });

  describe('motion-reduce variant', () => {
    it('trigger className includes motion-reduce:transition-none', () => {
      // #when
      renderTabs();
      const trigger = screen.getByRole('tab', { name: /Tab One/i });

      // #then
      expect(trigger.className).toContain('motion-reduce:transition-none');
    });
  });

  describe('per-part style escape hatches', () => {
    it('listStyle applies as inline style on the TabsList element', () => {
      // #when
      render(
        <Tabs defaultValue="a">
          <TabsList listStyle={{ gap: '12px' }}>
            <TabsTrigger value="a">A</TabsTrigger>
          </TabsList>
          <TabsContent value="a">A content</TabsContent>
        </Tabs>,
      );

      // #then
      expect(screen.getByRole('tablist')).toHaveStyle({ gap: '12px' });
    });

    it('triggerStyle applies as inline style on the TabsTrigger element', () => {
      // #when
      render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a" triggerStyle={{ fontSize: '16px' }}>
              A
            </TabsTrigger>
          </TabsList>
          <TabsContent value="a">A content</TabsContent>
        </Tabs>,
      );

      // #then
      expect(screen.getByRole('tab', { name: /A/i })).toHaveStyle({ fontSize: '16px' });
    });

    it('contentStyle applies as inline style on the TabsContent element', () => {
      // #when
      const { container } = render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
          </TabsList>
          <TabsContent value="a" contentStyle={{ padding: '24px' }}>
            A content
          </TabsContent>
        </Tabs>,
      );
      const panel = container.querySelector('[role="tabpanel"]');

      // #then
      expect(panel).toHaveStyle({ padding: '24px' });
    });
  });
});
