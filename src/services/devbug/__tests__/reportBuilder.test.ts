import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildBugReport, collectBrowserInfo, extractElementInfo, getReactComponentName } from '../reportBuilder';
import type { SelectedElement } from '@/types/devbug';

const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FIXED_ISO = '2026-04-06T12:00:00.000Z';

beforeEach(() => {
  Object.defineProperty(global.crypto, 'randomUUID', {
    value: vi.fn().mockReturnValue(FIXED_UUID),
    writable: true,
    configurable: true,
  });
  vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(FIXED_ISO);
});

const makeSelectedElement = (overrides: Partial<SelectedElement> = {}): SelectedElement => ({
  cssSelector: 'div',
  xpath: '/div',
  reactComponentName: null,
  boundingRect: { top: 0, right: 100, bottom: 50, left: 0, width: 100, height: 50, x: 0, y: 0 },
  computedStyles: {},
  textContent: '',
  ...overrides,
});

describe('buildBugReport', () => {
  it('auto-populates id with a UUID', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.id).toBe(FIXED_UUID);
    expect(crypto.randomUUID as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it('auto-populates timestamp as ISO 8601', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.timestamp).toBe(FIXED_ISO);
  });

  it('auto-populates browserInfo', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.browserInfo).toBeDefined();
    expect(typeof report.browserInfo.userAgent).toBe('string');
    expect(report.browserInfo.viewport).toHaveProperty('width');
    expect(report.browserInfo.viewport).toHaveProperty('height');
    expect(report.browserInfo.url).toBeDefined();
    expect(report.browserInfo.timestamp).toBe(FIXED_ISO);
  });

  it('passes through selectionMode', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'area', elements: [] });

    // #then
    expect(report.selectionMode).toBe('area');
  });

  it('passes through elements array', () => {
    // #given
    const elements = [makeSelectedElement({ cssSelector: '#my-el' })];

    // #when
    const report = buildBugReport({ selectionMode: 'click', elements });

    // #then
    expect(report.elements).toHaveLength(1);
    expect(report.elements[0].cssSelector).toBe('#my-el');
  });

  it('defaults screenshotDataUrl to empty string when not provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.screenshotDataUrl).toBe('');
  });

  it('passes through screenshotDataUrl when provided', () => {
    // #given
    const dataUrl = 'data:image/png;base64,abc123';

    // #when
    const report = buildBugReport({ selectionMode: 'screenshot', elements: [], screenshotDataUrl: dataUrl });

    // #then
    expect(report.screenshotDataUrl).toBe(dataUrl);
  });

  it('defaults comment to empty string when not provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.comment).toBe('');
  });

  it('passes through comment when provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [], comment: 'Something is broken' });

    // #then
    expect(report.comment).toBe('Something is broken');
  });

  it('defaults categories to empty array when not provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.categories).toEqual([]);
  });

  it('passes through categories when provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [], categories: ['broken', 'slower'] });

    // #then
    expect(report.categories).toEqual(['broken', 'slower']);
  });

  it('defaults consoleLogs to empty array when not provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.consoleLogs).toEqual([]);
  });

  it('passes through consoleLogs when provided', () => {
    // #given
    const logs = [{ timestamp: FIXED_ISO, level: 'error' as const, args: ['Something failed'], stack: null }];

    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [], consoleLogs: logs });

    // #then
    expect(report.consoleLogs).toHaveLength(1);
    expect(report.consoleLogs[0].level).toBe('error');
  });

  it('defaults performanceMetrics with null values when not provided', () => {
    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [] });

    // #then
    expect(report.performanceMetrics.fcp).toBeNull();
    expect(report.performanceMetrics.lcp).toBeNull();
    expect(report.performanceMetrics.memoryUsed).toBeNull();
    expect(report.performanceMetrics.memoryTotal).toBeNull();
    expect(report.performanceMetrics.longTasks).toEqual([]);
  });

  it('passes through performanceMetrics when provided', () => {
    // #given
    const metrics = {
      fcp: 1200,
      lcp: 2500,
      memoryUsed: 50_000_000,
      memoryTotal: 100_000_000,
      longTasks: [{ duration: 80, startTime: 1000 }],
    };

    // #when
    const report = buildBugReport({ selectionMode: 'click', elements: [], performanceMetrics: metrics });

    // #then
    expect(report.performanceMetrics).toEqual(metrics);
  });
});

describe('collectBrowserInfo', () => {
  it('returns userAgent, viewport, url, and timestamp', () => {
    // #when
    const info = collectBrowserInfo();

    // #then
    expect(typeof info.userAgent).toBe('string');
    expect(typeof info.viewport.width).toBe('number');
    expect(typeof info.viewport.height).toBe('number');
    expect(typeof info.url).toBe('string');
    expect(info.timestamp).toBe(FIXED_ISO);
  });
});

describe('extractElementInfo', () => {
  it('returns element metadata including cssSelector, xpath, boundingRect, and textContent', () => {
    // #given
    const el = document.createElement('div');
    el.id = 'test-node';
    el.textContent = 'Hello world';
    document.body.appendChild(el);

    // #when
    const info = extractElementInfo(el);

    // #then
    expect(info.cssSelector).toBe('#test-node');
    expect(info.xpath).toMatch(/^\//);
    expect(info.textContent).toBe('Hello world');
    expect(typeof info.boundingRect.width).toBe('number');
    expect(typeof info.computedStyles).toBe('object');

    document.body.removeChild(el);
  });

  it('truncates textContent to 200 characters', () => {
    // #given
    const el = document.createElement('p');
    el.textContent = 'a'.repeat(300);
    document.body.appendChild(el);

    // #when
    const info = extractElementInfo(el);

    // #then
    expect(info.textContent).toHaveLength(200);

    document.body.removeChild(el);
  });

  it('sets reactComponentName to null when no React fiber is present', () => {
    // #given
    const el = document.createElement('span');
    document.body.appendChild(el);

    // #when
    const info = extractElementInfo(el);

    // #then
    expect(info.reactComponentName).toBeNull();

    document.body.removeChild(el);
  });

  it('includes known computed style properties', () => {
    // #given
    const el = document.createElement('div');
    document.body.appendChild(el);

    // #when
    const info = extractElementInfo(el);

    // #then
    expect(info.computedStyles).toHaveProperty('display');
    expect(info.computedStyles).toHaveProperty('position');

    document.body.removeChild(el);
  });
});

describe('getReactComponentName', () => {
  function makeElementWithFiber(fiberType: unknown): Element {
    const el = document.createElement('div');
    Object.defineProperty(el, '__reactFiber$test', {
      value: { type: fiberType, return: null },
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return el;
  }

  it('returns null when element has no React fiber key', () => {
    // #given
    const el = document.createElement('div');

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBeNull();
  });

  it('resolves displayName from an object type (styled-component wrapper)', () => {
    // #given
    const styledType = { displayName: 'Styled(AlbumArtContainer)' };
    const el = makeElementWithFiber(styledType);

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('AlbumArtContainer');
  });

  it('resolves displayName from a ForwardRef wrapper', () => {
    // #given
    const forwardRefType = { displayName: 'ForwardRef(PlayerContainer)' };
    const el = makeElementWithFiber(forwardRefType);

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('PlayerContainer');
  });

  it('resolves displayName from a Memo wrapper', () => {
    // #given
    const memoType = { displayName: 'Memo(TrackList)' };
    const el = makeElementWithFiber(memoType);

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('TrackList');
  });

  it('skips generic styled.div function name and walks up the fiber tree', () => {
    // #given
    const el = document.createElement('div');
    const styledFn = function styled() {};
    Object.defineProperty(styledFn, 'name', { value: 'styled.div', configurable: true });
    const parentFiber = { type: function AlbumArtContainer() {}, return: null };
    Object.defineProperty(el, '__reactFiber$test', {
      value: { type: styledFn, return: parentFiber },
      writable: true,
      configurable: true,
      enumerable: true,
    });

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('AlbumArtContainer');
  });

  it('resolves displayName on a function type before checking name', () => {
    // #given
    const fn = function _c() {};
    Object.defineProperty(fn, 'displayName', { value: 'VolumeBar', configurable: true });
    const el = makeElementWithFiber(fn);

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('VolumeBar');
  });

  it('returns plain function name when not generic', () => {
    // #given
    const fn = function TrackInfo() {};
    const el = makeElementWithFiber(fn);

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBe('TrackInfo');
  });

  it('returns null when all fiber types are generic', () => {
    // #given
    const el = document.createElement('div');
    const styledFn = function styled() {};
    Object.defineProperty(styledFn, 'name', { value: 'styled.div', configurable: true });
    Object.defineProperty(el, '__reactFiber$test', {
      value: { type: styledFn, return: null },
      writable: true,
      configurable: true,
      enumerable: true,
    });

    // #when
    const name = getReactComponentName(el);

    // #then
    expect(name).toBeNull();
  });
});
