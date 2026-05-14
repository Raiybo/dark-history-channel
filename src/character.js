import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAR_DIR = join(__dirname, '../public/characters');

const BASE = 'cartoon male narrator, natural afro hairstyle, thin mustache, red blazer black shirt, expressive 2D animation style, upper body portrait, clean white background, no text';

const EXPRESSIONS = {
  shocked:    'shocked expression wide open eyes mouth open disbelief dramatic reaction',
  serious:    'serious skeptical one raised eyebrow side eye look arms crossed confidence',
  explaining: 'explaining pointing finger upward confident smirk teaching gesture',
  amazed:     'mind blown amazed expression pointing at head eyes wide excitement celebrating',
};

function fetchWithTimeout(url, ms = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadWithRetry(url, filePath, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(4000 * attempt);
    try {
      const res = await fetchWithTimeout(url, 60000);
      if (res.status === 429) { console.log(` rate-limited, retrying...`); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(res.body, createWriteStream(filePath));
      return true;
    } catch (e) {
      if (attempt === retries - 1) throw e;
      console.log(` retry ${attempt + 1}...`);
    }
  }
  return false;
}

export async function generateCharacterImages() {
  mkdirSync(CHAR_DIR, { recursive: true });

  const images = {};
  let i = 0;
  for (const [key, expr] of Object.entries(EXPRESSIONS)) {
    const prompt = encodeURIComponent(`${BASE}, ${expr}`);
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=600&height=800&model=flux&nologo=true&seed=${1337 + i}`;
    const filePath = join(CHAR_DIR, `${key}.jpg`);

    process.stdout.write(`  Generating character (${key})...`);
    try {
      await downloadWithRetry(url, filePath);
      console.log(' ✓');
      images[key] = `characters/${key}.jpg`;
    } catch (e) {
      console.log(` ✗ (${e.message})`);
      images[key] = null;
    }

    // Pause between requests to avoid rate limiting
    if (i < Object.keys(EXPRESSIONS).length - 1) await sleep(3000);
    i++;
  }
  return images;
}
