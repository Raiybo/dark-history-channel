/**
 * One-time auth for the desktop Drop Box folder.
 * Run: node scripts/dropbox-auth.js
 *
 * Mints a long-lived user token so the local syncer can upload into the Drive
 * drop folder, and saves it as DRIVE_USER_REFRESH_TOKEN in .env.
 *
 * Why a USER token and not the service account the cron uses: service accounts
 * have no Drive storage quota of their own, so an upload from one fails with
 * "Service Accounts do not have storage quota" even when it can read and write
 * the folder's contents. Files have to be owned by a real account, so the
 * upload leg has to authenticate as the operator.
 *
 * Scope is drive.file only — access limited to files and folders this app
 * created, which is exactly the drop folder and nothing else in their Drive.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const PORT = 8725;
const REDIRECT = `http://localhost:${PORT}`;

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

function writeEnvVar(key, value) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, `${key}=${value}`);
  else text += (text.endsWith('\n') || text === '' ? '' : '\n') + `${key}=${value}\n`;
  writeFileSync(ENV_PATH, text);
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
    return finish(server, 1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.end('No refresh_token returned. Revoke prior access at https://myaccount.google.com/permissions and retry.');
      console.error('\nNo refresh_token returned. Revoke prior access and retry.');
      return finish(server, 1);
    }
    writeEnvVar('DRIVE_USER_REFRESH_TOKEN', tokens.refresh_token);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Drop Box authorized.</h2><p>Close this tab and return to the terminal.</p>');
    console.log('\nDRIVE_USER_REFRESH_TOKEN written to .env — the Drop Box folder can now upload.');
    finish(server);
  } catch (e) {
    res.end('Error exchanging code: ' + e.message);
    console.error('\nFailed to exchange code:', e.message);
    finish(server, 1);
  }
});

server.listen(PORT, () => {
  console.log('\n────────────────────────────────────────────────');
  console.log('  Drop Box upload access');
  console.log('────────────────────────────────────────────────');
  console.log('\n1. Open this URL:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Click Allow (Advanced -> Go to ... (unsafe) if warned).\n');
});
