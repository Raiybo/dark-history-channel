import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = join(__dirname, '../public/videos');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function pickBestFile(videoFiles) {
  const portrait = videoFiles.filter(f =>
    f.file_type === 'video/mp4' && f.height > f.width
  );
  const candidates = portrait.length > 0
    ? portrait
    : videoFiles.filter(f => f.file_type === 'video/mp4');

  return candidates
    .filter(f => f.width >= 720 && f.width <= 1920)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
}

async function searchVideo(keyword, attempt = 0) {
  const params = new URLSearchParams({
    query: keyword,
    orientation: 'portrait',
    size: 'medium',
    per_page: '10',
  });

  const res = await fetchWithTimeout(
    `https://api.pexels.com/videos/search?${params}`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } },
    30000
  );

  if (res.status === 429) {
    if (attempt < 3) {
      await sleep(15000 * (attempt + 1));
      return searchVideo(keyword, attempt + 1);
    }
    throw new Error('Rate limited');
  }

  if (!res.ok) throw new Error(`Pexels API ${res.status}`);

  const data = await res.json();
  for (const video of (data.videos || [])) {
    const file = pickBestFile(video.video_files || []);
    if (file) return { link: file.link, duration: video.duration };
  }

  // Retry with shorter keyword if no results
  if (keyword.split(' ').length > 2) {
    const shorter = keyword.split(' ').slice(0, 2).join(' ');
    return searchVideo(shorter, attempt + 1);
  }

  return null;
}

async function downloadClip(url, outputPath) {
  const res = await fetchWithTimeout(url, {}, 120000);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  const writer = createWriteStream(outputPath);
  await pipeline(res.body, writer);
}

export async function fetchSceneVideos(scenes) {
  mkdirSync(VIDEOS_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const { keyword } = scenes[i];
    try {
      process.stdout.write(`  [${i + 1}/${scenes.length}] "${keyword}"... `);
      const video = await searchVideo(keyword);
      if (!video) {
        process.stdout.write('✗ (no results)\n');
        results.push(null);
      } else {
        const clipPath = join(VIDEOS_DIR, `clip_${i}.mp4`);
        await downloadClip(video.link, clipPath);
        process.stdout.write('✓\n');
        results.push(`videos/clip_${i}.mp4`);
      }
    } catch (err) {
      process.stdout.write(`✗ (${err.message})\n`);
      results.push(null);
    }
    if (i < scenes.length - 1) await sleep(400);
  }

  return results;
}
