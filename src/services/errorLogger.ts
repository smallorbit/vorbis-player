/**
 * Centralized error logging service backed by IndexedDB.
 *
 * Persists error logs across sessions and provides global interceptors
 * (console.error, window.onerror, unhandledrejection) so every error
 * scenario is captured automatically.
 *
 * Falls back to an in-memory array when IndexedDB is unavailable.
 */

const DB_NAME = 'vorbis-player-logs';
const DB_VERSION = 1;
const STORE_NAME = 'errorLogs';
const MAX_ENTRIES = 5000;

export interface ErrorLogEntry {
  id?: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

export type LogLevel = 'ERROR' | 'NETWORK';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let db: IDBDatabase | null = null;
let fallbackMode = false;
const memoryLogs: ErrorLogEntry[] = [];
let initialized = false;
let originalConsoleError: ((...args: unknown[]) => void) | null = null;

// ---------------------------------------------------------------------------
// Timestamp Formatting
// ---------------------------------------------------------------------------

export function formatTimestamp(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${mm}/${dd}/${yyyy} - ${hh}:${min}:${ss}.${ms}`;
}

function formatRaw(timestamp: string, level: LogLevel, message: string): string {
  return `[${timestamp}] - ${level} - ${message}`;
}

// ---------------------------------------------------------------------------
// IndexedDB Helpers
// ---------------------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
}

function idbPut(entry: ErrorLogEntry): void {
  if (!db) {
    memoryLogs.push(entry);
    if (memoryLogs.length > MAX_ENTRIES) memoryLogs.shift();
    return;
  }
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => pruneOldEntries();
  } catch {
    memoryLogs.push(entry);
  }
}

function pruneOldEntries(): void {
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const excess = countReq.result - MAX_ENTRIES;
        const cursorReq = store.openCursor();
        let deleted = 0;
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && deleted < excess) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  } catch {
    // pruning is best-effort
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an error with the required format.
 * Safe to call before `initErrorLogger()` — entries go to the memory buffer.
 */
function logWithLevel(level: LogLevel, message: string, context?: string): void {
  const ts = formatTimestamp();
  const fullMessage = context ? `[${context}] ${message}` : message;
  const entry: ErrorLogEntry = {
    timestamp: ts,
    level,
    message: fullMessage,
    raw: formatRaw(ts, level, fullMessage),
  };
  idbPut(entry);
}

export function logError(message: string, context?: string): void {
  logWithLevel('ERROR', message, context);
}

export function logNetwork(message: string, context?: string): void {
  logWithLevel('NETWORK', message, context);
}

/** Retrieve stored log entries, newest first. */
export async function getLogs(limit?: number): Promise<ErrorLogEntry[]> {
  if (fallbackMode || !db) {
    const logs = [...memoryLogs].reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  return new Promise((resolve) => {
    try {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const entries: ErrorLogEntry[] = [];

      const cursorReq = store.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && (!limit || entries.length < limit)) {
          entries.push(cursor.value as ErrorLogEntry);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(entries);
      tx.onerror = () => resolve([...memoryLogs].reverse());
    } catch {
      resolve([...memoryLogs].reverse());
    }
  });
}

/** Delete all stored log entries. */
export async function clearLogs(): Promise<void> {
  memoryLogs.length = 0;
  if (fallbackMode || !db) return;

  return new Promise((resolve) => {
    try {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Export all logs as a downloadable `error.log` file.
 * Returns the raw text content.
 */
export async function exportLogs(): Promise<string> {
  const logs = await getLogs();
  const text = logs
    .reverse() // oldest first for file output
    .map((l) => l.raw)
    .join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'error.log';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return text;
}

// ---------------------------------------------------------------------------
// Global Interceptors
// ---------------------------------------------------------------------------

function argsToMessage(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function installConsoleInterceptor(): void {
  originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalConsoleError!(...args);
    const message = argsToMessage(args);
    const ts = formatTimestamp();
    idbPut({
      timestamp: ts,
      level: 'ERROR',
      message,
      raw: formatRaw(ts, 'ERROR', message),
    });
  };
}

function installGlobalErrorHandler(): void {
  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error
      ? `${event.error.name}: ${event.error.message}`
      : event.message || 'Unknown error';
    logError(message, 'uncaught');
  });
}

function installUnhandledRejectionHandler(): void {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';
    logError(message, 'unhandledrejection');
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the error logger. Call once at app startup before React renders.
 * Opens IndexedDB, installs global interceptors, and flushes any buffered entries.
 */
export async function initErrorLogger(): Promise<void> {
  if (initialized) return;
  initialized = true;

  installConsoleInterceptor();
  installGlobalErrorHandler();
  installUnhandledRejectionHandler();

  try {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available');
    }
    db = await openIDB();

    // Flush memory buffer into IndexedDB
    if (memoryLogs.length > 0) {
      const entries = [...memoryLogs];
      memoryLogs.length = 0;
      for (const entry of entries) {
        idbPut(entry);
      }
    }
  } catch {
    fallbackMode = true;
  }
}
