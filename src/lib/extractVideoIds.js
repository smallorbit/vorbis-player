#!/usr/bin/env node
// Usage: node extractVideoIds.js <input.html> [output.json]
const fs = require('fs');
const path = require('path');

function parseVideoIdsFromHtml(htmlContent) {
  const regex = /"videoId":"([^"]+)"/g;
  const matches = htmlContent.matchAll(regex);
  const videoIds = new Set();
  for (const match of matches) {
    if (match[1]) {
      videoIds.add(match[1]);
    }
  }
  return Array.from(videoIds);
}

if (process.argv.length < 3) {
  console.error('Usage: node extractVideoIds.js <input.html> [output.json]');
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] || path.basename(inputPath, path.extname(inputPath)) + '-videoIds.json';

try {
  const htmlContent = fs.readFileSync(inputPath, 'utf8');
  const videoIds = parseVideoIdsFromHtml(htmlContent);
  fs.writeFileSync(outputPath, JSON.stringify(videoIds, null, 2), 'utf8');
  console.log(`Extracted ${videoIds.length} video IDs to ${outputPath}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
