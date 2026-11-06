/**
 * @fileoverview Vite Configuration
 * 
 * Build configuration for the Vorbis Player application using Vite.
 * Optimized for development experience, production performance, and
 * Electron desktop app compatibility.
 * 
 * @build-optimizations
 * - Manual chunk splitting for better caching
 * - Vendor bundle separation (React, Radix UI, styled-components)
 * - CSS code splitting for faster initial loads
 * - Asset inlining for small files (<4KB)
 * - ES2022 target for modern browser features (top-level await, etc.)
 * 
 * @chunk-strategy
 * - vendor: React and React DOM
 * - radix: All Radix UI components
 * - styled: Styled-components library
 * - icons: Lucide React icon library
 * 
 * @development
 * - Host: 127.0.0.1 (required for Spotify OAuth)
 * - Port: 3000
 * - HMR: Enabled for fast development
 * - Source maps: Disabled for production builds
 * 
 * @testing
 * - Environment: jsdom for DOM simulation
 * - Coverage: V8 provider, all-src include (informational; no threshold gates)
 * - Setup: Custom test setup file
 * - Exclusions: node_modules, dist, coverage directories
 * 
 * @aliases
 * - @/*: Points to src/ directory for clean imports
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

interface VercelHeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

/**
 * Serves the production response headers from vercel.json on `vite preview`,
 * so the Playwright run (which tests the preview build) executes under the
 * real CSP. Report-only is promoted to enforcing here: a violation in e2e
 * should break the run, not scroll past in a console. HSTS is dropped because
 * preview is plain http.
 */
function productionHeadersForPreview(): Record<string, string> {
  const { headers } = require('./vercel.json') as { headers: VercelHeaderRule[] }
  const siteWide = headers.find((rule) => rule.source === '/(.*)')?.headers ?? []
  const previewHeaders: Record<string, string> = {}
  for (const { key, value } of siteWide) {
    if (key === 'Strict-Transport-Security') continue
    const previewKey = key === 'Content-Security-Policy-Report-Only' ? 'Content-Security-Policy' : key
    previewHeaders[previewKey] = value
  }
  return previewHeaders
}

// Build provenance, baked in at build time so the running app can report exactly
// which commit is deployed (staging / production verification). On Vercel the
// VERCEL_GIT_* system env vars are authoritative; locally we fall back to git.
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}
const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || git('rev-parse HEAD')
const buildRef = process.env.VERCEL_GIT_COMMIT_REF || git('rev-parse --abbrev-ref HEAD')
const buildEnv = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'local')

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_REF__: JSON.stringify(buildRef),
    __BUILD_ENV__: JSON.stringify(buildEnv),
  },
  plugins: [
    react(),
    // Generated Workbox service worker (replaces the hand-rolled public/sw.js, #1716).
    // Precache comes from the build output, so the shell and its hashed chunks
    // always match. Runtime caching is limited to public Spotify artwork:
    // authenticated API responses (Spotify, Dropbox, Last.fm) never touch Cache
    // Storage. Registration lives in src/main.tsx.
    VitePWA({
      injectRegister: false,
      // Release checklist item: docs/deploy.md#release-checklist.
      manifest: {
        name: '_vorbis_player_',
        short_name: 'vorbis',
        description:
          'A music player for Spotify and your own Dropbox library, with customizable visual effects and background visualizers.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#161515',
        background_color: '#161515',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['index.html', 'assets/*.{js,css}', 'favicon.ico', 'icon-*.png', 'apple-touch-icon.png'],
        globIgnores: ['playwright-fixtures/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              (url.hostname.endsWith('.scdn.co') && url.hostname !== 'sdk.scdn.co') ||
              url.hostname.endsWith('.spotifycdn.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotify-artwork',
              expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
              // CORS responses only. Cache Storage matches by URL, so an opaque
              // copy from a plain <img> would be served to the crossOrigin
              // loads (AlbumArt canvas, accent-color extraction) and fail them.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-slider',
            '@radix-ui/react-toggle-group',
          ],
          styled: ['styled-components']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'esbuild',
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    dedupe: ['react', 'react-dom', 'styled-components'],
  },
  optimizeDeps: {
    exclude: ['playwright-core', '@playwright/test', 'fsevents']
  },
  server: {
    host: '127.0.0.1',
    port: 3000
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    headers: productionHeadersForPreview(),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'playwright/**', 'proxy-server/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      // Count every production file, not just those imported by a test.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/__tests__/**',
        '**/*.d.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/workers/**',
      ],
    }
  }
})
