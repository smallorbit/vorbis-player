import type { BugReport, ConsoleEntry, SelectedElement } from '@/types/devbug';

const CONSOLE_LOG_LIMIT = 10;

export function formatIssueTitle(report: BugReport): string {
  const categories = report.categories.length > 0 ? report.categories.join(', ') : 'general';
  const component =
    report.elements.length > 0
      ? (report.elements[0].reactComponentName ?? report.elements[0].cssSelector)
      : 'unknown';
  return `[DevBug] ${categories} — ${component}`;
}

export function formatIssueBody(report: BugReport, screenshotUrl: string | null): string {
  const sections: string[] = [];

  sections.push(formatHeader(report));

  if (screenshotUrl) {
    sections.push(formatScreenshot(screenshotUrl));
  }

  if (report.comment) {
    sections.push(formatComment(report.comment));
  }

  if (report.elements.length > 0) {
    sections.push(formatElements(report.elements));
  }

  if (report.consoleLogs.length > 0) {
    sections.push(formatConsoleLogs(report.consoleLogs));
  }

  sections.push(formatBrowserInfo(report));
  sections.push(formatPerformanceMetrics(report));

  return sections.join('\n\n');
}

function formatHeader(report: BugReport): string {
  const categoryList =
    report.categories.length > 0 ? report.categories.map((c) => `\`${c}\``).join(', ') : '_none_';

  return [
    `## DevBug Report`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **ID** | \`${report.id}\` |`,
    `| **Timestamp** | ${report.timestamp} |`,
    `| **Selection Mode** | ${report.selectionMode} |`,
    `| **Categories** | ${categoryList} |`,
  ].join('\n');
}

function formatScreenshot(screenshotUrl: string): string {
  return [`## Screenshot`, ``, `![screenshot](${screenshotUrl})`].join('\n');
}

function formatComment(comment: string): string {
  return [`## Comment`, ``, comment].join('\n');
}

function formatElements(elements: SelectedElement[]): string {
  const lines: string[] = [`## Selected Elements`];

  elements.forEach((el, index) => {
    lines.push(``, `### Element ${index + 1}`);

    if (el.reactComponentName) {
      lines.push(`- **React Component**: \`${el.reactComponentName}\``);
    }
    lines.push(`- **CSS Selector**: \`${el.cssSelector}\``);
    lines.push(`- **XPath**: \`${el.xpath}\``);
    lines.push(
      `- **Bounding Rect**: ${el.boundingRect.width}×${el.boundingRect.height} at (${el.boundingRect.x}, ${el.boundingRect.y})`,
    );

    if (el.textContent) {
      const truncated = el.textContent.length > 100 ? el.textContent.slice(0, 100) + '…' : el.textContent;
      lines.push(`- **Text Content**: ${truncated}`);
    }

    const styleEntries = Object.entries(el.computedStyles).filter(([, v]) => v && v !== 'none' && v !== 'normal');
    if (styleEntries.length > 0) {
      lines.push(``, `**Computed Styles**`);
      lines.push('```');
      styleEntries.forEach(([k, v]) => lines.push(`${k}: ${v}`));
      lines.push('```');
    }
  });

  return lines.join('\n');
}

function formatConsoleLogs(logs: ConsoleEntry[]): string {
  const recent = logs.slice(-CONSOLE_LOG_LIMIT);
  const lines: string[] = [`## Console Logs (last ${recent.length})`, ``, '```'];

  recent.forEach((entry) => {
    const args = entry.args.join(' ');
    lines.push(`[${entry.level.toUpperCase()}] ${entry.timestamp} ${args}`);
    if (entry.stack) {
      lines.push(entry.stack);
    }
  });

  lines.push('```');
  return lines.join('\n');
}

function formatBrowserInfo(report: BugReport): string {
  const { browserInfo } = report;
  return [
    `## Browser Info`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **User Agent** | ${browserInfo.userAgent} |`,
    `| **Viewport** | ${browserInfo.viewport.width}×${browserInfo.viewport.height} |`,
    `| **URL** | ${browserInfo.url} |`,
  ].join('\n');
}

function formatPerformanceMetrics(report: BugReport): string {
  const { performanceMetrics: m } = report;
  const fcp = m.fcp !== null ? `${m.fcp}ms` : '_unavailable_';
  const lcp = m.lcp !== null ? `${m.lcp}ms` : '_unavailable_';
  const memUsed = m.memoryUsed !== null ? `${(m.memoryUsed / 1_048_576).toFixed(1)} MB` : '_unavailable_';
  const memTotal = m.memoryTotal !== null ? `${(m.memoryTotal / 1_048_576).toFixed(1)} MB` : '_unavailable_';

  const lines = [
    `## Performance Metrics`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **FCP** | ${fcp} |`,
    `| **LCP** | ${lcp} |`,
    `| **Memory Used** | ${memUsed} |`,
    `| **Memory Total** | ${memTotal} |`,
  ];

  if (m.longTasks.length > 0) {
    lines.push(``, `**Long Tasks** (${m.longTasks.length})`);
    lines.push('```');
    m.longTasks.forEach((t) => lines.push(`duration: ${t.duration}ms, startTime: ${t.startTime}ms`));
    lines.push('```');
  }

  return lines.join('\n');
}
