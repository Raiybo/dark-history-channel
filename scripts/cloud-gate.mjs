// Cheap pre-flight for the daily cron.
//
// GitHub's scheduled runs get delayed or dropped when the platform is busy, so
// rather than three crons that each MUST fire, the workflow ticks often and this
// gate decides whether a tick has work to do. A missed slot is picked up by the
// next tick, which is what makes "3 a day" actually hold.
//
// It runs BEFORE npm ci / ffmpeg / chromium are installed, so it must stay
// dependency-free — that's why src/drive.js talks raw REST. A tick with nothing
// to do costs a few seconds instead of a few minutes.
import { readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDropFolder, isVideo, driveConfigured } from '../src/drive.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(ROOT, 'config', 'used-clips.json');
const CLIPS_PER_REEL = 5;
const DAILY_COUNT = Number(process.env.DAILY_COUNT || 3);

function decide(proceed, reason) {
  console.log(`[gate] ${proceed ? 'PROCEED' : 'SKIP'} — ${reason}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `proceed=${proceed}\nreason=${reason}\n`);
  }
  process.exit(0);
}

if (!driveConfigured()) {
  decide(false, 'Drive not configured (set DRIVE_FOLDER_ID + the service-account secret)');
}

let ledger = [];
try {
  const j = JSON.parse(readFileSync(LEDGER, 'utf8'));
  if (Array.isArray(j)) ledger = j;
} catch { /* first run */ }

// The ledger records clips, not shorts, so divide. Photos are excluded because
// a bonus still is an optional extra on a reel, not a reel of its own.
const today = new Date().toISOString().slice(0, 10);
const clipsToday = ledger.filter(e => e.kind !== 'photo' && String(e.usedAt || '').startsWith(today)).length;
const postedToday = Math.floor(clipsToday / CLIPS_PER_REEL);

// A manual dispatch with force=true is someone deliberately asking for one more
// now — honour it, but never let the cron do this on its own or a bad day could
// burn through the YouTube upload quota.
const forced = process.env.FORCE === '1';
if (postedToday >= DAILY_COUNT && !forced) {
  decide(false, `today's quota already met (${postedToday}/${DAILY_COUNT} posted)`);
}

// Spread the day's posts instead of firing all three on the first ticks that
// happen to have clips. Each slot is the EARLIEST hour (UTC) its post may go
// out, so a slot that gets missed — GitHub dropping a scheduled run, or clips
// arriving late — is simply picked up by a later tick rather than lost.
const slots = (process.env.UPLOAD_SLOTS_UTC || '13,17,21')
  .split(',').map(s => Number(s.trim())).filter(Number.isFinite);
const nextSlot = slots[Math.min(postedToday, slots.length - 1)];
const hourUtc = new Date().getUTCHours();
if (!forced && Number.isFinite(nextSlot) && hourUtc < nextSlot) {
  decide(false, `too early for post ${postedToday + 1}/${DAILY_COUNT} (slot opens at ${nextSlot}:00 UTC, now ${hourUtc}:00)`);
}

const usedIds = new Set(ledger.map(e => e.id));
let unused;
try {
  unused = (await listDropFolder()).filter(f => isVideo(f) && !usedIds.has(f.id)).length;
} catch (err) {
  // A Drive outage or a broken share shouldn't burn a full render run; skip
  // quietly and let the next tick retry.
  decide(false, `could not read Drive (${err.message.slice(0, 120)})`);
}

if (unused < CLIPS_PER_REEL) {
  decide(false, `only ${unused} unused clip(s); need ${CLIPS_PER_REEL}`);
}

decide(true, `${postedToday}/${DAILY_COUNT} posted today, ${unused} unused clip(s) available`);
