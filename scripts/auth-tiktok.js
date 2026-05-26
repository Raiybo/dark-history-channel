import 'dotenv/config';
import readline from 'readline';

// One-time helper to obtain a TIKTOK_REFRESH_TOKEN.
//
// Prereqs (set in .env first):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI
// The redirect URI must EXACTLY match one configured in your TikTok app
// (developers.tiktok.com -> your app -> Login Kit / redirect URIs). TikTok
// requires HTTPS; a simple page you control is fine — you just copy the
// "code" query param it receives back here.
//
// Run:  npm run auth-tiktok

const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI } = process.env;

if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
  console.error('Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI in .env first.');
  process.exit(1);
}

const authUrl =
  'https://www.tiktok.com/v2/auth/authorize/?' +
  new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    scope: 'video.publish,video.upload',
    response_type: 'code',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state: 'didyouknow',
  });

console.log('\n1) Open this URL, approve the app, and let it redirect:\n');
console.log(authUrl);
console.log('\n2) Copy the "code" value from the redirected URL and paste it below.');
console.log('   (It looks like ...?code=XXXXX&state=... — paste just the code, URL-decoded.)\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste code: ', async (code) => {
  rl.close();
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code: decodeURIComponent(code.trim()),
      grant_type: 'authorization_code',
      redirect_uri: TIKTOK_REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    console.error('\nFailed to get tokens:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log('\n✅ Success. Add this to your .env and GitHub secrets:\n');
  console.log(`TIKTOK_REFRESH_TOKEN=${data.refresh_token}`);
  console.log(`\n(access token expires in ${data.expires_in}s; refresh token in ~${Math.round((data.refresh_expires_in || 31536000) / 86400)} days)\n`);
});
