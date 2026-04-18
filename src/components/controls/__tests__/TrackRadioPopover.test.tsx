import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import {
  TrackRadioPopover,
  truncateTrackName,
} from '../TrackRadioPopover';

function makeAnchorRect(overrides: Partial<DOMRect> = {}): DOMRect {
  const base = {
    x: 100,
    y: 200,
    left: 100,
    top: 200,
    right: 140,
    bottom: 220,
    width: 40,
    height: 20,
    toJSON: () => ({}),
  };
  return { ...base, ...overrides } as DOMRect;
}

interface RenderOverrides {
  trackName?: string;
  anchorRect?: DOMRect | null;
  onClose?: () => void;
  onPlayRadio?: () => void;
  isAvailable?: boolean;
  disabledReason?: string;
}

function renderPopover(overrides: RenderOverrides = {}) {
  const props = {
    trackName: overrides.trackName ?? 'Dreams',
    anchorRect:
      overrides.anchorRect === undefined ? makeAnchorRect() : overrides.anchorRect,
    onClose: overrides.onClose ?? vi.fn(),
    onPlayRadio: overrides.onPlayRadio ?? vi.fn(),
    isAvailable: overrides.isAvailable,
    disabledReason: overrides.disabledReason,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <TrackRadioPopover {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('truncateTrackName', () => {
  it('returns the input unchanged when below the default limit', () => {
    // #given
    const name = 'Short Track';

    // #when
    const result = truncateTrackName(name);

    // #then
    expect(result).toBe('Short Track');
  });

  it('returns the input unchanged when exactly at the default limit', () => {
    // #given
    const name = 'a'.repeat(32);

    // #when
    const result = truncateTrackName(name);

    // #then
    expect(result).toBe(name);
    expect(result).toHaveLength(32);
  });

  it('truncates with an ellipsis when longer than the default limit', () => {
    // #given
    const name = 'a'.repeat(33);

    // #when
    const result = truncateTrackName(name);

    // #then
    expect(result).toBe(`${'a'.repeat(32)}…`);
    expect(result.endsWith('…')).toBe(true);
  });

  it('respects a custom maxLen', () => {
    // #given
    const name = 'abcdefghij';

    // #when
    const result = truncateTrackName(name, 5);

    // #then
    expect(result).toBe('abcde…');
  });

  it('strips trailing whitespace before the ellipsis', () => {
    // #given
    const name = 'hello world more text here';

    // #when
    const result = truncateTrackName(name, 6);

    // #then
    expect(result).toBe('hello…');
    expect(result).not.toContain(' …');
  });

  it('returns an empty string when given an empty string', () => {
    // #when
    const result = truncateTrackName('');

    // #then
    expect(result).toBe('');
  });

  it('returns an empty string when maxLen is zero or negative', () => {
    // #when / #then
    expect(truncateTrackName('anything', 0)).toBe('');
    expect(truncateTrackName('anything', -1)).toBe('');
  });
});

describe('TrackRadioPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Play {trackName} Radio" option when available', () => {
    // #when
    renderPopover({ trackName: 'Dreams' });

    // #then
    expect(screen.getByText('Play Dreams Radio')).toBeInTheDocument();
  });

  it('renders the option when isAvailable is omitted (defaults to true)', () => {
    // #when
    renderPopover({ trackName: 'Dreams', isAvailable: undefined });

    // #then
    const button = screen.getByRole('button', { name: /Play Dreams Radio/ });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('truncates long track names in the visible label', () => {
    // #given
    const longName = 'A'.repeat(40);

    // #when
    renderPopover({ trackName: longName });

    // #then
    const truncated = `${'A'.repeat(32)}…`;
    expect(screen.getByText(`Play ${truncated} Radio`)).toBeInTheDocument();
  });

  it('preserves the full track name in the title attribute when available', () => {
    // #given
    const longName = 'A'.repeat(40);

    // #when
    renderPopover({ trackName: longName });

    // #then
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', longName);
  });

  it('fires onPlayRadio and onClose when the option is clicked', () => {
    // #given
    const onPlayRadio = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onPlayRadio, onClose });

    // #when
    fireEvent.click(screen.getByRole('button', { name: /Play .* Radio/ }));

    // #then
    expect(onPlayRadio).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not fire onPlayRadio when isAvailable is false', () => {
    // #given
    const onPlayRadio = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onPlayRadio, onClose, isAvailable: false });

    // #when
    fireEvent.click(screen.getByRole('button', { name: /Play .* Radio/ }));

    // #then
    expect(onPlayRadio).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('marks the option as aria-disabled when isAvailable is false', () => {
    // #when
    renderPopover({ isAvailable: false });

    // #then
    const button = screen.getByRole('button', { name: /Play .* Radio/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('surfaces the default disabled reason via the title attribute when disabled', () => {
    // #when
    renderPopover({ isAvailable: false });

    // #then
    const button = screen.getByRole('button', { name: /Play .* Radio/ });
    expect(button).toHaveAttribute(
      'title',
      'Radio is unavailable. Configure VITE_LASTFM_API_KEY.',
    );
  });

  it('surfaces a custom disabledReason via the title attribute when disabled', () => {
    // #given
    const disabledReason = 'Please sign in to use radio.';

    // #when
    renderPopover({ isAvailable: false, disabledReason });

    // #then
    const button = screen.getByRole('button', { name: /Play .* Radio/ });
    expect(button).toHaveAttribute('title', disabledReason);
  });

  it('renders nothing when anchorRect is null', () => {
    // #when
    const { container } = renderPopover({ anchorRect: null });

    // #then
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /Play .* Radio/ })).toBeNull();
  });

  it('closes when the Escape key is pressed', () => {
    // #given
    const onClose = vi.fn();
    renderPopover({ onClose });

    // #when
    fireEvent.keyDown(document, { key: 'Escape' });

    // #then
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close on unrelated keydown events', () => {
    // #given
    const onClose = vi.fn();
    renderPopover({ onClose });

    // #when
    fireEvent.keyDown(document, { key: 'Enter' });

    // #then
    expect(onClose).not.toHaveBeenCalled();
  });
});
