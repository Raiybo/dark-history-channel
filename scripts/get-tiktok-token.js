/**
 * One-time: connect your TikTok account so the pipeline can send video DRAFTS
 * to your TikTok inbox (you post them manually — no auto-publish).
 * Run: npm run get-tiktok-token
 *
 * Prerequisites in .env (from your TikTok for Developers app):
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 * And register this redirect URI in that app's Login Kit settings:
 *   http://localhost:8724/         (or set TIKTOK_REDIRECT_URI to your own)
 */
import 'dotenv/config';
import http from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const PORT = 8724;
const REDIRECT = process.env.TIKTOK_REDIRECT_URI || `http://localhost:${PORT}/`;
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const SCOPE = 'video.upload'; // upload to inbox as a draft

if (!CLIENT_KEY || !CLIENT_SECRET) {
  console.error('Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env first (from your TikTok for Developers app).');
  process.exit(1);
}

const state = 'st' + process.pid;
const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(CLIENT_KEY)}`
  + `&scope=${encodeURIComponent(SCOPE)}&response_type=code`
  + `&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}`;

function writeEnvToken(token) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  if (/^TIKTOK_REFRESH_TOKEN=.*$/m.test(text)) {
    text = text.replace(/^TIKTOK_REFRESH_TOKEN=.*$/m, `TIKTOK_REFRESH_TOKEN=${token}`);
  } else {
    text += (text.endsWith('\n') || text === '' ? '' : '\n') + `TIKTOK_REFRESH_TOKEN=${token}\n`;
  }
  writeFileSync(ENV_PATH, text);
}

const finish = (server, code = 0) => setTimeout(() => { try { server.close(); } catch {} process.exit(code); }, 400);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) { res.statusCode = 204; res.end(); return; }
  if (error) {
    res.end(`Authorization failed: ${error}`);
    console.error('\nAuthorization failed:', error);
    return finish(server, 1);
  }
  try {
    const body = new URLSearchParams({
      client_key: CLIENT_KEY, client_secret: CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri: REDIRECT,
    });
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const data = await r.json();
    if (!data.refresh_token) {
      res.end('No refresh_token returned: ' + JSON.stringify(data));
      console.error('\nNo refresh_token returned:', data);
      return finish(server, 1);
    }
    writeEnvToken(data.refresh_token);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✅ TikTok connected — token saved.</h2><p>Close this tab and return to the terminal.</p>');
    console.log('\n✅ TIKTOK_REFRESH_TOKEN written to .env (scopes: ' + (data.scope || SCOPE) + ').');
    console.log('   Tell Claude it is done; it will sync the GitHub secrets.');
  } catch (e) {
    res.end('Error exchanging code: ' + e.message);
    console.error('\nFailed to exchange code:', e.message);
  }
  finish(server, 0);
});

server.listen(PORT, () => {
  console.log('\n────────────────────────────────────────────────');
  console.log('  TikTok Connect (loopback)');
  console.log('────────────────────────────────────────────────');
  console.log('\n1. Make sure this redirect URI is registered in your TikTok app:');
  console.log(`   ${REDIRECT}`);
  console.log('\n2. Open this URL in your browser and approve:\n');
  console.log(`   ${authUrl}\n`);
});
