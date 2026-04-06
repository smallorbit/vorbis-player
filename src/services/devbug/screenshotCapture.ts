import createDebug from 'debug';
import type { BoundingRect } from '@/types/devbug';

const log = createDebug('vorbis:devbug');

const HIGHLIGHT_STROKE = 'rgba(255, 165, 0, 1)';
const HIGHLIGHT_FILL = 'rgba(255, 165, 0, 0.3)';
const HIGHLIGHT_LINE_WIDTH = 2;

async function loadHtml2canvas(): Promise<typeof import('html2canvas').default> {
  const mod = await import('html2canvas');
  return mod.default;
}

export async function captureViewport(): Promise<HTMLCanvasElement> {
  const html2canvas = await loadHtml2canvas();
  const dpr = window.devicePixelRatio || 1;

  log('capturing viewport at dpr=%f', dpr);

  const canvas = await html2canvas(document.body, {
    scale: dpr,
    useCORS: true,
    allowTaint: true,
    logging: false,
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    x: window.scrollX,
    y: window.scrollY,
  });

  return canvas;
}

export async function captureScreenshot(highlightRect?: BoundingRect): Promise<string> {
  const canvas = await captureViewport();

  if (highlightRect) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const x = highlightRect.x * dpr;
      const y = highlightRect.y * dpr;
      const width = highlightRect.width * dpr;
      const height = highlightRect.height * dpr;

      ctx.save();
      ctx.strokeStyle = HIGHLIGHT_STROKE;
      ctx.fillStyle = HIGHLIGHT_FILL;
      ctx.lineWidth = HIGHLIGHT_LINE_WIDTH * dpr;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();

      log('drew highlight rect at x=%f y=%f w=%f h=%f (dpr=%f)', x, y, width, height, dpr);
    }
  }

  return canvas.toDataURL('image/png');
}
