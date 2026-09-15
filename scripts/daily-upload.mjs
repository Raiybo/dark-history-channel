// Daily uploader for the Kings of Ranks local weekly system.
// Posts up to DAILY_COUNT pre-built shorts/day from upload-queue/ (N.mp4 + N.json),
// tracks the per-day count so multiple launchd ticks (or a wake/boot) don't exceed
// the quota, and — once the day's uploads are done — marks today's "turn on your
// Mac" reminder complete so it never nags. Run by launchd several times a day plus
// RunAtLoad, so whenever the Mac is on it fulfills that day's quota and catches up.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = join(ROOT, 'upload-queue');
const STATE = join(QUEUE, '.daily-state.json');
const LOG = join(QUEUE, 'daily-upload.log');
const REMINDERS = join(ROOT, 'scripts', 'reminders.mjs');
const DAILY_COUNT = 3;

const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n'); } catch {} };
const today = () => new Date().toISOString().slice(0, 10);

// load .env (launchd has no dotenv)
try {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch {}

function loadState() { try { const s = JSON.parse(readFileSync(STATE, 'utf8')); return s.date === today() ? s : { date: today(), count: 0 }; } catch { return { date: today(), count: 0 }; } }
function saveState(s) { try { writeFileSync(STATE, JSON.stringify(s)); } catch {} }
function completeTodayReminder() { try { execFileSync('node', [REMINDERS, 'complete-today'], { stdio: 'ignore' }); } catch {} }

log('=== daily-upload run ===');
if (!existsSync(QUEUE)) { log('no queue folder; nothing to do'); process.exit(0); }
const state = loadState();
const remaining = DAILY_COUNT - state.count;
if (remaining <= 0) { log(`today's quota already met (${state.count}/${DAILY_COUNT})`); completeTodayReminder(); process.exit(0); }

const ids = readdirSync(QUEUE).filter(f => /^\d+\.mp4$/.test(f)).map(f => f.replace('.mp4', '')).sort((a, b) => +a - +b);
if (!ids.length) { log('queue empty; nothing to upload'); process.exit(0); }

const { uploadToYouTube, buildYouTubeClient } = await import('../src/uploader.js');
let posted = 0;
for (const id of ids) {
  if (posted >= remaining) break;
  const mp4 = join(QUEUE, `${id}.mp4`), jsonPath = join(QUEUE, `${id}.json`);
  if (!existsSync(jsonPath)) { log(`! ${id}: missing json, skipping`); continue; }
  const script = JSON.parse(readFileSync(jsonPath, 'utf8'));
  try {
    log(`uploading ${id}: "${script.title}"`);
    const result = await uploadToYouTube(script, mp4);
    try {
      const yt = buildYouTubeClient();
      const cur = (await yt.videos.list({ part: ['snippet'], id: [result.id] })).data.items[0].snippet;
      await yt.videos.update({ part: ['snippet'], requestBody: { id: result.id, snippet: { title: (script.title.slice(0, 90)) + ' #Shorts', categoryId: '15', description: cur.description, tags: cur.tags } } });
    } catch (e) { log(`  (title #Shorts update failed: ${e.message})`); }
    unlinkSync(mp4); unlinkSync(jsonPath);
    posted++; state.count++; saveState(state);
    log(`  ✓ ${result.url}  (${state.count}/${DAILY_COUNT} today)`);
  } catch (e) { log(`  ✗ upload failed for ${id}: ${(e.message || e).toString().slice(0, 160)} — leaving queued`); }
}
if (state.count >= 1) completeTodayReminder(); // Mac did its job today → cancel the nag
log(`done: posted ${posted} this run, ${state.count}/${DAILY_COUNT} today, ${ids.length - posted} left in queue`);
