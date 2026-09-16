// Google Drive as the cloud clip drop.
//
// The channel's whole point is that it posts only from clips the creator owns.
// Those clips used to live in a Desktop folder, which meant the Mac had to be
// awake for anything to publish. Now they live in a Drive folder the creator
// drops into from their phone, and GitHub Actions pulls from it — so the daily
// upload runs whether or not any machine of theirs is on.
//
// Auth is a SERVICE ACCOUNT, deliberately: a service account reads files shared
// with it without ever touching the OAuth consent screen. The alternative
// (adding a Drive scope to the channel's existing OAuth client) would need
// `drive.readonly`, which Google classes as a restricted scope and would push
// the published app into verification. Sharing one folder with one robot
// address avoids all of that.
//
// Implemented against the REST API with nothing but node:crypto and fetch, on
// purpose. The cron runs many times a day and usually decides it has nothing to
// do; being dependency-free means that decision costs a few seconds instead of
// an `npm ci`.
//
// Setup (once, from any browser including a phone):
//   1. Enable the Drive API on the Google Cloud project that owns the key.
//   2. Make a Drive folder, share it with the service account's client_email.
//   3. Put that folder's ID in the DRIVE_FOLDER_ID secret.
import { createSign } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

const VIDEO_MIME = /^video\//;
const IMAGE_MIME = /^image\//;

export function isVideo(file) { return VIDEO_MIME.test(file.mimeType || ''); }
export function isImage(file) { return IMAGE_MIME.test(file.mimeType || ''); }

// Pasting a service-account JSON into a .env or a CI secret goes wrong in two
// reliable ways: the PEM's real line breaks survive (which isn't valid JSON), or
// the paste lands twice and leaves a second copy trailing after the object.
// Both are the human's editor misbehaving, not their mistake, so repair them
// here rather than making them hand-fix a 2KB blob they can't read.
//
// Step 1 takes only the first balanced {...}, which drops any trailing junk.
// Step 2, if that still won't parse, escapes raw newlines inside private_key.
function firstJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

function parseCredentials(raw) {
  const text = String(raw).trim().replace(/^['"]|['"]$/g, '');
  const candidates = [firstJsonObject(text), text];
  let lastErr;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastErr = err;
      try {
        return JSON.parse(candidate.replace(
          /"private_key"\s*:\s*"([\s\S]*?)"\s*,/,
          (_m, key) => `"private_key": "${key.replace(/\r?\n/g, '\\n')}",`,
        ));
      } catch (err2) { lastErr = err2; }
    }
  }
  throw new Error(`Service-account JSON could not be parsed: ${lastErr.message}`);
}

function credentials() {
  // GOOGLE_DRIVE_CREDENTIALS is preferred so Drive access can be rotated on its
  // own, but fall back to the TTS key: same project, already wired into CI.
  const raw = process.env.GOOGLE_DRIVE_CREDENTIALS || process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error('No service-account JSON (set GOOGLE_DRIVE_CREDENTIALS or GOOGLE_TTS_CREDENTIALS)');
  const creds = parseCredentials(raw);
  if (!creds.client_email || !creds.private_key) throw new Error('Service-account JSON is missing client_email/private_key');
  return creds;
}

export function driveConfigured() {
  if (!process.env.DRIVE_FOLDER_ID) return false;
  try { credentials(); return true; } catch { return false; }
}

export function serviceAccountEmail() {
  try { return credentials().client_email; } catch { return null; }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

let cachedToken = null;   // { token, expiresAt }

// Self-signed JWT bearer flow: sign a short-lived assertion with the service
// account's private key and trade it for an access token.
async function accessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const creds = credentials();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${signer.sign(creds.private_key, 'base64url')}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function driveFetch(url, init = {}) {
  const token = await accessToken();
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
}

// Everything sitting in the drop folder, oldest first so clips are consumed in
// the order they were added. supportsAllDrives keeps this working if the folder
// is ever moved into a shared drive.
export async function listDropFolder(folderId = process.env.DRIVE_FOLDER_ID) {
  const out = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
      orderBy: 'createdTime',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await driveFetch(`${FILES_URL}?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${JSON.stringify(data.error || data).slice(0, 300)}`);

    out.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out.filter(f => isVideo(f) || isImage(f));
}

export async function downloadFile(fileId, destPath) {
  const res = await driveFetch(`${FILES_URL}/${fileId}?alt=media&supportsAllDrives=true`);
  if (!res.ok) throw new Error(`Drive download failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
  return destPath;
}

// Best-effort tidy-up once a clip has been published. The committed ledger is
// the real "don't post this twice" guard; trashing only stops the creator's
// 15GB slowly filling with spent clips. Harmless no-op on a read-only share.
export async function trashFile(fileId) {
  try {
    const res = await driveFetch(`${FILES_URL}/${fileId}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
