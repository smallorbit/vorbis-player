#!/usr/bin/env node

/**
 * PWA Validation Script for Vorbis Player
 * Checks that all Progressive Web App requirements are met
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Validating PWA Configuration for Vorbis Player...\n');

// Check manifest.json
console.log('📋 Checking manifest.json...');
const manifestPath = path.join(__dirname, '../public/manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ manifest.json is valid');
      console.log(`   - Name: ${manifest.name}`);
      console.log(`   - Short Name: ${manifest.short_name}`);
      console.log(`   - Display: ${manifest.display} (${manifest.display === 'standalone' ? 'standalone with window controls overlay' : manifest.display === 'minimal-ui' ? 'minimal browser UI' : 'with title bar'})`);
      if (manifest.display_override) {
        console.log(`   - Display Override: ${manifest.display_override.join(', ')}`);
      }
      console.log(`   - Icons: ${manifest.icons.length} icon(s) defined`);
      if (manifest.window) {
        console.log(`   - Window Size: ${manifest.window.width}x${manifest.window.height}`);
        console.log(`   - Min Size: ${manifest.window.min_width}x${manifest.window.min_height}`);
      }
    } else {
      console.log('❌ manifest.json missing required fields:', missingFields);
    }
  } catch (error) {
    console.log('❌ manifest.json is invalid JSON:', error.message);
  }
} else {
  console.log('❌ manifest.json not found');
}

// Check service worker
console.log('\n🔧 Checking service worker...');
const swPath = path.join(__dirname, '../public/sw.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');
  const hasInstallEvent = swContent.includes('install');
  const hasFetchEvent = swContent.includes('fetch');
  const hasActivateEvent = swContent.includes('activate');
  
  if (hasInstallEvent && hasFetchEvent && hasActivateEvent) {
    console.log('✅ Service worker is properly configured');
    console.log('   - Install event: ✅');
    console.log('   - Fetch event: ✅');
    console.log('   - Activate event: ✅');
  } else {
    console.log('❌ Service worker missing required events');
  }
} else {
  console.log('❌ Service worker not found');
}

// Check icons
console.log('\n🖼️  Checking PWA icons...');
const iconsDir = path.join(__dirname, '../public/icons');
if (fs.existsSync(iconsDir)) {
  const iconFiles = fs.readdirSync(iconsDir);
  const requiredIcons = ['icon-192x192.png', 'icon-512x512.png'];
  const missingIcons = requiredIcons.filter(icon => !iconFiles.includes(icon));
  
  if (missingIcons.length === 0) {
    console.log('✅ All required icons are present');
    iconFiles.forEach(file => {
      const stats = fs.statSync(path.join(iconsDir, file));
      console.log(`   - ${file}: ${(stats.size / 1024).toFixed(1)}KB`);
    });
  } else {
    console.log('❌ Missing required icons:', missingIcons);
  }
} else {
  console.log('❌ Icons directory not found');
}

// Check HTML for PWA meta tags
console.log('\n📄 Checking HTML for PWA meta tags...');
const htmlPath = path.join(__dirname, '../index.html');
if (fs.existsSync(htmlPath)) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const hasManifest = htmlContent.includes('rel="manifest"');
  const hasThemeColor = htmlContent.includes('theme-color');
  const hasMobileWebAppCapable = htmlContent.includes('mobile-web-app-capable');
  const hasAppleMeta = htmlContent.includes('apple-mobile-web-app');
  const hasServiceWorker = htmlContent.includes('serviceWorker');
  
  if (hasManifest && hasThemeColor && hasMobileWebAppCapable && hasAppleMeta && hasServiceWorker) {
    console.log('✅ HTML contains all required PWA meta tags');
    console.log('   - Manifest link: ✅');
    console.log('   - Theme color: ✅');
    console.log('   - Mobile web app capable: ✅');
    console.log('   - Apple meta tags: ✅');
    console.log('   - Service worker registration: ✅');
  } else {
    console.log('❌ HTML missing required PWA meta tags');
    if (!hasManifest) console.log('   - Missing: manifest link');
    if (!hasThemeColor) console.log('   - Missing: theme color');
    if (!hasMobileWebAppCapable) console.log('   - Missing: mobile-web-app-capable');
    if (!hasAppleMeta) console.log('   - Missing: apple meta tags');
    if (!hasServiceWorker) console.log('   - Missing: service worker registration');
  }
} else {
  console.log('❌ index.html not found');
}

console.log('\n🎉 PWA validation complete!');
console.log('\nTo test the PWA installation:');
console.log('1. Open http://127.0.0.1:3000 in Chrome');
console.log('2. Look for the install icon (📱) in the address bar');
console.log('3. Click "Install" to add to your desktop');
console.log('4. The app will launch in its own window like a native app'); 