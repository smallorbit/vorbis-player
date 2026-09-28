#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredDeps = [
  'node_modules/@testing-library/user-event/package.json',
  'node_modules/@testing-library/react/package.json',
  'node_modules/vitest/package.json',
];

const missing = requiredDeps.filter((dep) => !existsSync(path.join(root, dep)));

if (missing.length > 0) {
  console.error(
    "\nnode_modules appears out of sync with package-lock.json. Run 'npm install' before running tests.\n" +
      `Missing: ${missing.map((d) => d.replace('node_modules/', '')).join(', ')}\n`,
  );
  process.exit(1);
}
