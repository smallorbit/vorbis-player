# Error Logging System

Centralized, persistent error logging for the Vorbis Player application. All errors are captured, formatted with timestamps, stored in IndexedDB, and can be viewed in-app or exported as a downloadable `error.log` file.

## Log Format

Every error entry uses the following format:

```
[mm/dd/yyyy - hh:mm:ss.ms] - ERROR - error message
```

Example output:

```
[02/28/2026 - 14:23:01.456] - ERROR - [spotify] 429 rate-limited — backing off for 5000ms
[02/28/2026 - 14:23:01.789] - ERROR - [spotifyPlayer] Failed to authenticate: Premium required
[02/28/2026 - 14:23:05.012] - ERROR - [libraryCache] IndexedDB unavailable, using in-memory fallback: SecurityError
[02/28/2026 - 14:23:07.334] - ERROR - [uncaught] TypeError: Cannot read properties of undefined
[02/28/2026 - 14:23:09.101] - ERROR - [unhandledrejection] Error: Network request failed
```

When `logError()` is called with a `context` parameter, the context appears in brackets before the message: `[context] message`. This makes it easy to grep for errors from a specific module.

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           Error Sources                   │
                    ├──────────────────────────────────────────┤
                    │  console.error monkey-patch (global)      │
                    │  window.onerror (uncaught exceptions)     │
                    │  unhandledrejection (promise rejections)  │
                    │  Explicit logError() calls (~20 files)    │
                    └──────────────┬───────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │        ErrorLogger Service                │
                    │        src/services/errorLogger.ts        │
                    ├──────────────────────────────────────────┤
                    │  formatTimestamp() → mm/dd/yyyy - ...     │
                    │  logError(message, context?)              │
                    │  getLogs(limit?) → ErrorLogEntry[]        │
                    │  clearLogs()                              │
                    │  exportLogs() → downloads error.log       │
                    │  initErrorLogger() → sets up everything   │
                    └──────────────┬───────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
                   ┌────────────┐    ┌────────────┐
                   │  IndexedDB  │    │  In-Memory  │
                   │  (primary)  │    │ (fallback)  │
                   └──────┬─────┘    └──────┬──────┘
                          │                 │
                          └────────┬────────┘
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │           UI Layer                        │
                    ├──────────────────────────────────────────┤
                    │  ErrorLogViewer  (view / filter / export) │
                    │  DebugOverlay → "Persistent Logs" button  │
                    └──────────────────────────────────────────┘
```

## Files

### Core

| File | Purpose |
|------|---------|
| `src/services/errorLogger.ts` | Singleton logger service with IndexedDB persistence, global interceptors, and public API |
| `src/components/ErrorLogViewer.tsx` | Full-screen log viewer UI with filter, export, and clear functionality |
| `src/components/DebugOverlay.tsx` | Existing debug overlay, enhanced with a "Persistent Logs" button |
| `src/main.tsx` | Calls `initErrorLogger()` before React renders |

### Instrumented Files

The following 20 source files have explicit `logError()` calls that provide contextual error messages (in addition to the global `console.error` interceptor that catches everything automatically):

**Services:**

| File | Error Scenarios |
|------|-----------------|
| `src/services/spotify.ts` | API rate limiting (429), API request failures |
| `src/services/spotifyPlayer.ts` | SDK init/auth/account/playback errors, API error responses, device transfer failures, volume failures, state change callback errors |
| `src/services/cache/libraryCache.ts` | IndexedDB unavailable (fallback activation), localStorage migration failures |
| `src/services/cache/librarySyncEngine.ts` | Sync failures, warm-start background sync errors, cold-start load failures, listener invocation errors, polling errors, focus-sync errors |

**Hooks:**

| File | Error Scenarios |
|------|-----------------|
| `src/hooks/usePlaylistManager.ts` | Track fetch failures, context playback failures, missing track URIs, playback state check/resume errors, unavailable tracks, playback start failures |
| `src/hooks/useSpotifyPlayback.ts` | Device activation failure, resume failure, no track at index, not authenticated, unavailable tracks, play track errors |
| `src/hooks/useSpotifyControls.ts` | No device ID for seeking, seek API failures |
| `src/hooks/useLikeTrack.ts` | Like status check failure, like/unlike toggle failure |
| `src/hooks/useLibrarySync.ts` | Sync engine start failure |
| `src/hooks/useImageProcessingWorker.ts` | Unknown request ID, worker runtime errors, worker init failure |
| `src/hooks/useLocalStorage.ts` | localStorage read failure, write failure, storage event parse failure |
| `src/hooks/useAccentColor.ts` | Color extraction failure, color re-extraction failure |

**Components:**

| File | Error Scenarios |
|------|-----------------|
| `src/components/AlbumArt.tsx` | Image processing failure, image load failure |
| `src/components/PlaylistSelection.tsx` | Spotify auth redirect failure |
| `src/components/VisualEffectsPerformanceMonitor.tsx` | Performance test failure |

**Utilities:**

| File | Error Scenarios |
|------|-----------------|
| `src/utils/colorExtractor.ts` | Image data processing errors, image load failures (both dominant color and palette extraction) |
| `src/utils/performanceMonitor.ts` | Long task observer not supported |

**Entry Points:**

| File | Error Scenarios |
|------|-----------------|
| `src/App.tsx` | Deprecated localStorage cleanup failure |
| `src/main.tsx` | Service worker registration failure |

## Storage

### IndexedDB Database

- **Database name:** `vorbis-player-logs`
- **Version:** 1
- **Object store:** `errorLogs`
- **Key:** Auto-incrementing `id`
- **Max entries:** 5,000 (oldest pruned automatically)

This is a separate database from the library cache (`vorbis-player-library`) to keep concerns isolated.

### Entry Schema

```typescript
interface ErrorLogEntry {
  id?: number;        // auto-increment primary key
  timestamp: string;  // "mm/dd/yyyy - hh:mm:ss.ms"
  level: 'ERROR';     // always "ERROR"
  message: string;    // the error message, optionally prefixed with [context]
  raw: string;        // full formatted line: "[mm/dd/yyyy - hh:mm:ss.ms] - ERROR - message"
}
```

### Fallback

If IndexedDB is unavailable (e.g., private browsing in some browsers), the logger falls back to an in-memory array. All API methods (`logError`, `getLogs`, `clearLogs`, `exportLogs`) work identically in fallback mode, but logs do not survive page refresh.

## Public API

All functions are exported from `src/services/errorLogger.ts`.

### `initErrorLogger(): Promise<void>`

Call once at app startup, before React renders. This:

1. Monkey-patches `console.error` to persist every call to IndexedDB (the original `console.error` still fires normally)
2. Installs a `window.addEventListener('error', ...)` handler for uncaught exceptions
3. Installs a `window.addEventListener('unhandledrejection', ...)` handler for unhandled promise rejections
4. Opens the IndexedDB database
5. Flushes any entries that were buffered in memory before IndexedDB was ready

Safe to call multiple times (subsequent calls are no-ops).

### `logError(message: string, context?: string): void`

Log an error entry. This is a synchronous, fire-and-forget call (writes to IndexedDB asynchronously in the background).

```typescript
logError('API returned 401', 'spotify');
// Stores: "[02/28/2026 - 14:23:01.456] - ERROR - [spotify] API returned 401"

logError('Something went wrong');
// Stores: "[02/28/2026 - 14:23:01.456] - ERROR - Something went wrong"
```

Safe to call before `initErrorLogger()` -- entries are buffered in memory and flushed to IndexedDB once initialization completes.

### `getLogs(limit?: number): Promise<ErrorLogEntry[]>`

Retrieve stored log entries, newest first. Pass a `limit` to cap the number of entries returned. Returns from the in-memory fallback if IndexedDB is unavailable.

### `clearLogs(): Promise<void>`

Delete all stored log entries from both IndexedDB and the in-memory buffer.

### `exportLogs(): Promise<string>`

Retrieve all stored logs, format them as lines of `[mm/dd/yyyy - hh:mm:ss.ms] - ERROR - message` (oldest first), trigger a browser download of `error.log`, and return the raw text content.

### `formatTimestamp(date?: Date): string`

Format a `Date` as `mm/dd/yyyy - hh:mm:ss.ms`. Defaults to `new Date()`. Exported for testing or external use.

## Global Interceptors

The three global interceptors installed by `initErrorLogger()` ensure comprehensive coverage:

### console.error Intercept

Every `console.error(...)` call in the application (including from third-party libraries) is automatically captured. The original behavior is preserved -- messages still appear in the browser's developer console. The interceptor serializes all arguments into a single string and writes an `ErrorLogEntry` to IndexedDB.

### window.onerror

Catches uncaught exceptions that bubble to the window level. These are logged with context `[uncaught]`.

### unhandledrejection

Catches unhandled promise rejections. These are logged with context `[unhandledrejection]`.

## UI: ErrorLogViewer

`src/components/ErrorLogViewer.tsx` is a full-screen overlay for browsing persisted error logs. It is **lazy-loaded** (code-split into its own ~2.5 kB chunk) and only downloaded when the user opens it.

### Features

- **Auto-refresh:** Polls IndexedDB every 3 seconds for new entries
- **Text filter:** Case-insensitive search across error messages; filter input stops keyboard event propagation so shortcuts don't interfere
- **Export:** Downloads all logs as `error.log` with the standard format
- **Clear:** Purges all entries from IndexedDB
- **Entry count:** Shows `filtered / total` counts in the toolbar
- **Display limit:** Shows up to 500 entries at a time (newest fetched, displayed oldest-first for chronological reading)

### Access

The ErrorLogViewer is accessible from the existing **DebugOverlay**:

1. Tap the top-left corner of the screen 5 times rapidly to activate the debug overlay
2. A circular badge appears at the bottom-left showing the log count
3. Tap the badge to expand the session log view
4. Click the red **"Persistent Logs"** button in the toolbar to open the ErrorLogViewer

## How Errors Flow Through the System

### Path 1: Explicit `logError()` call

```
Code calls logError("API failed", "spotify")
  → formatTimestamp() generates "02/28/2026 - 14:23:01.456"
  → Entry created: { timestamp, level: "ERROR", message: "[spotify] API failed", raw: "[02/28/2026 - ...] - ERROR - [spotify] API failed" }
  → idbPut() writes to IndexedDB (or memory buffer if DB not ready)
  → pruneOldEntries() trims if > 5000 entries
```

### Path 2: console.error interceptor

```
Code calls console.error("something broke", errorObj)
  → Original console.error fires (browser dev console shows the message)
  → argsToMessage() serializes: "something broke Error: details"
  → Entry created with timestamp
  → idbPut() writes to IndexedDB
```

### Path 3: Uncaught exception

```
Unhandled throw in code
  → Browser fires 'error' event on window
  → Handler extracts error name + message (or falls back to event.message)
  → logError(message, 'uncaught')
  → Follows Path 1
```

### Path 4: Unhandled promise rejection

```
Promise rejects without .catch()
  → Browser fires 'unhandledrejection' event on window
  → Handler extracts reason (Error or string)
  → logError(message, 'unhandledrejection')
  → Follows Path 1
```

## Usage Guide

### Adding Error Logging to New Code

```typescript
import { logError } from '@/services/errorLogger';

async function doSomething() {
  try {
    await riskyOperation();
  } catch (error) {
    logError(
      `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
      'myModule'  // context prefix, appears as [myModule] in the log
    );
  }
}
```

The `context` parameter is optional but recommended. It produces messages like:

```
[02/28/2026 - 14:23:01.456] - ERROR - [myModule] Operation failed: Network timeout
```

### Viewing Logs in the Browser

1. Open the debug overlay (5 rapid taps on the top-left corner, or add `?debug=true` to the URL)
2. Click the **"Persistent Logs"** button (red) in the toolbar
3. Use the filter input to search for specific errors
4. Click **"Export error.log"** to download all logs

### Reading Logs Programmatically

Open the browser's developer console and run:

```javascript
// Import from the module (works in Vite dev mode)
const { getLogs, exportLogs } = await import('/src/services/errorLogger.ts');

// Get the 50 most recent errors
const recent = await getLogs(50);
console.table(recent);

// Download all logs as error.log
await exportLogs();
```

### Inspecting the IndexedDB Directly

1. Open Chrome DevTools > Application > IndexedDB
2. Expand `vorbis-player-logs` > `errorLogs`
3. Browse entries with their `id`, `timestamp`, `level`, `message`, and `raw` fields

## Performance Considerations

- **Synchronous API:** `logError()` is synchronous from the caller's perspective (fire-and-forget). IndexedDB writes happen asynchronously.
- **No blocking:** Writing to IndexedDB does not block the main thread. Failed writes silently fall back to the memory buffer.
- **Automatic pruning:** The store is capped at 5,000 entries. When exceeded, the oldest entries are deleted via cursor iteration.
- **Lazy-loaded UI:** The `ErrorLogViewer` component is code-split and only loaded when opened, adding zero overhead to the initial bundle.
- **Separate database:** Error logs use their own IndexedDB database (`vorbis-player-logs`), completely isolated from the library cache database (`vorbis-player-library`). Neither impacts the other.
