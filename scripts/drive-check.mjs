// Setup doctor for the cloud clip drop. Run it locally (`npm run drive-check`)
// or dispatch the cloud-daily workflow with check_only, and it tells you exactly
// which of the three setup steps is still missing instead of failing with a raw
// Google error.
// Optional so the check also runs in CI before `npm ci` has installed anything.
await import('dotenv/config').catch(() => {});
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDropFolder, isVideo, isImage, serviceAccountEmail, driveConfigured } from '../src/drive.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS_PER_SHORT = 5;

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);

console.log('\nCloud clip drop — setup check\n');

const email = serviceAccountEmail();
if (!email) {
  bad('No service-account JSON found.');
  console.log('    Set GOOGLE_DRIVE_CREDENTIALS (or GOOGLE_TTS_CREDENTIALS) to the full JSON key.');
  process.exit(1);
}
ok(`service-account key parsed — ${email}`);

if (!process.env.DRIVE_FOLDER_ID) {
  bad('DRIVE_FOLDER_ID is not set.');
  console.log('    Open the Drive folder in a browser; the ID is the last part of the URL:');
  console.log('    https://drive.google.com/drive/folders/<THIS_PART>');
  process.exit(1);
}
ok(`DRIVE_FOLDER_ID is set (${process.env.DRIVE_FOLDER_ID})`);

if (!driveConfigured()) { bad('Drive still reports unconfigured.'); process.exit(1); }

let files;
try {
  files = await listDropFolder();
} catch (err) {
  bad(`Could not read the folder: ${err.message}`);
  console.log('\n  Most likely one of:');
  console.log(`    1. The folder isn't shared with ${email} (share it as Editor).`);
  console.log('    2. The Drive API isn\'t enabled on that Google Cloud project.');
  console.log('    3. DRIVE_FOLDER_ID points at a different folder.');
  process.exit(1);
}
ok(`folder readable — ${files.length} file(s) visible`);

let used = new Set();
try {
  const j = JSON.parse(readFileSync(join(ROOT, 'config', 'used-clips.json'), 'utf8'));
  used = new Set((Array.isArray(j) ? j : []).map(e => e.id));
} catch { /* first run, no ledger yet */ }

const clips = files.filter(f => isVideo(f) && !used.has(f.id));
const photos = files.filter(f => isImage(f) && !used.has(f.id));
const shorts = Math.floor(clips.length / CLIPS_PER_SHORT);

console.log('');
console.log(`  Unused clips : ${clips.length}`);
console.log(`  Unused photos: ${photos.length}`);
console.log(`  Already used : ${used.size}`);
console.log(`  Ready to post: ${shorts} short(s)`);

if (clips.length < CLIPS_PER_SHORT) {
  console.log(`\n  Drop at least ${CLIPS_PER_SHORT - clips.length} more clip(s) and the next cron will post.\n`);
} else {
  console.log('\n  Everything is wired up. The cron will post on its own.\n');
}
