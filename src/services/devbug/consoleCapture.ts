import createDebug from 'debug';
import { CircularBuffer } from './circularBuffer';

const log = createDebug('vorbis:devbug');

const MAX_STRING_LENGTH = 1000;
const BUFFER_CAPACITY = 200;

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

export interface ConsoleEntry {
  timestamp: string;
  level: ConsoleLevel;
  args: string[];
  stack: string;
}

type ConsolePatch = Record<ConsoleLevel, typeof console.log>;

const buffer = new CircularBuffer<ConsoleEntry>(BUFFER_CAPACITY);
let originals: ConsolePatch | null = null;

function safeStringify(value: unknown, seen = new Set<unknown>()): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + '...[truncated]' : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? '\n' + value.stack : ''}`;
  }

  if (typeof window !== 'undefined' && value instanceof Element) {
    const el = value as Element;
    let descriptor = el.tagName.toLowerCase();
    if (el.id) descriptor += `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) descriptor += `.${classes.join('.')}`;
    }
    return `[Element: <${descriptor}>]`;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const items = value.map((item) => safeStringify(item, seen));
      seen.delete(value);
      return `[${items.join(', ')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${safeStringify(v, seen)}`
    );
    seen.delete(value);
    const result = `{${entries.join(', ')}}`;
    return result.length > MAX_STRING_LENGTH ? result.slice(0, MAX_STRING_LENGTH) + '...[truncated]' : result;
  } catch {
    seen.delete(value);
    return '[Unserializable]';
  }
}

function serializeArgs(args: unknown[]): string[] {
  return args.map((arg) => safeStringify(arg));
}

function captureEntry(level: ConsoleLevel, args: unknown[]): void {
  buffer.push({
    timestamp: new Date().toISOString(),
    level,
    args: serializeArgs(args),
    stack: new Error().stack ?? '',
  });
}

function patchMethod(level: ConsoleLevel, original: typeof console.log): typeof console.log {
  return function (...args: unknown[]): void {
    captureEntry(level, args);
    original.apply(console, args);
  };
}

export function startCapture(): void {
  if (originals !== null) {
    log('startCapture called while already capturing — ignoring');
    return;
  }

  originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  const levels: ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'];
  for (const level of levels) {
    console[level] = patchMethod(level, originals[level]);
  }

  log('console capture started');
}

export function stopCapture(): ConsoleEntry[] {
  if (originals === null) {
    log('stopCapture called while not capturing — returning empty');
    return [];
  }

  const levels: ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'];
  for (const level of levels) {
    console[level] = originals[level];
  }

  originals = null;

  const entries = buffer.toArray();
  buffer.clear();

  log('console capture stopped, %d entries collected', entries.length);
  return entries;
}

export function getEntries(): ConsoleEntry[] {
  return buffer.toArray();
}

export function clearEntries(): void {
  buffer.clear();
}
