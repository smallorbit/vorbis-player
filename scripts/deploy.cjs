#!/usr/bin/env node

/**
 * Provider-agnostic deploy driver.
 *
 * The app repo knows nothing about any specific host (Vercel/Netlify/S3/nginx/…).
 * It produces a static `dist/` bundle, then hands that bundle off to a deploy
 * command defined entirely outside the repo via the DEPLOY_TARGET env var.
 *
 * Contract (see docs/deploy.md):
 *   DEPLOY_TARGET       Shell command that publishes ./dist to your host. Required.
 *   DEPLOY_TARGET_PROD  Optional production override; used for `--prod`,
 *                       falls back to DEPLOY_TARGET when unset.
 *   The chosen command is spawned with DEPLOY_ENV=production|preview in its
 *   environment so a wrapper can branch on the deploy kind if it needs to.
 *
 * Usage:
 *   npm run deploy           # production  (node scripts/deploy.cjs --prod)
 *   npm run deploy:preview   # preview     (node scripts/deploy.cjs)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--prod');
const deployEnv = isProduction ? 'production' : 'preview';

console.log('Vorbis Player deploy');
console.log('====================\n');

// Resolve the deploy target. Production may use a dedicated command; otherwise
// both preview and production share DEPLOY_TARGET.
const target = isProduction
  ? (process.env.DEPLOY_TARGET_PROD || process.env.DEPLOY_TARGET)
  : process.env.DEPLOY_TARGET;

if (!target) {
  console.error('No deploy target configured.\n');
  console.error('Set DEPLOY_TARGET to the command that publishes ./dist to your host, e.g.:');
  console.error('  DEPLOY_TARGET="vercel"                                  npm run deploy:preview');
  console.error('  DEPLOY_TARGET="netlify deploy --dir=dist"               npm run deploy:preview');
  console.error('  DEPLOY_TARGET="rsync -a --delete dist/ user@host:/srv"  npm run deploy');
  console.error('\nSee docs/deploy.md for the full deploy contract.');
  process.exit(1);
}

// Nudge if credentials likely aren't set up yet (build reads VITE_* from .env.local).
const envExamplePath = path.join(process.cwd(), '.env.example');
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envExamplePath) && !fs.existsSync(envLocalPath)) {
  console.log('Note: .env.local not found. Copy .env.example and fill in credentials before building.\n');
}

console.log('Building the project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed.\n');
} catch (error) {
  console.error('Build failed.');
  process.exit(1);
}

console.log(`Deploying (${deployEnv}) via: ${target}\n`);
try {
  execSync(target, {
    stdio: 'inherit',
    env: { ...process.env, DEPLOY_ENV: deployEnv },
  });
} catch (error) {
  console.error('\nDeployment failed.');
  console.error('Verify DEPLOY_TARGET is correct and any host CLI it uses is authenticated.');
  process.exit(1);
}

console.log(`\nDeployment (${deployEnv}) complete.`);
