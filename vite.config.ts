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
 * - Coverage: V8 provider with HTML reports
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
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

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
  plugins: [react()],
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'playwright/**', 'proxy-server/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        'coverage/',
        'proxy-server/'
      ]
    }
  }
})
