import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = join(__dirname, '../public/music');

function fetchWithTimeout(url, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Kevin MacLeod — CC BY 3.0 (royalty-free, attribution in description)
const TRACKS = {
  future: [
    'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Invariance.mp3',
    'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Olympus.mp3',
  ],
  optimize: [
    'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Faster%20Does%20It.mp3',
    'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Call%20to%20Adventure.mp3',
  ],
};

export async function prepareMusic(genre) {
  mkdirSync(MUSIC_DIR, { recursive: true });
  const outputPath = join(MUSIC_DIR, 'background.mp3');
  const urls = TRACKS[genre] || TRACKS.future;

  for (const url of urls) {
    try {
      process.stdout.write(`  Downloading music... `);
      const res = await fetchWithTimeout(url, 30000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const writer = createWriteStream(outputPath);
      await pipeline(res.body, writer);
      process.stdout.write('✓\n');
      return outputPath;
    } catch (err) {
      process.stdout.write(`✗ (${err.message})\n`);
    }
  }

  console.log('  No music available this run — continuing without.');
  return null;
}
