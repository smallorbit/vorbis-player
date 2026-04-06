export function generateCssSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const classes = Array.from(element.classList).filter(Boolean);
  if (classes.length > 0) {
    const classSelector = classes.map((c) => `.${CSS.escape(c)}`).join('');
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }

  return buildNthChildPath(element);
}

function buildNthChildPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const parentEl: HTMLElement | null = current.parentElement;

    if (!parentEl) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parentEl.children).filter(
      (child: Element) => child.tagName === current!.tagName,
    );

    if (siblings.length === 1) {
      parts.unshift(tag);
    } else {
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-child(${index})`);
    }

    current = parentEl;
  }

  return parts.join(' > ');
}

export function generateXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.tagName.toLowerCase();
    const parentEl: HTMLElement | null = current.parentElement;

    if (!parentEl) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parentEl.children).filter(
      (child: Element) => child.tagName === current!.tagName,
    );

    if (siblings.length === 1) {
      parts.unshift(tag);
    } else {
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}[${index}]`);
    }

    current = parentEl;
  }

  return `/${parts.join('/')}`;
}
