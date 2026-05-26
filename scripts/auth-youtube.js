/**
 * Run once to get a fresh YouTube refresh token.
 * Usage: node scripts/auth-youtube.js
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';

const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3838';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/youtube'],
  prompt: 'consent',
});

console.log('\nOpening browser for YouTube authorization...\n');
exec(`open "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  if (!code) { res.end('No code received.'); return; }

  res.end('<h2>✓ Authorized! You can close this tab.</h2>');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n════════════════════════════════════════════');
  console.log('  NEW REFRESH TOKEN:');
  console.log(`\n  ${tokens.refresh_token}\n`);
  console.log('  → Go to GitHub → Settings → Secrets → Actions');
  console.log('  → Update YOUTUBE_REFRESH_TOKEN with the value above');
  console.log('════════════════════════════════════════════\n');
});

server.listen(3838, () => {
  console.log('Waiting for Google to redirect back...');
});
