export type SelectionMode = 'click' | 'area' | 'screenshot';

export type Category = 'faster' | 'slower' | 'bigger' | 'smaller' | 'broken';

export interface ConsoleEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string[];
  stack: string | null;
}

export interface BoundingRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SelectedElement {
  cssSelector: string;
  xpath: string;
  reactComponentName: string | null;
  boundingRect: BoundingRect;
  computedStyles: Record<string, string>;
  textContent: string;
}

export interface BrowserInfo {
  userAgent: string;
  viewport: { width: number; height: number };
  url: string;
  timestamp: string;
}

export interface PerfData {
  fcp: number | null;
  lcp: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  longTasks: Array<{ duration: number; startTime: number }>;
}

export interface BugReport {
  id: string;
  timestamp: string;
  selectionMode: SelectionMode;
  elements: SelectedElement[];
  screenshotDataUrl: string;
  comment: string;
  categories: Category[];
  consoleLogs: ConsoleEntry[];
  browserInfo: BrowserInfo;
  performanceMetrics: PerfData;
}
