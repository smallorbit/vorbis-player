import type { ConsoleEntry } from './consoleCapture';

export interface FilterResult {
  matched: ConsoleEntry[];
  unmatched: ConsoleEntry[];
}

type ReactFiber = {
  type?: unknown;
  return?: ReactFiber | null;
};

function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, (_match, letter: string) => `-${letter.toLowerCase()}`)
    .replace(/^-/, '');
}

function toCamelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function buildNameVariants(componentName: string): string[] {
  const variants = new Set<string>();
  variants.add(componentName);
  variants.add(toCamelCase(componentName));
  variants.add(toKebabCase(componentName));
  variants.add(componentName.toLowerCase());
  return Array.from(variants);
}

function stackMatchesComponent(stack: string, componentName: string): boolean {
  const variants = buildNameVariants(componentName);
  return variants.some((variant) => stack.includes(variant));
}

export function filterConsoleByComponent(
  entries: ConsoleEntry[],
  componentName: string,
  parentNames?: string[],
): FilterResult {
  const allNames = [componentName, ...(parentNames ?? [])];
  const matched: ConsoleEntry[] = [];
  const unmatched: ConsoleEntry[] = [];

  for (const entry of entries) {
    const isMatch = allNames.some((name) => stackMatchesComponent(entry.stack, name));
    if (isMatch) {
      matched.push(entry);
    } else {
      unmatched.push(entry);
    }
  }

  return { matched, unmatched };
}

export function getComponentHierarchy(element: Element): string[] {
  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'),
  );

  if (!fiberKey) return [];

  let fiber = (element as unknown as Record<string, unknown>)[fiberKey] as ReactFiber | null | undefined;

  const hierarchy: string[] = [];

  while (fiber) {
    const type = fiber.type;
    if (typeof type === 'function' && type.name) {
      hierarchy.push(type.name);
    } else if (typeof type === 'object' && type !== null) {
      const displayName = (type as Record<string, unknown>).displayName;
      if (typeof displayName === 'string') {
        hierarchy.push(displayName);
      }
    }
    fiber = fiber.return ?? null;
  }

  return hierarchy;
}
