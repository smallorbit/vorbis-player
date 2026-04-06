import { describe, it, expect } from 'vitest';
import { formatIssueTitle, formatIssueBody } from '../issueFormatter';
import type { BugReport } from '@/types/devbug';

const BASE_REPORT: BugReport = {
  id: 'test-uuid-1234',
  timestamp: '2026-04-06T12:00:00.000Z',
  selectionMode: 'click',
  elements: [],
  screenshotDataUrl: '',
  comment: '',
  categories: [],
  consoleLogs: [],
  browserInfo: {
    userAgent: 'Mozilla/5.0 (Test)',
    viewport: { width: 1440, height: 900 },
    url: 'http://127.0.0.1:3000',
    timestamp: '2026-04-06T12:00:00.000Z',
  },
  performanceMetrics: {
    fcp: null,
    lcp: null,
    memoryUsed: null,
    memoryTotal: null,
    longTasks: [],
  },
};

describe('formatIssueTitle', () => {
  it('uses categories and element component name when available', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      categories: ['broken'],
      elements: [
        {
          cssSelector: '.player',
          xpath: '/div',
          reactComponentName: 'AudioPlayer',
          boundingRect: { top: 0, right: 100, bottom: 50, left: 0, width: 100, height: 50, x: 0, y: 0 },
          computedStyles: {},
          textContent: '',
        },
      ],
    };

    // #when
    const title = formatIssueTitle(report);

    // #then
    expect(title).toBe('[DevBug] broken — AudioPlayer');
  });

  it('falls back to cssSelector when reactComponentName is null', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      categories: ['slower'],
      elements: [
        {
          cssSelector: '#track-list',
          xpath: '/div/ul',
          reactComponentName: null,
          boundingRect: { top: 0, right: 100, bottom: 50, left: 0, width: 100, height: 50, x: 0, y: 0 },
          computedStyles: {},
          textContent: '',
        },
      ],
    };

    // #when
    const title = formatIssueTitle(report);

    // #then
    expect(title).toBe('[DevBug] slower — #track-list');
  });

  it('uses "general" when no categories and "unknown" when no elements', () => {
    // #when
    const title = formatIssueTitle(BASE_REPORT);

    // #then
    expect(title).toBe('[DevBug] general — unknown');
  });

  it('joins multiple categories with comma', () => {
    // #given
    const report: BugReport = { ...BASE_REPORT, categories: ['broken', 'slower'] };

    // #when
    const title = formatIssueTitle(report);

    // #then
    expect(title).toContain('broken, slower');
  });

  it('falls back to tag name from cssSelector when reactComponentName is a styled wrapper', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      categories: ['broken'],
      elements: [
        {
          cssSelector: 'div.sc-abc123',
          xpath: '/div',
          reactComponentName: 'styled.div',
          boundingRect: { top: 0, right: 100, bottom: 50, left: 0, width: 100, height: 50, x: 0, y: 0 },
          computedStyles: {},
          textContent: '',
        },
      ],
    };

    // #when
    const title = formatIssueTitle(report);

    // #then
    expect(title).toBe('[DevBug] broken — div');
  });

  it('falls back to tag name from cssSelector when reactComponentName is null', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      categories: ['broken'],
      elements: [
        {
          cssSelector: 'button.some-class',
          xpath: '/button',
          reactComponentName: null,
          boundingRect: { top: 0, right: 100, bottom: 50, left: 0, width: 100, height: 50, x: 0, y: 0 },
          computedStyles: {},
          textContent: '',
        },
      ],
    };

    // #when
    const title = formatIssueTitle(report);

    // #then
    expect(title).toBe('[DevBug] broken — button');
  });
});

describe('formatIssueBody', () => {
  it('includes the report ID in the header', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).toContain('test-uuid-1234');
  });

  it('includes screenshot markdown when screenshotUrl is provided', () => {
    // #given
    const url = 'https://raw.githubusercontent.com/smallorbit/vorbis-player/main/docs/bug-screenshots/abc.png';

    // #when
    const body = formatIssueBody(BASE_REPORT, url);

    // #then
    expect(body).toContain(`![screenshot](${url})`);
  });

  it('omits screenshot section when screenshotUrl is null', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).not.toContain('![screenshot]');
  });

  it('includes user comment when present', () => {
    // #given
    const report: BugReport = { ...BASE_REPORT, comment: 'The button is invisible' };

    // #when
    const body = formatIssueBody(report, null);

    // #then
    expect(body).toContain('The button is invisible');
  });

  it('omits comment section when comment is empty', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).not.toContain('## Comment');
  });

  it('includes element details when elements are present', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      elements: [
        {
          cssSelector: '.volume-slider',
          xpath: '/html/body/div',
          reactComponentName: 'VolumeControl',
          boundingRect: { top: 10, right: 200, bottom: 50, left: 10, width: 190, height: 40, x: 10, y: 10 },
          computedStyles: { display: 'flex', position: 'relative' },
          textContent: 'Volume',
        },
      ],
    };

    // #when
    const body = formatIssueBody(report, null);

    // #then
    expect(body).toContain('## Selected Elements');
    expect(body).toContain('VolumeControl');
    expect(body).toContain('.volume-slider');
    expect(body).toContain('190×40');
  });

  it('includes last 10 console logs', () => {
    // #given
    const logs = Array.from({ length: 15 }, (_, i) => ({
      timestamp: '2026-04-06T12:00:00.000Z',
      level: 'error' as const,
      args: [`Error ${i + 1}`],
      stack: null,
    }));
    const report: BugReport = { ...BASE_REPORT, consoleLogs: logs };

    // #when
    const body = formatIssueBody(report, null);

    // #then
    expect(body).toContain('## Console Logs');
    expect(body).toContain('Error 15');
    expect(body).not.toContain('Error 1\n');
    expect(body).toContain('last 10');
  });

  it('omits console logs section when no logs', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).not.toContain('## Console Logs');
  });

  it('includes browser info section', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).toContain('## Browser Info');
    expect(body).toContain('Mozilla/5.0 (Test)');
    expect(body).toContain('1440×900');
    expect(body).toContain('http://127.0.0.1:3000');
  });

  it('includes performance metrics section', () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      performanceMetrics: {
        fcp: 1200,
        lcp: 2500,
        memoryUsed: 52_428_800,
        memoryTotal: 104_857_600,
        longTasks: [{ duration: 85, startTime: 500 }],
      },
    };

    // #when
    const body = formatIssueBody(report, null);

    // #then
    expect(body).toContain('## Performance Metrics');
    expect(body).toContain('1200ms');
    expect(body).toContain('2500ms');
    expect(body).toContain('50.0 MB');
    expect(body).toContain('duration: 85ms');
  });

  it('shows unavailable for null performance metrics', () => {
    // #when
    const body = formatIssueBody(BASE_REPORT, null);

    // #then
    expect(body).toContain('_unavailable_');
  });
});
