import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BoundingRect } from '@/types/devbug';

const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
const mockFillRect = vi.fn();
const mockStrokeRect = vi.fn();
const mockSave = vi.fn();
const mockRestore = vi.fn();

const mockCtx = {
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  fillRect: mockFillRect,
  strokeRect: mockStrokeRect,
  save: mockSave,
  restore: mockRestore,
};

const mockCanvas = {
  toDataURL: mockToDataURL,
  getContext: vi.fn().mockReturnValue(mockCtx),
};

const mockHtml2canvas = vi.fn().mockResolvedValue(mockCanvas);

vi.mock('html2canvas', () => ({
  default: (...args: unknown[]) => mockHtml2canvas(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockHtml2canvas.mockResolvedValue(mockCanvas);
  mockCanvas.getContext.mockReturnValue(mockCtx);
  mockToDataURL.mockReturnValue('data:image/png;base64,mock');
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
  Object.defineProperty(window, 'scrollX', { value: 0, configurable: true, writable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

describe('captureViewport', () => {
  it('lazy-loads html2canvas on first call', async () => {
    // #when
    const { captureViewport } = await import('../screenshotCapture');
    await captureViewport();

    // #then
    expect(mockHtml2canvas).toHaveBeenCalledOnce();
  });

  it('passes viewport dimensions and scroll position to html2canvas', async () => {
    // #given
    Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true, writable: true });
    Object.defineProperty(window, 'scrollX', { value: 100, configurable: true, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 50, configurable: true, writable: true });

    // #when
    const { captureViewport } = await import('../screenshotCapture');
    await captureViewport();

    // #then
    expect(mockHtml2canvas).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        width: 1440,
        height: 900,
        windowWidth: 1440,
        windowHeight: 900,
        x: 100,
        y: 50,
      })
    );
  });

  it('sets scale to device pixel ratio', async () => {
    // #given
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true, writable: true });

    // #when
    const { captureViewport } = await import('../screenshotCapture');
    await captureViewport();

    // #then
    expect(mockHtml2canvas).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({ scale: 2 })
    );
  });

  it('returns the canvas produced by html2canvas', async () => {
    // #when
    const { captureViewport } = await import('../screenshotCapture');
    const result = await captureViewport();

    // #then
    expect(result).toBe(mockCanvas);
  });
});

describe('captureScreenshot', () => {
  it('returns a PNG data URL', async () => {
    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    const result = await captureScreenshot();

    // #then
    expect(result).toBe('data:image/png;base64,mock');
    expect(mockToDataURL).toHaveBeenCalledWith('image/png');
  });

  it('does not draw highlight when no rect is provided', async () => {
    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot();

    // #then
    expect(mockFillRect).not.toHaveBeenCalled();
    expect(mockStrokeRect).not.toHaveBeenCalled();
  });

  it('draws highlight rect at provided bounding rect coordinates', async () => {
    // #given
    const rect: BoundingRect = { x: 10, y: 20, width: 100, height: 50, top: 20, right: 110, bottom: 70, left: 10 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot(rect);

    // #then
    expect(mockFillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    expect(mockStrokeRect).toHaveBeenCalledWith(10, 20, 100, 50);
  });

  it('scales highlight coordinates by device pixel ratio', async () => {
    // #given
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
    const rect: BoundingRect = { x: 10, y: 20, width: 100, height: 50, top: 20, right: 110, bottom: 70, left: 10 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot(rect);

    // #then
    expect(mockFillRect).toHaveBeenCalledWith(20, 40, 200, 100);
    expect(mockStrokeRect).toHaveBeenCalledWith(20, 40, 200, 100);
  });

  it('uses orange stroke and semi-transparent orange fill for highlight', async () => {
    // #given
    const rect: BoundingRect = { x: 0, y: 0, width: 50, height: 50, top: 0, right: 50, bottom: 50, left: 0 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot(rect);

    // #then
    expect(mockCtx.strokeStyle).toBe('rgba(255, 165, 0, 1)');
    expect(mockCtx.fillStyle).toBe('rgba(255, 165, 0, 0.3)');
  });

  it('saves and restores canvas context state when drawing highlight', async () => {
    // #given
    const rect: BoundingRect = { x: 0, y: 0, width: 50, height: 50, top: 0, right: 50, bottom: 50, left: 0 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot(rect);

    // #then
    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockRestore).toHaveBeenCalledOnce();
  });

  it('skips highlight drawing when canvas context is unavailable', async () => {
    // #given
    mockCanvas.getContext.mockReturnValueOnce(null);
    const rect: BoundingRect = { x: 0, y: 0, width: 50, height: 50, top: 0, right: 50, bottom: 50, left: 0 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    const result = await captureScreenshot(rect);

    // #then
    expect(result).toBe('data:image/png;base64,mock');
    expect(mockFillRect).not.toHaveBeenCalled();
  });

  it('falls back to dpr=1 when devicePixelRatio is not set', async () => {
    // #given
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true, writable: true });
    const rect: BoundingRect = { x: 5, y: 5, width: 10, height: 10, top: 5, right: 15, bottom: 15, left: 5 };

    // #when
    const { captureScreenshot } = await import('../screenshotCapture');
    await captureScreenshot(rect);

    // #then
    expect(mockFillRect).toHaveBeenCalledWith(5, 5, 10, 10);
  });
});
