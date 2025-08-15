import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: {
        main: resolve(__dirname, 'electron/main.ts'),
        preload: resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'fs/promises',
        'url',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:url',
        'better-sqlite3',
        'chokidar',
        'music-metadata',
        'sharp'
      ],
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
      },
    },
    minify: false,
    emptyOutDir: true,
    target: 'node18',
    ssr: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
