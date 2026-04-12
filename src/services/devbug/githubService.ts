import type { BugReport } from '@/types/devbug';
import { formatIssueBody, formatIssueTitle } from './issueFormatter';

const GITHUB_API_BASE = 'https://api.github.com';
const SCREENSHOT_PATH_PREFIX = 'docs/bug-screenshots';
const DEVBUG_LABEL = 'devbug';

interface GitHubServiceConfig {
  token: string;
  owner: string;
  repo: string;
}

interface GitHubService {
  uploadScreenshot(dataUrl: string, filename: string): Promise<string>;
  createIssue(report: BugReport): Promise<{ number: number; url: string }>;
  isConfigured(): boolean;
}

export function createGitHubService(config: GitHubServiceConfig): GitHubService {
  if (!import.meta.env.DEV) {
    throw new Error('GitHubService is only available in development builds.');
  }

  if (!config.token) {
    throw new Error(
      'GitHubService requires a GitHub token. Set VITE_DEVBUG_GITHUB_TOKEN in your .env.local file.',
    );
  }

  const { token, owner, repo } = config;

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  async function uploadScreenshot(dataUrl: string, filename: string): Promise<string> {
    const base64Content = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const path = `${SCREENSHOT_PATH_PREFIX}/${filename}`;
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        message: `devbug: upload screenshot ${filename}`,
        content: base64Content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to upload screenshot (${response.status}): ${errorText}`);
    }

    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  }

  async function ensureLabel(): Promise<void> {
    const checkUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/labels/${DEVBUG_LABEL}`;
    const checkResponse = await fetch(checkUrl, { headers: authHeaders() });

    if (checkResponse.ok) return;

    const createUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/labels`;
    await fetch(createUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: DEVBUG_LABEL,
        color: 'd73a4a',
        description: 'Automatically created bug report from DevBug tool',
      }),
    });
  }

  async function createIssue(report: BugReport): Promise<{ number: number; url: string }> {
    let screenshotUrl: string | null = null;
    if (report.screenshotDataUrl) {
      const filename = `${report.id}.png`;
      try {
        screenshotUrl = await uploadScreenshot(report.screenshotDataUrl, filename);
      } catch {
        // Continue without screenshot — don't block issue creation
      }
    }

    await ensureLabel().catch(() => {
      // Don't fail if label creation fails
    });

    const title = formatIssueTitle(report);
    const body = formatIssueBody(report, screenshotUrl);

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`;
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title,
        body,
        labels: [DEVBUG_LABEL],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to create issue (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  }

  function isConfigured(): boolean {
    return Boolean(token);
  }

  return { uploadScreenshot, createIssue, isConfigured };
}

export function createDefaultGitHubService(): GitHubService {
  const token = import.meta.env.VITE_DEVBUG_GITHUB_TOKEN as string | undefined;
  return createGitHubService({
    token: token ?? '',
    owner: 'smallorbit',
    repo: 'vorbis-player',
  });
}
