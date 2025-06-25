#!/usr/bin/env node
// Usage: node src/lib/extractVideoIds.js <input.html> [output.json]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

if (process.argv[2] === 'youtube') {
  // Usage: node extractVideoIds.js youtube <youtube_url> <category>
  if (process.argv.length < 5) {
    console.error('Usage: node extractVideoIds.js youtube <youtube_url> <category>');
    process.exit(1);
  }
  const input = process.argv[3];
  const category = process.argv[4];
  const outputPath = path.resolve(__dirname, '../assets', `${category}-videoIds.json`);

  // If input looks like a playlist ID, construct the URL
  let youtubeUrl = input;
  if (/^[A-Za-z0-9_-]{18,34}$/.test(input)) {
    youtubeUrl = `https://www.youtube.com/playlist?list=${input}`;
  }

  // Helper: extract all video IDs from HTML
  function extractVideoIdsFromHtml(html) {
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const ids = new Set();
    let match;
    while ((match = regex.exec(html)) !== null) {
      ids.add(match[1]);
    }
    return Array.from(ids);
  }

  // Helper: extract single video ID from URL
  function extractVideoIdFromUrl(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  (async () => {
    try {
      if (/playlist\?list=/.test(youtubeUrl)) {
        // Playlist mode: fetch HTML and extract all video IDs
        const res = await fetch(youtubeUrl);
        if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.statusText}`);
        const html = await res.text();
        const videoIds = extractVideoIdsFromHtml(html);
        if (!videoIds.length) {
          throw new Error('No video IDs found in playlist HTML.');
        }
        fs.writeFileSync(outputPath, JSON.stringify(videoIds, null, 2), 'utf8');
        console.log(`Extracted ${videoIds.length} video IDs to ${outputPath}`);
      } else {
        // Single video mode
        const videoId = extractVideoIdFromUrl(youtubeUrl);
        if (!videoId) {
          throw new Error('Could not extract video ID from URL: ' + youtubeUrl);
        }
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          throw new Error('Extracted video ID does not appear valid: ' + videoId);
        }
        fs.writeFileSync(outputPath, JSON.stringify([videoId], null, 2), 'utf8');
        console.log(`Extracted video ID '${videoId}' to ${outputPath}`);
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
} else {
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
}
