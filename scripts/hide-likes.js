// Post-upload: flip YouTube Studio's "Don't show how many viewers like this
// video" toggle on a freshly-uploaded video. This setting is Studio-only and
// NOT exposed in the public YouTube Data API, so we drive Studio as a real
// signed-in user via puppeteer-core + an already-installed system Chromium.
//
// Auth: cookies are JSON-encoded into the YT_STUDIO_COOKIES env var (a GitHub
// secret in CI). The user exports them once from a logged-in browser; Google
// session cookies are long-lived but DO expire / can be invalidated, in which
// case this function fails non-fatally and logs clearly so the user can
// re-export. The upload itself is never blocked by a failure here.
//
// Chromium path: PUPPETEER_EXECUTABLE_PATH (the workflow already sets this to
// /usr/bin/chromium on CI). Locally on Windows, default to the standard Chrome
// install path.
import puppeteer from 'puppeteer-core';

const DEFAULT_CHROME_PATHS = {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/chromium',
};

function chromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  return DEFAULT_CHROME_PATHS[process.platform] || DEFAULT_CHROME_PATHS.linux;
}

function loadCookies() {
  const raw = process.env.YT_STUDIO_COOKIES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Cookie-Editor exports carry fields/values puppeteer's setCookie rejects:
    // sameSite can be "unspecified" / "no_restriction" / null (not a string),
    // and expiry is `expirationDate` (Chrome extension) not `expires` (puppeteer).
    // Build clean cookie objects with ONLY the fields puppeteer accepts and the
    // right types, so a single odd cookie can't fail the whole setCookie call.
    return parsed.map(c => {
      const out = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
      };
      const ss = String(c.sameSite == null ? '' : c.sameSite).toLowerCase();
      if (ss === 'no_restriction' || ss === 'none') out.sameSite = 'None';
      else if (ss === 'lax') out.sameSite = 'Lax';
      else if (ss === 'strict') out.sameSite = 'Strict';
      // else: omit sameSite entirely (covers "unspecified", null, undefined)
      if (out.sameSite === 'None') out.secure = true;   // Chrome requires SameSite=None to be Secure
      const exp = typeof c.expirationDate === 'number' ? c.expirationDate
                : typeof c.expires === 'number' ? c.expires : null;
      if (exp) out.expires = Math.floor(exp);
      return out;
    }).filter(c => c.name && c.value && c.domain);
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function hideLikes(videoId) {
  if (!videoId) return false;

  const cookies = loadCookies();
  if (!cookies) {
    console.log('  hideLikes: YT_STUDIO_COOKIES not set or invalid — skipping');
    return false;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath(),
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1400, height: 900 });
    await page.setCookie(...cookies);

    await page.goto(`https://studio.youtube.com/video/${videoId}/edit`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    // Studio is heavy SPA; give the editor a beat to settle.
    await sleep(3500);

    // Bail loudly if Studio bounced us to login (cookies expired/invalid).
    if (page.url().includes('accounts.google.com')) {
      console.log('  hideLikes: cookies expired — redirected to login. Re-export YT_STUDIO_COOKIES.');
      return false;
    }

    // Expand the "Show more" section that hides advanced options.
    const expanded = await page.evaluate(() => {
      const findBtn = () => {
        const els = Array.from(document.querySelectorAll('button, [role="button"], ytcp-button, paper-button'));
        return els.find(el => {
          const t = (el.textContent || '').trim().toLowerCase();
          const a = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'show more' || a.includes('show more');
        });
      };
      const btn = findBtn();
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (expanded) await sleep(1200);

    // YouTube reworded this setting: it is now the POSITIVE checkbox
    // "Show how many viewers like this video" (CHECKED = likes are shown). So to
    // HIDE the like count we UNCHECK it. We match the exact label, walk up to the
    // row container, find the checkbox, and click only if it's currently checked.
    const result = await page.evaluate(() => {
      const isLabel = (s) =>
        s === 'show how many viewers like this video' ||
        (s.includes('show how many viewers like this video') && !/don['’]?t/.test(s));

      // Find the (short) element whose text is the label.
      const all = Array.from(document.querySelectorAll('*'));
      let labelEl = null;
      for (const el of all) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t && t.length < 60 && isLabel(t)) { labelEl = el; break; }
      }
      if (!labelEl) return { ok: false, reason: 'label-not-found' };

      // Walk up to find the row container that holds the checkbox.
      let row = labelEl;
      let checkbox = null;
      for (let i = 0; i < 8 && row; i++) {
        checkbox = row.querySelector('ytcp-checkbox-lit, tp-yt-paper-checkbox, [role="checkbox"]');
        if (checkbox) break;
        row = row.parentElement;
      }
      if (!checkbox) return { ok: false, reason: 'checkbox-not-found' };

      const checked =
        checkbox.getAttribute('aria-checked') === 'true' ||
        checkbox.hasAttribute('checked') ||
        checkbox.classList.contains('checked');
      // checked = likes currently SHOWN → click to uncheck (hide).
      // unchecked = the count is already hidden.
      if (!checked) return { ok: true, reason: 'already-hidden' };

      checkbox.click();
      return { ok: true, reason: 'clicked' };
    });

    if (!result.ok) {
      console.log(`  hideLikes: ${result.reason} — Studio UI may have changed`);
      return false;
    }
    if (result.reason === 'already-hidden') {
      console.log('  hideLikes: already hidden');
      return true;
    }

    await sleep(600);

    // Save.
    const saved = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('ytcp-button, button, [role="button"]'));
      const save = btns.find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        const a = (b.getAttribute('aria-label') || '').toLowerCase();
        return t === 'save' || a === 'save';
      });
      if (!save) return false;
      save.click();
      return true;
    });
    if (!saved) {
      console.log('  hideLikes: clicked toggle but Save button not found');
      return false;
    }

    // Wait for the save to flush (Studio shows a toast). Generous so we don't
    // close the browser mid-write.
    await sleep(4000);
    console.log('  hideLikes: ✓ likes hidden');
    return true;
  } catch (err) {
    console.log(`  hideLikes: failed (${err.message})`);
    return false;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// CLI usage: `node scripts/hide-likes.js <videoId>` for one-off testing.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/hide-likes.js <videoId>');
    process.exit(1);
  }
  hideLikes(id).then(ok => process.exit(ok ? 0 : 1));
}
