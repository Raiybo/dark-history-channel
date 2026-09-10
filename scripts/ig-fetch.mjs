// Instagram → clips-folder auto-downloader.
//
// You keep the authorization step (you choose which reels to grab); this only
// automates the download + placement. Flow: on your phone, share an authorized
// reel and append its URL to the iCloud queue file (via an Apple Shortcut, or
// paste it on the Mac). This script — run on a schedule by launchd — reads the
// queue and downloads each NEW reel into ~/Desktop/yt clips via yt-dlp, named
// <handle>_<shortcode>.mp4 to match the existing convention. Already-downloaded
// URLs are tracked so nothing is fetched twice. Safe to run repeatedly.
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const QUEUE_DIR = join(HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'yt-reels');
const QUEUE = join(QUEUE_DIR, 'links.txt');        // append reel URLs here (phone Shortcut or manual)
const DONE  = join(QUEUE_DIR, 'downloaded.txt');   // record of URLs already fetched
const DEST  = join(HOME, 'Desktop', 'yt clips');   // where the pipeline reads clips from
const LOG   = join(QUEUE_DIR, 'ig-fetch.log');

// Resolve yt-dlp (launchd has a minimal PATH, so prefer an absolute path).
const YTDLP = [
  '/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp',
].find(p => existsSync(p)) || 'yt-dlp';

mkdirSync(QUEUE_DIR, { recursive: true });
mkdirSync(DEST, { recursive: true });
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n'); } catch {} };

if (!existsSync(QUEUE)) { writeFileSync(QUEUE, ''); log('created empty queue; nothing to do'); process.exit(0); }

const norm = (u) => u.trim().split('?')[0].replace(/\/+$/, '');
const isReel = (u) => /instagram\.com\/(reel|reels|p|tv)\//i.test(u);
const done = new Set(existsSync(DONE) ? readFileSync(DONE, 'utf8').split('\n').map(norm).filter(Boolean) : []);
const lines = readFileSync(QUEUE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const todo = [...new Set(lines.map(norm))].filter(u => isReel(u) && !done.has(u));

if (!todo.length) { log(`queue: ${lines.length} line(s); nothing new`); process.exit(0); }
log(`downloading ${todo.length} new reel(s) into ${DEST} ...`);

const OUT_TMPL = join(DEST, '%(channel,uploader_id)s_%(id)s.%(ext)s');
function fetch(url, useCookies) {
  const args = ['--no-warnings', '--no-playlist', '--quiet', '--no-progress',
    '-o', OUT_TMPL, '--merge-output-format', 'mp4'];
  if (useCookies) args.push('--cookies-from-browser', 'safari');
  args.push(url);
  execFileSync(YTDLP, args, { stdio: 'inherit', timeout: 180000 });
}

let ok = 0;
for (const url of todo) {
  try {
    fetch(url, false);
    appendFileSync(DONE, url + '\n'); done.add(url); ok++;
    log(`  ok  ${url}`);
  } catch (e1) {
    try {
      fetch(url, true); // IG sometimes needs auth — retry with Safari cookies
      appendFileSync(DONE, url + '\n'); done.add(url); ok++;
      log(`  ok  ${url} (via browser cookies)`);
    } catch (e2) {
      log(`  FAIL ${url} — ${(e2.message || e2).toString().slice(0, 140)}`);
    }
  }
}
log(`done: ${ok}/${todo.length} downloaded`);
