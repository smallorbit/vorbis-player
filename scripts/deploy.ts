#!/usr/bin/env node
/**
 * Provider-agnostic deploy driver.
 *
 * Runs the test suite and a single production build, then invokes DEPLOY_TARGET.
 * For Vercel CLI targets that include `--prebuilt`, runs `vercel build` once
 * (instead of `npm run build`) so deploy does not rebuild the app.
 *
 * See docs/deploy.md for the full contract.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const isProduction = process.argv.includes('--prod');
const deployEnv = isProduction ? 'production' : 'preview';

console.log('Vorbis Player deploy');
console.log('====================\n');

const target = isProduction
  ? (process.env.DEPLOY_TARGET_PROD ?? process.env.DEPLOY_TARGET)
  : process.env.DEPLOY_TARGET;

if (!target) {
  console.error('No deploy target configured.\n');
  console.error('Set DEPLOY_TARGET to the command that publishes ./dist to your host, e.g.:');
  console.error('  DEPLOY_TARGET="npx vercel deploy --prebuilt"                  npm run deploy:preview');
  console.error('  DEPLOY_TARGET="netlify deploy --dir=dist"                     npm run deploy:preview');
  console.error('  DEPLOY_TARGET="rsync -a --delete dist/ user@host:/srv"        npm run deploy');
  console.error('\nSee docs/deploy.md for the full deploy contract.');
  process.exit(1);
}

const envExamplePath = path.join(root, '.env.example');
const envLocalPath = path.join(root, '.env.local');
if (existsSync(envExamplePath) && !existsSync(envLocalPath)) {
  console.log(
    'Note: .env.local not found. Copy .env.example and fill in credentials before building.\n',
  );
}

const usesVercelPrebuilt = /\bvercel\b/.test(target) && /--prebuilt\b/.test(target);

console.log('Running tests...');
try {
  execSync('npm run test:run', { stdio: 'inherit', cwd: root });
  console.log('Tests passed.\n');
} catch {
  console.error('Tests failed.');
  process.exit(1);
}

console.log('Building the project...');
try {
  if (usesVercelPrebuilt) {
    execSync('npx vercel build', { stdio: 'inherit', cwd: root, env: process.env });
  } else {
    execSync('npm run build', { stdio: 'inherit', cwd: root });
  }
  console.log('Build completed.\n');
} catch {
  console.error('Build failed.');
  process.exit(1);
}

console.log(`Deploying (${deployEnv}) via: ${target}\n`);
try {
  execSync(target, {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, DEPLOY_ENV: deployEnv },
  });
} catch {
  console.error('\nDeployment failed.');
  console.error('Verify DEPLOY_TARGET is correct and any host CLI it uses is authenticated.');
  process.exit(1);
}

console.log(`\nDeployment (${deployEnv}) complete.`);
