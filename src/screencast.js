// Real UI screencast recorder for the Consumer Awareness genre (and any future
// genre that wants LIVE motion instead of static screenshots). Uses Puppeteer
// (puppeteer-core against system Chromium) to open a page, move a fake but
// human-shaped cursor, optionally type into fields, then record a short MP4
// via the CDP screencast API. Output is a 9:16-friendly landscape .mp4 saved
// under public/videos/, which VideoClip.jsx picks up natively.
//
// This is what replaces static screenshots in the pipeline — the algorithm's
// July 2025 "inauthentic content" flag targets slideshow-with-TTS patterns,
// so real cursor/scroll/page motion is now demonetization-avoidance as well
// as growth. Every clip has genuine motion.

import puppeteer from 'puppeteer-core';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { createCursor } from 'ghost-cursor';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = join(__dirname, '../public/videos');

const DEFAULT_CHROME_PATHS = {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/chromium',
};
function chromiumPath() {
  return process.env.PUPPETEER_EXECUTABLE_PATH
    || DEFAULT_CHROME_PATHS[process.platform]
    || DEFAULT_CHROME_PATHS.linux;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Landscape capture — Slide/VideoClip will pan across it for a cinematic feel
// inside the portrait 1080x1920 frame (same trick already used for AI images).
const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Kill common cookie/consent banners so they don't dominate the shot. Runs in
// the page — a failure never breaks the capture.
async function dismissBanners(page) {
  try {
    await page.evaluate(() => {
      const rm = (sel) => document.querySelectorAll(sel).forEach(el => el.remove());
      rm('[id*="cookie" i]'); rm('[class*="cookie" i]');
      rm('[id*="consent" i]'); rm('[class*="consent" i]');
      rm('[id*="gdpr" i]'); rm('[aria-label*="cookie" i]');
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (/^(accept|accept all|i agree|allow all|got it|ok|dismiss)$/i.test(t)) { b.click(); break; }
      }
    });
  } catch { /* ignore */ }
}

// Recorder config: portrait-friendly landscape, mp4, 30fps to match the render.
const RECORDER_CONFIG = {
  followNewTab: false,
  fps: 30,
  videoFrame: { width: VIEWPORT_W, height: VIEWPORT_H },
  videoCrf: 18,
  videoCodec: 'libx264',
  videoPreset: 'ultrafast',
  videoBitrate: 1500,
  autopad: { color: 'black' },
  aspectRatio: '16:9',
};

// Record a single scene: navigate → wait → dismiss banners → run motion → save.
// `motion` is an async fn(page, cursor) that describes what to do on-page
// (scroll, click, type, highlight). Keeps the recorder busy so the output is
// never a still-image render.
async function recordScene(page, url, motion, outputPath, durationSeconds = 8) {
  const recorder = new PuppeteerScreenRecorder(page, RECORDER_CONFIG);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500);
  await dismissBanners(page);
  await sleep(500);

  await recorder.start(outputPath);
  const cursor = createCursor(page);
  try {
    await Promise.race([
      motion(page, cursor),
      sleep(durationSeconds * 1000),
    ]);
    // Ensure the recording captures the full requested duration even if the
    // motion function returned early.
    await sleep(Math.max(0, durationSeconds * 1000 - 100));
  } finally {
    await recorder.stop();
  }
}

// Motion library — small, composable scene actions the genre files can call
// by name. Each takes (page, cursor) and runs for a chunk of the scene time.
export const MOTIONS = {
  // Gentle scroll from top to ~60% of the page, cursor visible.
  scrollDown: async (page, cursor) => {
    await cursor.moveTo({ x: 720, y: 200 });
    for (let pct = 0; pct <= 60; pct += 4) {
      await page.evaluate((p) => {
        const total = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.scrollTo({ top: total * (p / 100), behavior: 'auto' });
      }, pct);
      await sleep(120);
    }
  },
  // Scroll up half a page then back down — creates natural "reading" motion.
  scrollScan: async (page, cursor) => {
    await cursor.moveTo({ x: 720, y: 300 });
    for (let pct = 0; pct <= 40; pct += 3) {
      await page.evaluate((p) => window.scrollTo({ top: document.body.scrollHeight * (p / 100), behavior: 'auto' }), pct);
      await sleep(150);
    }
    await sleep(400);
    for (let pct = 40; pct >= 10; pct -= 3) {
      await page.evaluate((p) => window.scrollTo({ top: document.body.scrollHeight * (p / 100), behavior: 'auto' }), pct);
      await sleep(150);
    }
  },
  // Hover the cursor over an element matching a CSS selector, then wiggle.
  hoverSelector: (selector) => async (page, cursor) => {
    try {
      const box = await page.$eval(selector, el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (box) {
        await cursor.moveTo({ x: box.x, y: box.y + window.scrollY || 0 });
        await sleep(600);
        await cursor.moveTo({ x: box.x + 10, y: box.y - 5 });
        await sleep(400);
      }
    } catch { /* selector not present — fall through to a scroll */
      await MOTIONS.scrollDown(page, cursor);
    }
  },
  // Idle at top, minor cursor drift — reads as "user just landed on the page".
  landing: async (page, cursor) => {
    await cursor.moveTo({ x: 400, y: 300 });
    await sleep(1000);
    await cursor.moveTo({ x: 900, y: 350 });
    await sleep(1000);
    await cursor.moveTo({ x: 700, y: 500 });
    await sleep(1000);
  },
};

// Public: record N scenes from an ordered list of {url, motion?, seconds?}
// and return the array of relative paths for main.js / renderer to consume.
// Any single-scene failure returns null in that slot so the caller can fill.
export async function recordSceneMotion(scenes) {
  mkdirSync(VIDEOS_DIR, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath(),
      headless: 'new',
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 1 });

    const results = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const motion = scene.motion || MOTIONS.scrollScan;
      const seconds = Math.max(4, Math.min(scene.seconds || 8, 15));
      const clipPath = join(VIDEOS_DIR, `clip_${i}.mp4`);
      process.stdout.write(`  [${i + 1}/${scenes.length}] ${scene.url} (${seconds}s motion)... `);
      try {
        await recordScene(page, scene.url, motion, clipPath, seconds);
        // Sanity: file must exist and be non-trivial (some Puppeteer errors
        // exit early and leave a 0-byte file).
        if (!existsSync(clipPath)) throw new Error('no output file');
        process.stdout.write('✓\n');
        results.push(`videos/clip_${i}.mp4`);
      } catch (err) {
        process.stdout.write(`✗ (${err.message.slice(0, 80)})\n`);
        results.push(null);
      }
    }
    return results;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
