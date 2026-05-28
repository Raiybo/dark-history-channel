/**
 * One-time script to (re)generate your YouTube OAuth refresh token.
 * Run: node scripts/get-youtube-token.js
 *
 * Uses the modern loopback flow (Google blocked the old "paste a code" OOB
 * flow). It starts a tiny local server, you approve in the browser, and Google
 * redirects back here automatically — the new token is written to .env.
 *
 * IMPORTANT: publish your OAuth consent screen to "In production" first, or
 * Google expires the refresh token after 7 days.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const PORT = 8723;
const REDIRECT = `http://localhost:${PORT}`;

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT
);

const SCOPES = ['https://www.googleapis.com/auth/youtube'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',          // force a refresh_token every time
  scope: SCOPES,
});

function writeEnvToken(token) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  if (/^YOUTUBE_REFRESH_TOKEN=.*$/m.test(text)) {
    text = text.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, `YOUTUBE_REFRESH_TOKEN=${token}`);
  } else {
    text += (text.endsWith('\n') || text === '' ? '' : '\n') + `YOUTUBE_REFRESH_TOKEN=${token}\n`;
  }
  writeFileSync(ENV_PATH, text);
}

function finish(server) {
  setTimeout(() => { try { server.close(); } catch {} process.exit(0); }, 400);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (!code && !error) { res.statusCode = 204; res.end(); return; } // ignore favicon etc.

  if (error) {
    res.end(`Authorization failed: ${error}`);
    console.error('\nAuthorization failed:', error);
    return finish(server);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.end('No refresh_token returned. Revoke prior access at https://myaccount.google.com/permissions and run again.');
      console.error('\nNo refresh_token returned. Revoke prior access and retry.');
    } else {
      writeEnvToken(tokens.refresh_token);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>✅ Success — token saved.</h2><p>Close this tab and return to the terminal.</p>');
      console.log('\n✅ Success — new YOUTUBE_REFRESH_TOKEN written to .env.');
      console.log('   Tell Claude it is done; it will sync the GitHub secret and re-run the workflow.');
    }
  } catch (e) {
    res.end('Error exchanging code: ' + e.message);
    console.error('\nFailed to exchange code:', e.message);
  }
  finish(server);
});

server.listen(PORT, () => {
  console.log('\n────────────────────────────────────────────────');
  console.log('  YouTube OAuth Setup (loopback)');
  console.log('────────────────────────────────────────────────');
  console.log('\n1. Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Sign in and click Allow — you will be redirected back automatically.');
  console.log('   (If you see "Google hasn\'t verified this app": Advanced -> Go to ... (unsafe).)\n');
});
