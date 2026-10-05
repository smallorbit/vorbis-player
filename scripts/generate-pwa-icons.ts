#!/usr/bin/env node
/**
 * Generates the maskable PWA icons from the 512px app icon.
 * Run: npm run pwa-icons
 *
 * Maskable icons are cropped by the OS to a shape that only guarantees the
 * centre circle (radius 40% of the icon) is visible. The source artwork runs
 * nearly edge to edge, so it is scaled down onto the icon's own background.
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const sourcePath = path.join(publicDir, 'icon-512x512.png');

const BACKGROUND = { r: 22, g: 21, b: 21, alpha: 1 };
const ARTWORK_SCALE = 0.8;
const SIZES = [192, 512];

try {
  for (const size of SIZES) {
    const artworkSize = Math.round(size * ARTWORK_SCALE);
    const artwork = await sharp(sourcePath).resize(artworkSize, artworkSize).toBuffer();
    const outputPath = path.join(publicDir, `icon-maskable-${size}x${size}.png`);
    await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
      .composite([{ input: artwork, gravity: 'center' }])
      .png()
      .toFile(outputPath);
    console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
  }
} catch (err) {
  console.error('PWA icon generation failed:', err);
  process.exit(1);
}
