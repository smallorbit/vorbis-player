import type {
  BugReport,
  BrowserInfo,
  BoundingRect,
  SelectedElement,
  SelectionMode,
  Category,
  ConsoleEntry,
  PerfData,
} from '@/types/devbug';
import { generateCssSelector, generateXPath } from './selectorGenerator';

const INTERESTING_STYLES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'border',
  'border-radius',
  'overflow',
  'z-index',
  'opacity',
  'visibility',
  'flex-direction',
  'align-items',
  'justify-content',
];

const TEXT_CONTENT_MAX_LENGTH = 200;

export function collectBrowserInfo(): BrowserInfo {
  return {
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };
}

export function extractElementInfo(element: Element): SelectedElement {
  const rect = element.getBoundingClientRect();
  const boundingRect: BoundingRect = {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    x: rect.x,
    y: rect.y,
  };

  const computed = window.getComputedStyle(element);
  const computedStyles: Record<string, string> = {};
  for (const prop of INTERESTING_STYLES) {
    computedStyles[prop] = computed.getPropertyValue(prop);
  }

  const rawText = element.textContent ?? '';
  const textContent = rawText.slice(0, TEXT_CONTENT_MAX_LENGTH);

  const reactComponentName = getReactComponentName(element);

  return {
    cssSelector: generateCssSelector(element),
    xpath: generateXPath(element),
    reactComponentName,
    boundingRect,
    computedStyles,
    textContent,
  };
}

function isGenericName(name: string): boolean {
  return (
    /^styled\./.test(name) ||
    /^Styled\(/.test(name) ||
    /^forwardRef$/i.test(name) ||
    /^_c\d*$/.test(name) ||
    name === 'div' ||
    name === 'span' ||
    name === 'button'
  );
}

function unwrapDisplayName(displayName: string): string {
  const match = displayName.match(/^(?:Styled|ForwardRef|Memo)\((.+)\)$/);
  return match ? match[1] : displayName;
}

export function getReactComponentName(element: Element): string | null {
  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'),
  );

  if (!fiberKey) return null;

  let fiber = (element as unknown as Record<string, unknown>)[fiberKey] as
    | { type?: unknown; return?: unknown }
    | null
    | undefined;

  while (fiber) {
    const type = fiber.type;

    if (typeof type === 'object' && type !== null) {
      const displayName = (type as Record<string, unknown>).displayName;
      if (typeof displayName === 'string') {
        const unwrapped = unwrapDisplayName(displayName);
        if (!isGenericName(unwrapped)) return unwrapped;
      }
    }

    if (typeof type === 'function') {
      const fnType = type as { displayName?: string; name?: string };
      if (typeof fnType.displayName === 'string') {
        const unwrapped = unwrapDisplayName(fnType.displayName);
        if (!isGenericName(unwrapped)) return unwrapped;
      }
      if (fnType.name && !isGenericName(fnType.name)) {
        return fnType.name;
      }
    }

    fiber = fiber.return as typeof fiber;
  }

  return null;
}

export interface BuildBugReportParams {
  selectionMode: SelectionMode;
  elements: SelectedElement[];
  screenshotDataUrl?: string;
  comment?: string;
  categories?: Category[];
  consoleLogs?: ConsoleEntry[];
  performanceMetrics?: PerfData;
}

export function buildBugReport(params: BuildBugReportParams): BugReport {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    selectionMode: params.selectionMode,
    elements: params.elements,
    screenshotDataUrl: params.screenshotDataUrl ?? '',
    comment: params.comment ?? '',
    categories: params.categories ?? [],
    consoleLogs: params.consoleLogs ?? [],
    browserInfo: collectBrowserInfo(),
    performanceMetrics: params.performanceMetrics ?? {
      fcp: null,
      lcp: null,
      memoryUsed: null,
      memoryTotal: null,
      longTasks: [],
    },
  };
}
