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
 * - ES2020 target for modern browser features
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
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-slider', 
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-tabs',
            '@radix-ui/react-avatar',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-checkbox'
          ],
          styled: ['styled-components'],
          icons: ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 3000
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
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
