/**
 * One-time Drive provisioning for the cloud auto-poster.
 * Run: node scripts/setup-drive.js
 *
 * Does the three console chores in one sign-in, so the operator only has to
 * click Allow once:
 *   1. enables the Drive API on the Google Cloud project
 *   2. creates the clip drop folder in their Drive
 *   3. shares that folder with the service account the cron authenticates as
 * then writes DRIVE_FOLDER_ID into .env.
 *
 * Kept separate from get-youtube-token.js on purpose. The YouTube re-auth MUST
 * succeed — it's what publishes — and this flow asks for scopes Google may
 * refuse on an unverified app. Bundling them would risk losing the token that
 * actually matters. If this bounces, the manual path in CLOUD-SETUP.md is
 * unaffected.
 *
 * The token minted here is used once, for provisioning, and is not stored.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { serviceAccountEmail } from '../src/drive.js';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const PORT = 8724;
const REDIRECT = `http://localhost:${PORT}`;
const FOLDER_NAME = process.env.DRIVE_FOLDER_NAME || 'yt clips';

const SA_EMAIL = serviceAccountEmail();
const PROJECT_ID = (() => {
  try {
    const raw = process.env.GOOGLE_DRIVE_CREDENTIALS || process.env.GOOGLE_TTS_CREDENTIALS || '';
    const m = raw.match(/"project_id"\s*:\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch { return null; }
})();

if (!SA_EMAIL || !PROJECT_ID) {
  console.error('Could not read the service account from .env (need GOOGLE_DRIVE_CREDENTIALS or GOOGLE_TTS_CREDENTIALS).');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT,
);

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform', // enable the Drive API
  'https://www.googleapis.com/auth/drive.file',     // create + share the folder we make
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

function writeEnvVar(key, value) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, `${key}=${value}`);
  else text += (text.endsWith('\n') || text === '' ? '' : '\n') + `${key}=${value}\n`;
  writeFileSync(ENV_PATH, text);
}

async function api(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* empty body */ }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error?.message || data).slice(0, 300)}`);
  return data;
}

async function provision(token) {
  // 1. Enable the Drive API. Already-enabled is a success, not an error.
  process.stdout.write('  1/3 enabling the Drive API... ');
  try {
    await api(
      `https://serviceusage.googleapis.com/v1/projects/${PROJECT_ID}/services/drive.googleapis.com:enable`,
      token, { method: 'POST', body: '{}' },
    );
    console.log('done');
  } catch (err) {
    if (/already enabled/i.test(err.message)) console.log('already enabled');
    else throw new Error(`could not enable the Drive API: ${err.message}`);
  }

  // 2. Reuse the folder if this has been run before, otherwise make one.
  process.stdout.write(`  2/3 creating the "${FOLDER_NAME}" folder... `);
  let folderId = process.env.DRIVE_FOLDER_ID || null;
  if (folderId) {
    try {
      const existing = await api(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`, token);
      console.log(`reusing "${existing.name}"`);
    } catch { folderId = null; }
  }
  if (!folderId) {
    const folder = await api('https://www.googleapis.com/drive/v3/files?fields=id,name', token, {
      method: 'POST',
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = folder.id;
    console.log('done');
  }

  // 3. Share it with the robot that the cron authenticates as. Editor, not
  //    Viewer, so spent clips can be trashed and the 15GB doesn't fill up.
  process.stdout.write(`  3/3 sharing it with ${SA_EMAIL}... `);
  try {
    await api(
      `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`,
      token,
      { method: 'POST', body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: SA_EMAIL }) },
    );
    console.log('done');
  } catch (err) {
    if (/duplicate/i.test(err.message)) console.log('already shared');
    else throw new Error(`could not share the folder: ${err.message}`);
  }

  writeEnvVar('DRIVE_FOLDER_ID', folderId);
  return folderId;
}

function finish(server, code = 0) {
  setTimeout(() => { try { server.close(); } catch {} process.exit(code); }, 400);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) { res.statusCode = 204; res.end(); return; }

  if (error) {
    res.end(`Authorization failed: ${error}`);
    console.error(`\nAuthorization failed: ${error}`);
    console.error('Fall back to the manual steps in CLOUD-SETUP.md.');
    return finish(server, 1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Authorized — setting things up.</h2><p>Close this tab and return to the terminal.</p>');
    console.log('\nAuthorized. Provisioning:\n');
    const folderId = await provision(tokens.access_token);
    console.log('\n────────────────────────────────────────────────');
    console.log('  Drive is ready.');
    console.log(`  Folder: "${FOLDER_NAME}"`);
    console.log(`  DRIVE_FOLDER_ID=${folderId}  (written to .env)`);
    console.log(`  https://drive.google.com/drive/folders/${folderId}`);
    console.log('────────────────────────────────────────────────');
    console.log('\nDrop your clips in that folder. Tell Claude it is done and it');
    console.log('will set the GitHub secret and fire a test run.\n');
    finish(server);
  } catch (e) {
    console.error(`\nSetup failed: ${e.message}`);
    console.error('Fall back to the manual steps in CLOUD-SETUP.md.');
    finish(server, 1);
  }
});

server.listen(PORT, () => {
  console.log('\n────────────────────────────────────────────────');
  console.log('  Drive setup — one sign-in');
  console.log('────────────────────────────────────────────────');
  console.log(`\n  Project:        ${PROJECT_ID}`);
  console.log(`  Service account: ${SA_EMAIL}`);
  console.log('\n1. Open this URL:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Click Allow. If you see "Google hasn\'t verified this app",');
  console.log('   choose Advanced -> Go to ... (unsafe). It is your own app.\n');
});
