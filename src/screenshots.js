// Real UI screenshot fetcher for the AI Tools genre.
//
// Uses puppeteer-core against the system Chromium the workflow already installs
// (/usr/bin/chromium in CI, standard Chrome path on the user's machine). For
// each scene we visit the exact URL the LLM chose, wait for the page to render,
// then capture the requested area at desktop resolution and save it as a .jpg
// under public/videos/. The renderer's existing VideoClip.jsx routes .jpg paths
// to Slide.jsx (Ken Burns motion), so a landscape screenshot pans cinematically
// across the portrait 1080x1920 frame with no extra work.

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
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
  return process.env.PUPPETEER_EXECUTABLE_PATH || DEFAULT_CHROME_PATHS[process.platform] || DEFAULT_CHROME_PATHS.linux;
}

// Desktop viewport gives us landscape captures — Slide.jsx pans across them,
// which reads as cinematic camera motion inside the portrait frame.
const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Best-effort dismissal of common cookie/consent banners so they don't dominate
// the hero shot. Runs in-page — a failure never breaks the capture.
async function dismissBanners(page) {
  try {
    await page.evaluate(() => {
      const kill = (sel) => document.querySelectorAll(sel).forEach(el => el.remove());
      // Broad common patterns — cookie bars, consent frames, GDPR overlays.
      kill('[id*="cookie" i]');
      kill('[class*="cookie" i]');
      kill('[id*="consent" i]');
      kill('[class*="consent" i]');
      kill('[id*="gdpr" i]');
      kill('[aria-label*="cookie" i]');
      // Common accept-button spellings — click them so any overlays close.
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (/^(accept|accept all|i agree|allow all|got it|ok)$/i.test(t)) { b.click(); break; }
      }
    });
  } catch { /* ignore */ }
}

// Scroll the page down to bring "product" or "features" sections into view for
// the mid-page captures. Different area values map to different scroll depths.
async function scrollToArea(page, area) {
  const scrollFor = {
    hero:     0,
    product:  0.35,
    features: 0.5,
    pricing:  0.7,
    docs:     0.3,
    full:     0.5,
  };
  const pct = scrollFor[area] ?? 0.3;
  if (pct === 0) return;
  await page.evaluate((p) => {
    const total = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.scrollTo({ top: total * p, behavior: 'instant' });
  }, pct);
  await sleep(600); // let lazy-loaded content settle
}

// If the URL clearly names the area (e.g. "/pricing"), prefer that URL as-is.
// Otherwise return the URL unchanged.
function urlForArea(baseUrl, area) {
  try {
    const u = new URL(baseUrl);
    if (area === 'pricing' && !u.pathname.match(/pricing/i)) {
      // Many tools have /pricing at root; a probe is cheap and if it 404s
      // we just fall back to scrolling the homepage.
      const trial = new URL(u.origin + '/pricing');
      return trial.toString();
    }
    if (area === 'features' && !u.pathname.match(/features/i)) {
      return new URL(u.origin + '/features').toString();
    }
    return baseUrl;
  } catch {
    return baseUrl;
  }
}

async function captureScene(page, scene, outputPath) {
  const url = urlForArea(scene.url, scene.area);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    // Second chance on the original URL if the /pricing or /features probe failed.
    if (url !== scene.url) {
      await page.goto(scene.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } else {
      throw new Error(`goto failed: ${url}`);
    }
  }
  // Wait a beat for hero fonts + images to paint.
  await sleep(2000);
  await dismissBanners(page);
  await sleep(400);
  await scrollToArea(page, scene.area);
  await page.screenshot({
    path: outputPath,
    type: 'jpeg',
    quality: 88,
    fullPage: false,
  });
}

// Capture one screenshot per scene. Returns an array of relative paths that
// the renderer plugs straight into script.clips. Any single-scene failure is
// non-fatal — that clip slot stays empty and the renderer paints a fallback
// tint for it, so the reel still ships with the majority of scenes intact.
export async function fetchToolScreenshots(scenes) {
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
    await page.setViewport({ width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 2 });

    const results = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const clipPath = join(VIDEOS_DIR, `clip_${i}.jpg`);
      process.stdout.write(`  [${i + 1}/${scenes.length}] ${scene.url} (${scene.area})... `);
      try {
        await captureScene(page, scene, clipPath);
        process.stdout.write('✓\n');
        results.push(`videos/clip_${i}.jpg`);
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
