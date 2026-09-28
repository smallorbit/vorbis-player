#!/usr/bin/env node
/**
 * Generates favicon.ico from the app logo.
 * Run: npm run favicon
 */

import sharp from 'sharp';
import ico from 'sharp-ico';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'public', 'vorbis_player_logo.jpg');
const outputPath = path.join(root, 'public', 'favicon.ico');

try {
  const info = await ico.sharpsToIco([sharp(logoPath)], outputPath, {
    sizes: [32, 16],
    resizeOptions: { fit: 'cover' },
  });
  console.log(`Generated favicon.ico (${info.size} bytes)`);
} catch (err) {
  console.error('Favicon generation failed:', err);
  process.exit(1);
}
