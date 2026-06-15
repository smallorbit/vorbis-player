import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import AlbumArt from '../AlbumArt';
import { makeTrack } from '@/test/fixtures';

vi.mock('@/hooks/useImageProcessingWorker', () => ({
  useImageProcessingWorker: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({ isMobile: false, isTablet: false })),
}));

import { useImageProcessingWorker } from '@/hooks/useImageProcessingWorker';

const mockUseImageProcessingWorker = vi.mocked(useImageProcessingWorker);

function makeFakeImageData() {
  return { data: new Uint8ClampedArray(4), width: 1, height: 1 } as unknown as ImageData;
}

function makeMockCanvas(toDataURL = vi.fn(() => 'data:image/png;base64,mock')) {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => makeFakeImageData()),
    putImageData: vi.fn(),
  };
  return {
    canvas: {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toDataURL,
    } as unknown as HTMLCanvasElement,
    ctx,
    toDataURL,
  };
}

function renderAlbumArt(props: React.ComponentProps<typeof AlbumArt>) {
  return render(
    <ThemeProvider theme={theme}>
      <AlbumArt {...props} />
    </ThemeProvider>
  );
}

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AlbumArt', () => {
  describe('cancellation of stale image-load/worker writes', () => {
    it('does not write to canvas when effect is cancelled before processImage resolves', async () => {
      // #given — processImage for track A hangs; track B never fires onload
      let resolveFirst!: (data: ImageData) => void;
      const firstProcessImage = new Promise<ImageData>((resolve) => {
        resolveFirst = resolve;
      });
      const processImageMock = vi.fn().mockReturnValueOnce(firstProcessImage);
      mockUseImageProcessingWorker.mockReturnValue({
        processImage: processImageMock,
        isProcessing: false,
      });

      const { toDataURL } = makeMockCanvas();
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return makeMockCanvas(toDataURL).canvas;
        return originalCreateElement(tag);
      });

      const trackA = makeTrack({ id: 'a', image: 'http://example.com/a.jpg' });
      const trackB = makeTrack({ id: 'b', image: 'http://example.com/b.jpg' });

      let imgAOnload: (() => void) | null = null;
      vi.spyOn(window, 'Image').mockImplementation(() => {
        const img = { crossOrigin: '', src: '', onerror: null as (() => void) | null };
        Object.defineProperty(img, 'onload', {
          set(fn: (() => void) | null) { imgAOnload = fn; },
          get() { return imgAOnload; },
          configurable: true,
        });
        return img as unknown as HTMLImageElement;
      });

      const { rerender } = renderAlbumArt({ currentTrack: trackA, accentColor: '#1db954' });

      // #when — track A's image fires onload (starts the async worker call)
      act(() => { imgAOnload?.(); });

      // #when — track changes before worker resolves (cancels track A's effect)
      processImageMock.mockReturnValueOnce(new Promise<ImageData>(() => {}));
      rerender(
        <ThemeProvider theme={theme}>
          <AlbumArt currentTrack={trackB} accentColor="#1db954" />
        </ThemeProvider>
      );

      // #when — stale track A worker finally resolves after cancellation
      await act(async () => { resolveFirst(makeFakeImageData()); });

      // #then — canvas write was suppressed for the cancelled effect
      expect(toDataURL).not.toHaveBeenCalled();
    });

    it('only writes canvas for the winning track when two workers race', async () => {
      // #given — track A resolves after track B
      let resolveFirst!: (data: ImageData) => void;
      let resolveSecond!: (data: ImageData) => void;

      const firstProcessImage = new Promise<ImageData>((resolve) => { resolveFirst = resolve; });
      const secondProcessImage = new Promise<ImageData>((resolve) => { resolveSecond = resolve; });

      const processImageMock = vi.fn()
        .mockReturnValueOnce(firstProcessImage)
        .mockReturnValueOnce(secondProcessImage);

      mockUseImageProcessingWorker.mockReturnValue({
        processImage: processImageMock,
        isProcessing: false,
      });

      const toDataURLA = vi.fn(() => 'data:image/png;base64,track-a');
      const toDataURLB = vi.fn(() => 'data:image/png;base64,track-b');
      const canvases = [makeMockCanvas(toDataURLA).canvas, makeMockCanvas(toDataURLB).canvas];
      let canvasIndex = 0;
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return canvases[canvasIndex++] as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const trackA = makeTrack({ id: 'a', image: 'http://example.com/a.jpg' });
      const trackB = makeTrack({ id: 'b', image: 'http://example.com/b.jpg' });

      const loadHandlers: Array<() => void> = [];
      vi.spyOn(window, 'Image').mockImplementation(() => {
        let handler: (() => void) | null = null;
        const img = { crossOrigin: '', src: '', onerror: null as (() => void) | null };
        Object.defineProperty(img, 'onload', {
          set(fn: (() => void) | null) { handler = fn; },
          get() { return handler; },
          configurable: true,
        });
        loadHandlers.push(() => handler?.());
        return img as unknown as HTMLImageElement;
      });

      const { rerender } = renderAlbumArt({ currentTrack: trackA, accentColor: '#1db954' });

      // #when — track A image loads
      act(() => { loadHandlers[0]?.(); });

      // #when — switch to track B before A resolves
      rerender(
        <ThemeProvider theme={theme}>
          <AlbumArt currentTrack={trackB} accentColor="#1db954" />
        </ThemeProvider>
      );

      // #when — track B image loads
      act(() => { loadHandlers[1]?.(); });

      // #when — track B (the active one) resolves first
      await act(async () => { resolveSecond(makeFakeImageData()); });

      // #when — stale track A resolves after
      await act(async () => { resolveFirst(makeFakeImageData()); });

      // #then — only track B's canvas was written; track A's was suppressed
      expect(toDataURLB).toHaveBeenCalledOnce();
      expect(toDataURLA).not.toHaveBeenCalled();
    });

    it('clears isProcessing via cleanup when a track changes mid-load', async () => {
      // #given — track A starts loading but never resolves
      const processImageMock = vi.fn().mockReturnValue(new Promise<ImageData>(() => {}));
      mockUseImageProcessingWorker.mockReturnValue({
        processImage: processImageMock,
        isProcessing: false,
      });

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return makeMockCanvas().canvas;
        return originalCreateElement(tag);
      });

      const trackA = makeTrack({ id: 'a', image: 'http://example.com/a.jpg' });
      const trackB = makeTrack({ id: 'b' });

      let imgOnload: (() => void) | null = null;
      vi.spyOn(window, 'Image').mockImplementation(() => {
        const img = { crossOrigin: '', src: '', onerror: null as (() => void) | null };
        Object.defineProperty(img, 'onload', {
          set(fn: (() => void) | null) { imgOnload = fn; },
          get() { return imgOnload; },
          configurable: true,
        });
        return img as unknown as HTMLImageElement;
      });

      const { rerender } = renderAlbumArt({ currentTrack: trackA, accentColor: '#1db954' });

      // trigger load so setIsProcessing(true) is called
      act(() => { imgOnload?.(); });

      // #when — switch to a track with no image (cleanup runs, cancelled = true, setIsProcessing(false))
      rerender(
        <ThemeProvider theme={theme}>
          <AlbumArt currentTrack={trackB} accentColor="#1db954" />
        </ThemeProvider>
      );

      // #then — no processing spinner visible after track change
      await waitFor(() => {
        const spinners = document.querySelectorAll('[class*="ProcessingSpinner"]');
        expect(spinners.length).toBe(0);
      });
    });
  });
});
