import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGitHubService } from '../githubService';
import type { BugReport } from '@/types/devbug';

const BASE_REPORT: BugReport = {
  id: 'report-uuid-5678',
  timestamp: '2026-04-06T12:00:00.000Z',
  selectionMode: 'click',
  elements: [],
  screenshotDataUrl: '',
  comment: 'Something is off',
  categories: ['broken'],
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

const CONFIG = {
  token: 'ghp_test_token',
  owner: 'smallorbit',
  repo: 'vorbis-player',
};

beforeEach(() => {
  Object.defineProperty(import.meta, 'env', {
    value: { ...import.meta.env, DEV: true },
    writable: true,
    configurable: true,
  });
});

describe('createGitHubService', () => {
  it('throws when token is empty string', () => {
    // #when / #then
    expect(() => createGitHubService({ ...CONFIG, token: '' })).toThrow('requires a GitHub token');
  });

  it('creates a service instance when token and dev mode are valid', () => {
    // #when
    const service = createGitHubService(CONFIG);

    // #then
    expect(service).toBeDefined();
    expect(typeof service.uploadScreenshot).toBe('function');
    expect(typeof service.createIssue).toBe('function');
    expect(typeof service.isConfigured).toBe('function');
  });
});

describe('GitHubService.isConfigured', () => {
  it('returns true when token is present', () => {
    // #when
    const service = createGitHubService(CONFIG);

    // #then
    expect(service.isConfigured()).toBe(true);
  });
});

describe('GitHubService.uploadScreenshot', () => {
  it('strips the data URL prefix and calls the GitHub contents API', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ content: {}, commit: {} }), { status: 201 }),
    );

    // #when
    const rawUrl = await service.uploadScreenshot('data:image/png;base64,abc123==', 'shot.png');

    // #then
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/smallorbit/vorbis-player/contents/docs/bug-screenshots/shot.png');
    expect(options.method).toBe('PUT');
    const body = JSON.parse(options.body as string) as { content: string };
    expect(body.content).toBe('abc123==');
    expect(rawUrl).toBe(
      'https://raw.githubusercontent.com/smallorbit/vorbis-player/main/docs/bug-screenshots/shot.png',
    );
  });

  it('throws a descriptive error when the API returns a non-ok response', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    // #when / #then
    await expect(service.uploadScreenshot('data:image/png;base64,abc', 'x.png')).rejects.toThrow(
      'Failed to upload screenshot (401)',
    );
  });

  it('handles non-png data URLs by stripping the prefix generically', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 201 }),
    );

    // #when
    await service.uploadScreenshot('data:image/jpeg;base64,jpegdata==', 'img.png');

    // #then
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { content: string };
    expect(body.content).toBe('jpegdata==');
  });
});

describe('GitHubService.createIssue', () => {
  function mockLabelCheck(status: number): void {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('', { status }));
  }

  function mockIssueCreation(issueNumber: number): void {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ number: issueNumber, html_url: `https://github.com/smallorbit/vorbis-player/issues/${issueNumber}` }),
        { status: 201 },
      ),
    );
  }

  it('creates a GitHub issue and returns number and url', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(200);
    mockIssueCreation(42);

    // #when
    const result = await service.createIssue(BASE_REPORT);

    // #then
    expect(result.number).toBe(42);
    expect(result.url).toBe('https://github.com/smallorbit/vorbis-player/issues/42');
  });

  it('sends issue with devbug label', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(200);
    mockIssueCreation(10);

    // #when
    await service.createIssue(BASE_REPORT);

    // #then
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const issueCall = calls.find(([url]) => url.endsWith('/issues'));
    expect(issueCall).toBeDefined();
    const body = JSON.parse(issueCall![1].body as string) as { labels: string[] };
    expect(body.labels).toContain('devbug');
  });

  it('sends Authorization header with bearer token', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(200);
    mockIssueCreation(7);

    // #when
    await service.createIssue(BASE_REPORT);

    // #then
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const issueCall = calls.find(([url]) => url.endsWith('/issues'));
    const headers = issueCall![1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer ghp_test_token');
  });

  it('creates the devbug label when it does not exist yet', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(404);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ name: 'devbug' }), { status: 201 }));
    mockIssueCreation(3);

    // #when
    await service.createIssue(BASE_REPORT);

    // #then
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const labelCreateCall = calls.find(([url, opts]) => url.endsWith('/labels') && opts.method === 'POST');
    expect(labelCreateCall).toBeDefined();
  });

  it('continues creating issue even if label creation fails', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(404);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
    mockIssueCreation(9);

    // #when
    const result = await service.createIssue(BASE_REPORT);

    // #then
    expect(result.number).toBe(9);
  });

  it('uploads screenshot before creating issue when screenshotDataUrl is present', async () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      screenshotDataUrl: 'data:image/png;base64,screenshot123',
    };
    const service = createGitHubService(CONFIG);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 201 }));
    mockLabelCheck(200);
    mockIssueCreation(15);

    // #when
    const result = await service.createIssue(report);

    // #then
    expect(result.number).toBe(15);
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toContain('/contents/docs/bug-screenshots/');
    const issueCall = calls.find(([url]) => url.endsWith('/issues'));
    const issueBody = JSON.parse(issueCall![1].body as string) as { body: string };
    expect(issueBody.body).toContain('![screenshot]');
  });

  it('continues creating issue without screenshot when upload fails', async () => {
    // #given
    const report: BugReport = {
      ...BASE_REPORT,
      screenshotDataUrl: 'data:image/png;base64,screenshot123',
    };
    const service = createGitHubService(CONFIG);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    mockLabelCheck(200);
    mockIssueCreation(20);

    // #when
    const result = await service.createIssue(report);

    // #then
    expect(result.number).toBe(20);
  });

  it('throws when issue creation API returns non-ok', async () => {
    // #given
    const service = createGitHubService(CONFIG);
    mockLabelCheck(200);
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    // #when / #then
    await expect(service.createIssue(BASE_REPORT)).rejects.toThrow('Failed to create issue (404)');
  });
});
