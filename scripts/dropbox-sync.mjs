// Desktop "Drop Box" -> Drive drop folder.
//
// Gives the operator a real folder on this PC to drag clips into, instead of
// only being able to add them from their phone. Anything dropped in gets
// uploaded to the Drive folder the cloud cron reads, then moved aside into
// _uploaded/ so the Drop Box only ever shows work that still has to go up.
//
// That move IS the bookkeeping — there is no state file to drift out of sync
// with reality. If a file is still sitting in Drop Box, it has not been
// uploaded; if it is in _uploaded, it has.
//
// Run by Task Scheduler every few minutes. Safe to run concurrently with
// itself and safe to run when there is nothing to do.
import { readdirSync, statSync, renameSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DROP = process.env.DROPBOX_DIR || join(homedir(), 'Desktop', 'Drop Box');
const DONE = join(DROP, '_uploaded');
const MEDIA = new Set(['.mp4', '.mov', '.webm', '.m4v', '.avi', '.jpg', '.jpeg', '.png', '.webp']);

// A file still being copied in reports a size that keeps changing. Rather than
// race it and upload a truncated clip, ignore anything touched very recently.
const SETTLE_MS = 30_000;

const log = (m) => console.log(`[dropbox] ${new Date().toISOString()} ${m}`);

// launchd-style minimal env: Task Scheduler gives us nothing, so read .env here.
for (const line of (existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH = process.env.DRIVE_USER_REFRESH_TOKEN;

if (!FOLDER_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH) {
  console.error('[dropbox] not configured — need DRIVE_FOLDER_ID, YOUTUBE_CLIENT_ID/SECRET and DRIVE_USER_REFRESH_TOKEN in .env');
  console.error('[dropbox] run: node scripts/dropbox-auth.js');
  process.exit(1);
}

mkdirSync(DROP, { recursive: true });
mkdirSync(DONE, { recursive: true });

const pending = readdirSync(DROP, { withFileTypes: true })
  .filter(e => e.isFile() && !e.name.startsWith('.') && MEDIA.has(extname(e.name).toLowerCase()))
  .map(e => ({ name: e.name, path: join(DROP, e.name) }))
  .filter(f => {
    const st = statSync(f.path);
    if (Date.now() - st.mtimeMs < SETTLE_MS) { log(`skipping ${f.name} — still being written`); return false; }
    return st.size > 0;
  });

if (!pending.length) { log('nothing to upload'); process.exit(0); }
log(`${pending.length} file(s) to upload`);

async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH, grant_type: 'refresh_token',
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token refresh failed (${res.status}): ${JSON.stringify(d).slice(0, 200)}`);
  return d.access_token;
}

const MIME = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.m4v': 'video/x-m4v', '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

// Resumable upload: one request to open a session, one to send the bytes. Used
// even for small files because it is the path that survives a big clip.
async function upload(token, file) {
  const ext = extname(file.name).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';
  const body = readFileSync(file.path);

  const start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(body.length),
    },
    body: JSON.stringify({ name: file.name, parents: [FOLDER_ID] }),
  });
  if (!start.ok) throw new Error(`session start ${start.status}: ${(await start.text()).slice(0, 200)}`);

  const session = start.headers.get('location');
  if (!session) throw new Error('no upload session URI returned');

  const put = await fetch(session, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Content-Length': String(body.length) },
    body,
  });
  if (!put.ok) throw new Error(`upload ${put.status}: ${(await put.text()).slice(0, 200)}`);
  return put.json().catch(() => ({}));
}

// If a name already exists in _uploaded, keep both rather than clobbering.
function archive(file) {
  let target = join(DONE, file.name);
  if (existsSync(target)) {
    const stem = basename(file.name, extname(file.name));
    target = join(DONE, `${stem}_${Date.now()}${extname(file.name)}`);
  }
  renameSync(file.path, target);
}

let token;
try {
  token = await accessToken();
} catch (err) {
  console.error(`[dropbox] ${err.message}`);
  console.error('[dropbox] re-run: node scripts/dropbox-auth.js');
  process.exit(1);
}

let ok = 0;
for (const file of pending) {
  const mb = (statSync(file.path).size / 1e6).toFixed(1);
  try {
    log(`uploading ${file.name} (${mb} MB)...`);
    const res = await upload(token, file);
    archive(file);
    ok++;
    log(`  ok — Drive id ${res.id || '?'}; moved to _uploaded/`);
  } catch (err) {
    // Left in place deliberately: the next run retries it.
    log(`  FAILED ${file.name}: ${(err.message || err).toString().slice(0, 180)}`);
  }
}
log(`done: ${ok}/${pending.length} uploaded`);
process.exit(ok === pending.length ? 0 : 1);
