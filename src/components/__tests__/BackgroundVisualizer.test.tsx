import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import BackgroundVisualizer from '../BackgroundVisualizer';

const baseProps = {
  enabled: true,
  style: 'fireflies' as const,
  intensity: 50,
  accentColor: '#336699',
  isPlaying: true,
};

const makeMatchMedia = (reducedMotion: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

describe('BackgroundVisualizer', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: makeMatchMedia(false),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a canvas when enabled and motion is allowed', () => {
    // #when
    render(<BackgroundVisualizer {...baseProps} />);

    // #then
    expect(document.querySelector('canvas')).toBeInTheDocument();
    expect(document.querySelector('canvas')).toHaveAttribute('aria-hidden');
  });

  it('renders nothing when disabled', () => {
    // #when
    render(<BackgroundVisualizer {...baseProps} enabled={false} />);

    // #then
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('renders nothing when prefers-reduced-motion: reduce is active', () => {
    // #given
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: makeMatchMedia(true),
    });

    // #when
    render(<BackgroundVisualizer {...baseProps} />);

    // #then
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('does not start requestAnimationFrame when prefers-reduced-motion is reduce', () => {
    // #given
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: makeMatchMedia(true),
    });
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    // #when
    render(<BackgroundVisualizer {...baseProps} />);

    // #then — visualizer subtree never mounts, so the canvas loop never starts
    expect(raf).not.toHaveBeenCalled();
  });
});
