// Headless auto-builder for the Kings of Ranks weekly system.
// Turns whatever clips are in ~/Desktop/yt clips into ready-to-post shorts, with
// NO session needed: it splits compilations into scenes, combines them into
// original montages (each clip played in full), renders them, and stages them in
// upload-queue/ as N.mp4 + N.json for the daily uploader. Then it arms the daily
// "turn on your Mac" reminders and archives the used source clips. Run by launchd
// on Sunday evening (after you've dropped the week's clips), or on demand.
import { readFileSync, readdirSync, existsSync, mkdirSync, renameSync, writeFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = join(homedir(), 'Desktop', 'yt clips');
const SRC = join(CLIPS, '_source');
const VID = join(ROOT, 'public', 'videos');
const OUTDIR = join(ROOT, 'output');
const QUEUE = join(ROOT, 'upload-queue');
const LOG = join(QUEUE, 'auto-build.log');
const REMINDERS = join(ROOT, 'scripts', 'reminders.mjs');
const FF = join(ROOT, 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg');
const FP = join(ROOT, 'node_modules', '@ffprobe-installer', 'darwin-arm64', 'ffprobe');
const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';

const SPLIT_MIN = 20;       // clips longer than this get scene-split if multi-scene
const MONTAGE_MAX_CLIPS = 6;
const MONTAGE_MAX_SEC = 72;
const DAILY_COUNT = 3;
const TITLES = [
  'Animals being absolute comedians 😭', 'Pets with zero chill 😭', 'Try not to laugh at these animals 😭',
  'Animals that make no sense 😭', 'Pets who forgot they are pets 😭', 'Animals doing the absolute most 😭',
  'Certified funny animal moments 😭', 'Animals with main character energy 😭', 'Pets being absolute menaces 😭',
];
const PINNED = 'Which one got you? 👇';

const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n'); } catch {} };
const dur = (f) => { try { return parseFloat(execFileSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f]).toString().trim()) || 0; } catch { return 0; } };
mkdirSync(QUEUE, { recursive: true }); mkdirSync(VID, { recursive: true }); mkdirSync(SRC, { recursive: true });

function sceneCuts(f) {
  try {
    const out = execFileSync(FF, ['-i', f, '-filter:v', "select='gt(scene,0.3)',showinfo", '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }).toString();
    return [...out.matchAll(/pts_time:([0-9.]+)/g)].map(m => parseFloat(m[1]));
  } catch (e) { return (e.stderr ? [...e.stderr.toString().matchAll(/pts_time:([0-9.]+)/g)].map(m => parseFloat(m[1])) : []); }
}
// cut+scale a segment to a staged 1080x1920 clip with normalized audio
let stage = 0;
function cut(src, start, len, whole) {
  const out = join(VID, `ab_${stage++}.mp4`);
  const args = ['-y'];
  if (!whole) args.push('-ss', start.toFixed(2));
  args.push('-i', src);
  if (!whole) args.push('-t', len.toFixed(2));
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-af', LN, out);
  execFileSync(FF, args, { stdio: 'ignore' });
  return { path: `videos/${basename(out)}`, abs: out, duration: whole ? dur(src) : len };
}

log('=== auto-build run ===');
const files = existsSync(CLIPS) ? readdirSync(CLIPS).filter(f => /\.(mp4|mov)$/i.test(f)) : [];
if (!files.length) { log('no clips in folder; nothing to build'); process.exit(0); }
log(`found ${files.length} source file(s)`);

// 1) build a pool of individual clips (split compilations into scenes)
const pool = [];
for (const f of files) {
  const abs = join(CLIPS, f);
  const d = dur(abs);
  if (d <= 0) { log(`  skip ${f} (unreadable)`); continue; }
  if (d > SPLIT_MIN) {
    const cuts = sceneCuts(abs).filter(t => t > 1 && t < d - 1);
    if (cuts.length >= 1) {
      const bounds = [0, ...cuts, d];
      for (let i = 0; i < bounds.length - 1; i++) {
        const s = bounds[i], len = bounds[i + 1] - bounds[i] - 0.05;
        if (len < 1.2) continue;              // drop tiny slivers
        try { pool.push(cut(abs, s, Math.min(len, MONTAGE_MAX_SEC), false)); } catch (e) { log(`  cut fail ${f}@${s}: ${(e.message||e).toString().slice(0,80)}`); }
      }
      continue;
    }
  }
  try { pool.push(cut(abs, 0, d, true)); } catch (e) { log(`  stage fail ${f}: ${(e.message||e).toString().slice(0,80)}`); }
}
log(`pool: ${pool.length} clip(s)`);
if (!pool.length) { log('pool empty; aborting'); process.exit(0); }

// 2) greedily group into montages (each clip played whole)
const groups = []; let cur = [], curSec = 0;
for (const c of pool) {
  if (cur.length && (cur.length >= MONTAGE_MAX_CLIPS || curSec + c.duration > MONTAGE_MAX_SEC)) { groups.push(cur); cur = []; curSec = 0; }
  cur.push(c); curSec += c.duration;
}
if (cur.length) groups.push(cur);
log(`grouping into ${groups.length} short(s)`);

// 3) render + stage each group
const { renderFunnyMontage } = await import('../src/renderer.js');
const existingIds = readdirSync(QUEUE).filter(f => /^\d+\.mp4$/.test(f)).map(f => +f.replace('.mp4', ''));
let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
let staged = 0;
for (let g = 0; g < groups.length; g++) {
  const clips = groups[g].map(c => ({ path: c.path, duration: c.duration }));
  const durationSec = +clips.reduce((s, c) => s + c.duration, 0).toFixed(2);
  try {
    log(`  render short ${g + 1}/${groups.length}: ${clips.length} clips, ${durationSec}s`);
    await renderFunnyMontage({ clips, credits: [], channelName: 'Kings of Ranks', clipVolume: 1, durationSec });
    const id = nextId++;
    renameSync(join(OUTDIR, 'video.mp4'), join(QUEUE, `${id}.mp4`));
    const title = TITLES[(id - 1) % TITLES.length];
    writeFileSync(join(QUEUE, `${id}.json`), JSON.stringify({
      title, genre: 'kingsranks', hasMusic: false,
      tags: ['funny animals', 'funny pets', 'try not to laugh', 'cute animals', 'animals'],
      description: `${title.replace(' 😭','')} 😅 ${PINNED}`, pinned_comment: PINNED,
    }, null, 2));
    staged++;
  } catch (e) { log(`  render fail short ${g + 1}: ${(e.message || e).toString().slice(0, 120)}`); }
}
log(`staged ${staged} short(s) into the queue`);

// 4) arm daily "turn on your Mac" reminders for the days needed, and archive sources
if (staged) {
  const days = Math.min(6, Math.ceil(staged / DAILY_COUNT));
  try { execFileSync('node', [REMINDERS, 'schedule-daily', String(days)], { stdio: 'ignore' }); log(`armed ${days} daily reminder(s)`); } catch (e) { log(`reminder arm failed: ${e.message}`); }
  for (const f of files) { try { renameSync(join(CLIPS, f), join(SRC, f)); } catch {} }
  log('archived source clips to _source/');
}
// clean staged temp clips
for (const c of pool) { try { if (existsSync(c.abs)) execFileSync('/bin/rm', ['-f', c.abs]); } catch {} }
log(`=== done: ${staged} short(s) queued ===`);
