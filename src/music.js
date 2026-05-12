import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = join(__dirname, '../public/music');

// Royalty-free tracks — Mixkit (free, no attribution required)
const TRACKS = {
  future:   'https://assets.mixkit.co/music/preview/mixkit-cinematic-mystery-2056.mp3',
  optimize: 'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3',
};

export async function prepareMusic(genre) {
  mkdirSync(MUSIC_DIR, { recursive: true });
  const outputPath = join(MUSIC_DIR, 'background.mp3');
  const url = TRACKS[genre] || TRACKS.future;

  try {
    process.stdout.write('  Downloading background music... ');
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const writer = createWriteStream(outputPath);
    await pipeline(res.body, writer);
    process.stdout.write('✓\n');
    return outputPath;
  } catch (err) {
    process.stdout.write(`✗ (${err.message}) — no music this run\n`);
    return null;
  }
}
