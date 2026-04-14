/**
 * One-time script to generate your YouTube OAuth refresh token.
 * Run: npm run get-token
 * Follow the URL it prints, authorize, paste the code back.
 * Copy the refresh_token into your .env file.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES
});

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
    console.log('\n────────────────────────────────────────────────');
    console.log('  Success! Add this to your .env file:');
    console.log('────────────────────────────────────────────────\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('Also add it as a GitHub Actions secret named YOUTUBE_REFRESH_TOKEN');
  } catch (err) {
    console.error('Failed to get token:', err.message);
  }
});
