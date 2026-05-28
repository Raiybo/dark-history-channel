/**
 * One-time script to (re)generate your YouTube OAuth refresh token.
 * Run: npm run get-token
 * Follow the URL it prints, authorize, paste the code back.
 * The new token is written into .env automatically.
 *
 * IMPORTANT: publish your Google OAuth consent screen to "In production" first
 * (console.cloud.google.com/apis/credentials/consent). In "Testing" mode Google
 * expires refresh tokens after 7 days; in production they don't expire.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = ['https://www.googleapis.com/auth/youtube'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',           // force a refresh_token to be returned every time
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

console.log('\n────────────────────────────────────────────────');
console.log('  YouTube OAuth Setup');
console.log('────────────────────────────────────────────────');
console.log('\n1. Open this URL in your browser:\n');
console.log(`   ${authUrl}\n`);
console.log('2. Sign in and click Allow');
console.log('3. Copy the code shown and paste it below\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the authorization code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned. Revoke prior access at');
      console.error('https://myaccount.google.com/permissions and run this again.');
      return;
    }
    writeEnvToken(tokens.refresh_token);
    console.log('\n✅ Success — new YOUTUBE_REFRESH_TOKEN written to .env.');
    console.log('   Tell Claude it is done; it will sync the GitHub secret and re-run the workflow.');
  } catch (err) {
    console.error('Failed to get token:', err.message);
  }
});
