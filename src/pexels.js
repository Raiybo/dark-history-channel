import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '../public/images');

// Scene keyword comes FIRST so the model prioritises the subject over style
const STYLE_SUFFIX = ', hyper-realistic cinematic photography, National Geographic documentary style, dramatic chiaroscuro lighting, dark moody atmosphere, photorealistic 8K, film grain, no text, no watermark, portrait 9:16';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateImage(keyword, index, attempt = 0) {
  const fullPrompt = `${keyword}${STYLE_SUFFIX}`;
  const encoded = encodeURIComponent(fullPrompt);
  const seed = (Date.now() + index * 7919) % 999983;
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1920&nologo=true&seed=${seed}&model=flux`;

  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });

  if (response.status === 429) {
    if (attempt < 4) {
      const delay = 5000 * (attempt + 1);
      await sleep(delay);
      return generateImage(keyword, index, attempt + 1);
    }
    throw new Error('Rate limited after retries');
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = await response.arrayBuffer();
  const outputPath = join(IMAGES_DIR, `slide_${index}.jpg`);
  writeFileSync(outputPath, Buffer.from(buffer));
  return `images/slide_${index}.jpg`;
}

export async function fetchSceneImages(scenes) {
  mkdirSync(IMAGES_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    try {
      process.stdout.write(`  [${i + 1}/${scenes.length}] "${scenes[i].keyword}"... `);
      const path = await generateImage(scenes[i].keyword, i);
      process.stdout.write('✓\n');
      results.push(path);
    } catch (err) {
      process.stdout.write(`✗ (${err.message})\n`);
      results.push(null);
    }
    // Pause between requests to stay within rate limits
    if (i < scenes.length - 1) await sleep(2000);
  }

  return results;
}
