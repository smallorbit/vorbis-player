/**
 * Tests for Section — the shared shell component for every library section.
 * Section is a pure rendering component (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Section from '../Section';

describe('Section', () => {
  it('returns null when hidden', () => {
    // #given + #when
    const { container } = render(
      <Section id="pinned" title="Pinned" layout="row" hidden>
        <div>content</div>
      </Section>
    );

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with correct data-testid', () => {
    // #given + #when
    render(
      <Section id="playlists" title="Playlists" layout="row">
        <div />
      </Section>
    );

    // #then
    expect(screen.getByTestId('library-section-playlists')).toBeInTheDocument();
  });

  it('renders section title', () => {
    // #given + #when
    render(
      <Section id="albums" title="Albums" layout="row">
        <div />
      </Section>
    );

    // #then
    expect(screen.getByText('Albums')).toBeInTheDocument();
  });

  it('renders See all button when onSeeAll is provided', () => {
    // #given + #when
    render(
      <Section id="pinned" title="Pinned" layout="row" onSeeAll={vi.fn()}>
        <div />
      </Section>
    );

    // #then
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
  });

  it('does not render See all button when onSeeAll is absent', () => {
    // #given + #when
    render(
      <Section id="pinned" title="Pinned" layout="row">
        <div />
      </Section>
    );

    // #then
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('fires onSeeAll when See all button is clicked', () => {
    // #given
    const onSeeAll = vi.fn();
    render(
      <Section id="pinned" title="Pinned" layout="row" onSeeAll={onSeeAll}>
        <div />
      </Section>
    );

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));

    // #then
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('renders children', () => {
    // #given + #when
    render(
      <Section id="test" title="Test" layout="row">
        <div data-testid="test-child" />
      </Section>
    );

    // #then
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });
});
