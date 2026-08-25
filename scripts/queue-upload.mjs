// Scheduled uploader — run by launchd at the scheduled time. Uploads every
// pre-rendered short sitting in ../upload-queue (N.mp4 + N.json), adds #Shorts,
// and on full success clears the reserved source clips + removes its own launchd
// job. Everything the AI did (pick/rank/caption/render) already happened; this is
// a pure, reliable file upload. Safe to run repeatedly: an empty queue is a no-op.
import 'dotenv/config';
import { readdirSync, readFileSync, unlinkSync, rmSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { spawnSync } from 'child_process';
import { uploadToYouTube, buildYouTubeClient } from '../src/uploader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = join(ROOT, 'upload-queue');
const RESERVED = join(homedir(), 'Desktop', 'yt clips', '_queued');
const LOG = join(QUEUE, 'upload.log');
const LABEL = 'com.kingsofranks.autoupload';
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n'); } catch {} };

log('=== scheduled upload run starting ===');
if (!existsSync(QUEUE)) { log('no queue folder; nothing to do.'); process.exit(0); }

const ids = readdirSync(QUEUE).filter(f => /^\d+\.mp4$/.test(f)).map(f => f.replace('.mp4', '')).sort((a, b) => Number(a) - Number(b));
if (!ids.length) { log('queue empty; nothing to do.'); process.exit(0); }
log(`found ${ids.length} queued short(s): ${ids.join(', ')}`);

let allOk = true;
for (const id of ids) {
  const mp4 = join(QUEUE, `${id}.mp4`);
  const jsonPath = join(QUEUE, `${id}.json`);
  if (!existsSync(jsonPath)) { log(`! ${id}: missing json, skipping`); allOk = false; continue; }
  const script = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (process.env.DRY === '1') { log(`DRY: would upload ${id} "${script.title}" (${script.tags?.length} tags) from ${mp4}`); continue; }
  try {
    log(`uploading ${id}: "${script.title}"...`);
    const result = await uploadToYouTube(script, mp4);
    // add #Shorts to the title (uploader only hashtags the description)
    try {
      const yt = buildYouTubeClient();
      const cur = (await yt.videos.list({ part: ['snippet'], id: [result.id] })).data.items[0].snippet;
      const newTitle = (script.title.length > 90 ? script.title.slice(0, 90) : script.title) + ' #Shorts';
      await yt.videos.update({ part: ['snippet'], requestBody: { id: result.id, snippet: { title: newTitle, categoryId: '15', description: cur.description, tags: cur.tags } } });
    } catch (e) { log(`  (title #Shorts update failed: ${e.message})`); }
    log(`  ✓ published ${result.url}`);
    unlinkSync(mp4); unlinkSync(jsonPath);
  } catch (err) {
    allOk = false;
    log(`  ✗ upload failed for ${id}: ${(err.message || err).toString().slice(0, 200)} — leaving it queued for retry`);
  }
}

if (allOk && process.env.DRY !== '1') {
  // consumed successfully: remove reserved source clips + self-remove the launchd job.
  try { if (existsSync(RESERVED)) { rmSync(RESERVED, { recursive: true, force: true }); log('cleared reserved source clips'); } } catch (e) { log(`(clear reserved failed: ${e.message})`); }
  const plist = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  try { spawnSync('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`], { encoding: 'utf8' }); } catch {}
  try { if (existsSync(plist)) unlinkSync(plist); } catch {}
  log('all shorts uploaded; launchd job removed. done.');
} else {
  log('some uploads failed; keeping queue + job for the next run.');
}
