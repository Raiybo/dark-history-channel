// One cloud-side daily post. Run by GitHub Actions on a cron; needs nothing of
// the creator's to be switched on.
//
// Flow: read the Drive drop folder -> take the oldest CLIPS_PER_REEL clips that
// haven't been published before -> download them into a scratch dir -> hand that
// dir to the normal clipranks pipeline -> record whatever got published in the
// committed ledger so it can never be posted twice.
//
// The ledger (config/used-clips.json) is the source of truth, not the state of
// the Drive folder, because a run can die at any point and Drive is not
// transactional. The pipeline deletes a clip from the scratch dir only after its
// reel has uploaded successfully, so "the file is gone" is a reliable signal
// that it made it to YouTube — that's what we write down.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDropFolder, downloadFile, trashFile, isVideo, isImage, driveConfigured, serviceAccountEmail } from '../src/drive.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(ROOT, 'config', 'used-clips.json');
const SCRATCH = join(ROOT, '.cloud-clips');
const CLIPS_PER_REEL = 5;

const log = (m) => console.log(`[cloud-daily] ${m}`);

function loadLedger() {
  try { const j = JSON.parse(readFileSync(LEDGER, 'utf8')); return Array.isArray(j) ? j : []; }
  catch { return []; }
}

function saveLedger(entries) {
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, JSON.stringify(entries, null, 2) + '\n');
}

// Drive names are free-form; the pipeline reads clips off a real filesystem and
// keys behaviour off the extension, so make sure both survive the trip.
const MIME_EXT = {
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
  'video/x-m4v': '.m4v', 'video/x-msvideo': '.avi',
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
};

function localName(file) {
  const safe = file.name.replace(/[\/\\:*?"<>|]/g, '_').trim();
  const hasExt = extname(safe).length > 1;
  return hasExt ? safe : safe + (MIME_EXT[file.mimeType] || (isImage(file) ? '.jpg' : '.mp4'));
}

if (!driveConfigured()) {
  console.error('[cloud-daily] Drive is not configured.');
  console.error('  Needs DRIVE_FOLDER_ID plus GOOGLE_DRIVE_CREDENTIALS (or GOOGLE_TTS_CREDENTIALS).');
  console.error('  Share the Drive folder with the service account, then set the secrets.');
  process.exit(1);
}

log(`service account: ${serviceAccountEmail()}`);

const ledger = loadLedger();
const usedIds = new Set(ledger.map(e => e.id));

let all;
try {
  all = await listDropFolder();
} catch (err) {
  console.error(`[cloud-daily] Could not read the Drive folder: ${err.message}`);
  console.error('  Check that the folder is shared with the service account and the Drive API is enabled.');
  process.exit(1);
}

const freshVideos = all.filter(f => isVideo(f) && !usedIds.has(f.id));
const freshImages = all.filter(f => isImage(f) && !usedIds.has(f.id));
log(`drop folder: ${all.length} file(s); ${freshVideos.length} unused clip(s), ${freshImages.length} unused photo(s)`);

// No clips is a normal state (the creator hasn't dropped this week's batch yet),
// not a failure. A red run every morning would train them to ignore the alerts.
if (freshVideos.length < CLIPS_PER_REEL) {
  log(`nothing to post: need ${CLIPS_PER_REEL} unused clips, have ${freshVideos.length}. Skipping cleanly.`);
  process.exit(0);
}

const batch = freshVideos.slice(0, CLIPS_PER_REEL);
const bonus = freshImages[0] || null;   // the pipeline shows one still at the end, if present

rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });

const staged = [];   // { file, path, name }
for (const file of [...batch, ...(bonus ? [bonus] : [])]) {
  const name = localName(file);
  const path = join(SCRATCH, name);
  try {
    await downloadFile(file.id, path);
    staged.push({ file, path, name });
    log(`  downloaded ${name} (${(Number(file.size || 0) / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    log(`  ! failed to download ${file.name}: ${err.message}`);
  }
}

const stagedVideos = staged.filter(s => isVideo(s.file));
if (stagedVideos.length < CLIPS_PER_REEL) {
  console.error(`[cloud-daily] Only ${stagedVideos.length}/${CLIPS_PER_REEL} clips downloaded; not enough for a reel.`);
  process.exit(1);
}

log(`rendering + uploading one reel from ${stagedVideos.length} clips...`);
const res = spawnSync(process.execPath, [join(ROOT, 'src', 'main.js')], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, CLIPS_DIR: SCRATCH, GENRE_OVERRIDE: 'clipranks', UPLOAD: '1' },
});

// The pipeline removes a source clip from CLIPS_DIR only once its reel has
// published, so surviving files mean "not posted" — they stay unmarked and get
// retried on the next run.
const leftover = new Set(existsSync(SCRATCH) ? readdirSync(SCRATCH) : []);
const published = staged.filter(s => !leftover.has(s.name));

if (published.length) {
  const usedAt = new Date().toISOString();
  // `kind` matters: the gate divides clips-used-today by CLIPS_PER_REEL to work
  // out how many shorts went up, and a bonus photo would skew that count.
  saveLedger([...ledger, ...published.map(s => ({
    id: s.file.id,
    name: s.file.name,
    kind: isImage(s.file) ? 'photo' : 'clip',
    usedAt,
  }))]);
  log(`marked ${published.length} clip(s) as used in the ledger`);
  for (const s of published) {
    const ok = await trashFile(s.file.id);
    log(`  ${ok ? 'trashed' : 'could not trash (read-only share?)'} ${s.file.name} in Drive`);
  }
} else {
  log('nothing was published this run; no clips marked used (they will be retried)');
}

rmSync(SCRATCH, { recursive: true, force: true });

if (res.status !== 0) {
  console.error(`[cloud-daily] pipeline exited ${res.status}`);
  process.exit(res.status || 1);
}
if (!published.length) {
  console.error('[cloud-daily] pipeline succeeded but published nothing — treating as a failure so it surfaces.');
  process.exit(1);
}
log('done.');
