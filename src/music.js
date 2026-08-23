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

// Kevin MacLeod — CC BY 3.0 (royalty-free, attribution auto-added to every
// description). Energetic / driving / tension beds for the Kings of Ranks
// countdown vibe — all URL-verified downloadable. Shuffled per run so the music
// varies video to video instead of always using the first track.
const B = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree';
const TRACKS = {
  didyouknow: [
    `${B}/Fearless%20First.mp3`,   // epic, driving build
    `${B}/The%20Descent.mp3`,      // dark tension
    `${B}/Killers.mp3`,            // punchy, energetic
    `${B}/Exit%20the%20Premises.mp3`, // fast, urgent
  ],
  // Kings of Ranks — MELLOW, JAZZY beds (a "Golden Brown"-style vibe: warm,
  // laid-back, slightly wistful jazz) per the channel owner's request. Royalty-
  // free (Kevin MacLeod, CC-BY) — the best we can legally BAKE into an auto-
  // uploaded MP4; the actual Stranglers track would get Content-ID claimed.
  // All URL-verified 200. Shuffled per run.
  kingsranks: [
    `${B}/Bossa%20Antigua.mp3`,     // smooth jazzy bossa nova, mellow
    `${B}/Vibe%20Ace.mp3`,          // laid-back jazzy, vibraphone warmth
    `${B}/Sidewalk%20Shade.mp3`,    // relaxed café jazz
    `${B}/Amazing%20Plan.mp3`,      // light, wistful jazz
    `${B}/Almost%20New.mp3`,        // mellow jazz piano
  ],
  // "Have you ever thought…" comparison — energetic, curious, upbeat electronic
  // (not goofy, not scary). All URL-verified 200. Shuffled per run.
  versus: [
    `${B}/Blippy%20Trance.mp3`,     // bright, driving electronic
    `${B}/Electrodoodle.mp3`,       // playful, upbeat electronic
    `${B}/Digital%20Lemonade.mp3`,  // sunny, poppy electronic
    `${B}/Bit%20Shift.mp3`,         // energetic chiptune-electronic
    `${B}/Getting%20it%20Done.mp3`, // upbeat, motivating drive
    `${B}/Pixelland.mp3`,           // fun, bouncy chiptune
  ],
};

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function prepareMusic(genre) {
  mkdirSync(MUSIC_DIR, { recursive: true });
  const outputPath = join(MUSIC_DIR, 'background.mp3');
  const urls = shuffled(TRACKS[genre] || TRACKS.didyouknow || []);

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
