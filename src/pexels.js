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
  const mp4 = videoFiles.filter(f => f.file_type === 'video/mp4');
  const portrait = mp4.filter(f => f.height > f.width);
  const pool = portrait.length > 0 ? portrait : mp4;

  // Prefer footage whose width is AT LEAST our 1080-wide canvas so it never gets
  // upscaled (upscaling 720p to 1080 is the soft/blurry look). Cap at UHD so the
  // download stays reasonable, and pick the highest resolution in that band.
  const sharp = pool
    .filter(f => f.width >= 1080 && f.width <= 2160)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  if (sharp.length > 0) return sharp[0];

  // Nothing at canvas resolution — take the largest available rather than fail.
  return pool.sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
}

async function searchVideo(keyword, usedUrls, minDuration = 4, attempt = 0) {
  const params = new URLSearchParams({
    query: keyword,
    orientation: 'portrait',
    size: 'medium',
    per_page: '15',
  });

  const res = await fetchWithTimeout(
    `https://api.pexels.com/videos/search?${params}`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } },
    30000
  );

  if (res.status === 429) {
    if (attempt < 3) {
      await sleep(15000 * (attempt + 1));
      return searchVideo(keyword, usedUrls, minDuration, attempt + 1);
    }
    throw new Error('Rate limited');
  }

  if (!res.ok) throw new Error(`Pexels API ${res.status}`);

  const data = await res.json();
  // First pass: skip videos we've already used AND require sufficient source
  // duration (so the clip doesn't end mid-scene and freeze, which reads as a
  // glitch on screen). Second pass: relax the duration filter if nothing fits.
  for (const video of (data.videos || [])) {
    const file = pickBestFile(video.video_files || []);
    if (!file) continue;
    if (usedUrls.has(file.link)) continue;
    if (video.duration && video.duration < minDuration) continue;
    return { link: file.link, duration: video.duration };
  }
  for (const video of (data.videos || [])) {
    const file = pickBestFile(video.video_files || []);
    if (!file) continue;
    if (usedUrls.has(file.link)) continue;
    return { link: file.link, duration: video.duration };
  }

  // Retry with shorter keyword if every result was either used or unsuitable.
  if (keyword.split(' ').length > 2) {
    const shorter = keyword.split(' ').slice(0, 2).join(' ');
    return searchVideo(shorter, usedUrls, minDuration, attempt + 1);
  }

  return null;
}

async function downloadClip(url, outputPath) {
  const res = await fetchWithTimeout(url, {}, 120000);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  const writer = createWriteStream(outputPath);
  await pipeline(res.body, writer);
}

// Pollinations is a free GET-based image generator. Used as a fallback for
// scenes where Pexels has no relevant stock (named people, specific events,
// branded products). Returns the image bytes directly — we save to disk and
// the renderer detects the .jpg extension to render it as a Ken-Burns image
// slide instead of a video clip.
async function generateAiImage(keyword, outputPath) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(keyword)}?width=1080&height=1920&nologo=true&model=flux`;
  const res = await fetchWithTimeout(url, {}, 60000);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const writer = createWriteStream(outputPath);
  await pipeline(res.body, writer);
}

// Like fetchSceneVideos but returns { path, duration } objects so the renderer
// can loop each clip to its real length (Remotion's OffthreadVideo can't loop
// on its own and freezes past a short clip's end). Used by the split-edit path.
export async function fetchClipsWithDuration(scenes) {
  mkdirSync(VIDEOS_DIR, { recursive: true });
  const usedUrls = new Set();
  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const { keyword } = scenes[i];
    try {
      process.stdout.write(`  [${i + 1}/${scenes.length}] "${keyword}"... `);
      const video = await searchVideo(keyword, usedUrls);
      if (video) {
        usedUrls.add(video.link);
        const clipPath = join(VIDEOS_DIR, `clip_${i}.mp4`);
        await downloadClip(video.link, clipPath);
        process.stdout.write('✓\n');
        results.push({ path: `videos/clip_${i}.mp4`, duration: video.duration || 6 });
      } else {
        process.stdout.write('Pexels missed, generating AI image... ');
        try {
          const imgPath = join(VIDEOS_DIR, `clip_${i}.jpg`);
          await generateAiImage(keyword, imgPath);
          process.stdout.write('✓ AI image\n');
          results.push({ path: `videos/clip_${i}.jpg`, duration: 6 });
        } catch (err) {
          process.stdout.write(`✗ AI image failed (${err.message})\n`);
          results.push(null);
        }
      }
    } catch (err) {
      process.stdout.write(`✗ (${err.message})\n`);
      results.push(null);
    }
    if (i < scenes.length - 1) await sleep(400);
  }
  return results;
}

export async function fetchSceneVideos(scenes) {
  mkdirSync(VIDEOS_DIR, { recursive: true });

  // Track the Pexels source URLs we've already used in THIS reel so no two
  // scenes use the same footage — eliminates the "same clip showing twice" bug.
  const usedUrls = new Set();
  const results = [];

  for (let i = 0; i < scenes.length; i++) {
    const { keyword } = scenes[i];
    try {
      process.stdout.write(`  [${i + 1}/${scenes.length}] "${keyword}"... `);
      const video = await searchVideo(keyword, usedUrls);
      if (video) {
        usedUrls.add(video.link);
        const clipPath = join(VIDEOS_DIR, `clip_${i}.mp4`);
        await downloadClip(video.link, clipPath);
        process.stdout.write('✓\n');
        results.push(`videos/clip_${i}.mp4`);
      } else {
        // Pexels has nothing fresh for this keyword (likely a specific named
        // subject — person, event, brand). Fall back to AI image generation.
        process.stdout.write('Pexels missed, generating AI image... ');
        try {
          const imgPath = join(VIDEOS_DIR, `clip_${i}.jpg`);
          await generateAiImage(keyword, imgPath);
          process.stdout.write('✓ AI image\n');
          results.push(`videos/clip_${i}.jpg`);
        } catch (err) {
          process.stdout.write(`✗ AI image failed (${err.message})\n`);
          results.push(null);
        }
      }
    } catch (err) {
      process.stdout.write(`✗ (${err.message})\n`);
      results.push(null);
    }
    if (i < scenes.length - 1) await sleep(400);
  }

  return results;
}
